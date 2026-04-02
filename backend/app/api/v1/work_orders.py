import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.audit import audit_log
from app.core.tenant import get_current_tenant
from app.db.pagination import paginate
from app.db.session import get_db
from app.db.spatial import lon_lat_columns, make_point
from app.models.sign import Sign, SignSupport
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.work_order import (
    WorkOrderCreate,
    WorkOrderListOut,
    WorkOrderOut,
    WorkOrderUpdate,
)
from app.schemas.work_order_asset import WorkOrderAssetOut, WorkOrderAssetUpdate
from app.services.converters import populate_wo_asset_labels, woa_to_out, wo_to_out

router = APIRouter()


async def _generate_work_order_number(
    tenant_id: uuid.UUID, db: AsyncSession
) -> str:
    """Generate WO-YYYYMMDD-NNN sequential number per tenant per day."""
    today = date.today()
    prefix = f"WO-{today.strftime('%Y%m%d')}-"

    # Find the max existing number for this tenant and date
    result = await db.execute(
        select(WorkOrder.work_order_number)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.work_order_number.like(f"{prefix}%"),
        )
        .order_by(WorkOrder.work_order_number.desc())
        .limit(1)
    )
    last = result.scalar_one_or_none()

    if last:
        try:
            seq = int(last.split("-")[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1

    return f"{prefix}{seq:03d}"


async def _resolve_fallback_coords_for_work_orders(
    wo_ids: list[uuid.UUID], db: AsyncSession
) -> dict[uuid.UUID, tuple[float, float]]:
    """
    For work orders without geometry, resolve lon/lat from the first linked
    sign via work_order_asset. Returns {work_order_id: (lon, lat)}.
    Batch query — no N+1.
    """
    if not wo_ids:
        return {}

    # Get the first sign asset per WO, then join to sign geometry
    # Use DISTINCT ON to get one row per work_order_id
    subq = (
        select(
            WorkOrderAsset.work_order_id,
            *lon_lat_columns(Sign.geometry),
        )
        .join(Sign, Sign.sign_id == WorkOrderAsset.asset_id)
        .where(
            WorkOrderAsset.work_order_id.in_(wo_ids),
            WorkOrderAsset.asset_type == "sign",
        )
        .distinct(WorkOrderAsset.work_order_id)
        .order_by(WorkOrderAsset.work_order_id, WorkOrderAsset.created_at)
    )

    result = await db.execute(subq)
    return {row.work_order_id: (row.lon, row.lat) for row in result.all()}


@router.get("", response_model=WorkOrderListOut)
async def list_work_orders(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    priority: str | None = None,
    work_type: str | None = None,
    assigned_to: uuid.UUID | None = None,
    asset_type: str | None = None,
) -> WorkOrderListOut:
    query = (
        select(
            WorkOrder,
            *lon_lat_columns(WorkOrder.geometry),
        )
        .where(WorkOrder.tenant_id == tenant_id)
        .options(selectinload(WorkOrder.assets))
    )

    if status:
        query = query.where(WorkOrder.status == status)
    if priority:
        query = query.where(WorkOrder.priority == priority)
    if work_type:
        query = query.where(WorkOrder.work_type == work_type)
    if assigned_to:
        query = query.where(WorkOrder.assigned_to == assigned_to)
    if asset_type:
        query = query.where(WorkOrder.asset_type == asset_type)

    rows, total = await paginate(
        db, query, page=page, page_size=page_size,
        order_by=WorkOrder.created_at.desc(),
    )

    # Batch-resolve fallback coordinates for WOs without geometry
    wo_ids_needing_fallback = [
        row.WorkOrder.work_order_id for row in rows if row.lon is None
    ]
    fallback_coords = await _resolve_fallback_coords_for_work_orders(
        wo_ids_needing_fallback, db
    )

    work_orders = []
    for row in rows:
        lon = row.lon
        lat = row.lat
        if lon is None:
            fb = fallback_coords.get(row.WorkOrder.work_order_id)
            if fb:
                lon, lat = fb
        work_orders.append(await wo_to_out(row.WorkOrder, db, lon=lon, lat=lat))

    return WorkOrderListOut(
        work_orders=work_orders, total=total, page=page, page_size=page_size
    )


@router.post("", response_model=WorkOrderOut, status_code=201)
async def create_work_order(
    data: WorkOrderCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    geom = None
    if data.longitude is not None and data.latitude is not None:
        geom = make_point(data.longitude, data.latitude)

    # If support_id is provided, look up support geometry for WO location
    support_signs: list[Sign] = []
    support_obj: SignSupport | None = None
    if data.support_id:
        support_result = await db.execute(
            select(
                SignSupport,
                *lon_lat_columns(SignSupport.geometry),
            ).where(
                SignSupport.support_id == data.support_id,
                SignSupport.tenant_id == tenant_id,
            )
        )
        support_row = support_result.first()
        if not support_row:
            raise HTTPException(status_code=404, detail="Sign support not found")
        support_obj = support_row.SignSupport
        # Use support geometry if WO geometry not provided
        if geom is None:
            geom = make_point(support_row.lon, support_row.lat)
        # Fetch all signs on this support
        signs_result = await db.execute(
            select(Sign).where(
                Sign.support_id == data.support_id,
                Sign.tenant_id == tenant_id,
            )
        )
        support_signs = list(signs_result.scalars().all())

    # Auto-generate work order number
    wo_number = await _generate_work_order_number(tenant_id, db)

    wo = WorkOrder(
        tenant_id=tenant_id,
        work_order_number=wo_number,
        asset_type=data.asset_type,
        asset_id=data.asset_id,
        sign_id=data.sign_id,
        description=data.description,
        work_type=data.work_type,
        priority=data.priority,
        status=data.status,
        category=data.category,
        assigned_to=data.assigned_to,
        supervisor_id=data.supervisor_id,
        requested_by=data.requested_by,
        due_date=data.due_date,
        projected_start_date=data.projected_start_date,
        projected_finish_date=data.projected_finish_date,
        address=data.address,
        location_notes=data.location_notes,
        instructions=data.instructions,
        notes=data.notes,
        custom_fields=data.custom_fields,
        geometry=geom,
    )
    db.add(wo)
    await db.flush()

    # --- Create WorkOrderAsset rows ---
    woa_rows: list[WorkOrderAsset] = []

    # Option 1: support_id provided — create WOA for support + all its signs
    if data.support_id and support_obj:
        woa_support = WorkOrderAsset(
            tenant_id=tenant_id,
            work_order_id=wo.work_order_id,
            asset_type="sign_support",
            asset_id=data.support_id,
            status="pending",
        )
        db.add(woa_support)
        woa_rows.append(woa_support)

        for sign in support_signs:
            woa_sign = WorkOrderAsset(
                tenant_id=tenant_id,
                work_order_id=wo.work_order_id,
                asset_type="sign",
                asset_id=sign.sign_id,
                status="pending",
            )
            db.add(woa_sign)
            woa_rows.append(woa_sign)

    # Option 2: explicit assets list provided
    if data.assets:
        for asset_data in data.assets:
            woa = WorkOrderAsset(
                tenant_id=tenant_id,
                work_order_id=wo.work_order_id,
                asset_type=asset_data.asset_type,
                asset_id=asset_data.asset_id,
                damage_notes=asset_data.damage_notes,
                action_required=asset_data.action_required,
                status="pending",
            )
            db.add(woa)
            woa_rows.append(woa)

    # Option 3: legacy sign_id provided — create a WOA for backward compat
    if data.sign_id and not data.assets and not data.support_id:
        woa_legacy = WorkOrderAsset(
            tenant_id=tenant_id,
            work_order_id=wo.work_order_id,
            asset_type="sign",
            asset_id=data.sign_id,
            status="pending",
        )
        db.add(woa_legacy)
        woa_rows.append(woa_legacy)

    await db.flush()

    # Re-fetch with eager-loaded assets and coordinates
    result = await db.execute(
        select(
            WorkOrder,
            *lon_lat_columns(WorkOrder.geometry),
        )
        .options(selectinload(WorkOrder.assets))
        .where(WorkOrder.work_order_id == wo.work_order_id)
    )
    row = result.first()
    wo = row.WorkOrder
    lon = row.lon
    lat = row.lat

    # Fallback to first linked sign if no WO geometry
    if lon is None and wo.assets:
        fallback = await _resolve_fallback_coords_for_work_orders(
            [wo.work_order_id], db
        )
        fb = fallback.get(wo.work_order_id)
        if fb:
            lon, lat = fb

    return await wo_to_out(wo, db, lon=lon, lat=lat)


@router.get("/{work_order_id}", response_model=WorkOrderOut)
async def get_work_order(
    work_order_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    result = await db.execute(
        select(
            WorkOrder,
            *lon_lat_columns(WorkOrder.geometry),
        )
        .options(selectinload(WorkOrder.assets))
        .where(
            WorkOrder.work_order_id == work_order_id,
            WorkOrder.tenant_id == tenant_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")
    wo = row.WorkOrder
    lon = row.lon
    lat = row.lat

    # Fallback to first linked sign if no WO geometry
    if lon is None and wo.assets:
        fallback = await _resolve_fallback_coords_for_work_orders(
            [wo.work_order_id], db
        )
        fb = fallback.get(wo.work_order_id)
        if fb:
            lon, lat = fb

    return await wo_to_out(wo, db, lon=lon, lat=lat)


@router.put("/{work_order_id}", response_model=WorkOrderOut)
async def update_work_order(
    work_order_id: uuid.UUID,
    data: WorkOrderUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderOut:
    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.assets))
        .where(
            WorkOrder.work_order_id == work_order_id,
            WorkOrder.tenant_id == tenant_id,
        )
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle assets_to_add
    assets_to_add = update_data.pop("assets_to_add", None)
    if assets_to_add:
        for asset_data in assets_to_add:
            woa = WorkOrderAsset(
                tenant_id=tenant_id,
                work_order_id=wo.work_order_id,
                asset_type=asset_data["asset_type"],
                asset_id=asset_data["asset_id"],
                damage_notes=asset_data.get("damage_notes"),
                action_required=asset_data.get("action_required"),
                status="pending",
            )
            db.add(woa)

    # Handle assets_to_remove
    assets_to_remove = update_data.pop("assets_to_remove", None)
    if assets_to_remove:
        for woa_id in assets_to_remove:
            woa_result = await db.execute(
                select(WorkOrderAsset).where(
                    WorkOrderAsset.work_order_asset_id == woa_id,
                    WorkOrderAsset.work_order_id == wo.work_order_id,
                    WorkOrderAsset.tenant_id == tenant_id,
                )
            )
            woa = woa_result.scalar_one_or_none()
            if woa:
                await db.delete(woa)

    # Auto-set completed_date when status changes to completed
    if update_data.get("status") == "completed" and wo.status != "completed":
        wo.completed_date = datetime.now(timezone.utc)
    # Auto-set closed_date when status changes to cancelled
    if update_data.get("status") == "cancelled" and wo.status != "cancelled":
        wo.closed_date = datetime.now(timezone.utc)

    for field, value in update_data.items():
        setattr(wo, field, value)

    await db.flush()

    # Expunge the WO from session identity map so re-fetch gets fresh assets
    wo_id = wo.work_order_id
    db.expunge(wo)
    result = await db.execute(
        select(
            WorkOrder,
            *lon_lat_columns(WorkOrder.geometry),
        )
        .options(selectinload(WorkOrder.assets))
        .where(WorkOrder.work_order_id == wo_id)
    )
    row = result.first()
    wo = row.WorkOrder
    lon = row.lon
    lat = row.lat

    # Fallback to first linked sign if no WO geometry
    if lon is None and wo.assets:
        fallback = await _resolve_fallback_coords_for_work_orders(
            [wo.work_order_id], db
        )
        fb = fallback.get(wo.work_order_id)
        if fb:
            lon, lat = fb

    return await wo_to_out(wo, db, lon=lon, lat=lat)


@router.put("/{work_order_id}/assets/{work_order_asset_id}", response_model=WorkOrderAssetOut)
async def update_work_order_asset(
    work_order_id: uuid.UUID,
    work_order_asset_id: uuid.UUID,
    data: WorkOrderAssetUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderAssetOut:
    """Update per-asset fields on a work order asset (damage_notes, action_required, resolution, status)."""
    result = await db.execute(
        select(WorkOrderAsset).where(
            WorkOrderAsset.work_order_asset_id == work_order_asset_id,
            WorkOrderAsset.work_order_id == work_order_id,
            WorkOrderAsset.tenant_id == tenant_id,
        )
    )
    woa = result.scalar_one_or_none()
    if not woa:
        raise HTTPException(status_code=404, detail="Work order asset not found")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(woa, field, value)

    await db.flush()
    await db.refresh(woa)

    # Get label
    labels = await populate_wo_asset_labels([woa], db)
    return woa_to_out(woa, labels.get(woa.asset_id))


@router.delete("/{work_order_id}", status_code=204)
async def delete_work_order(
    work_order_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a work order with all linked assets."""
    result = await db.execute(
        select(WorkOrder).where(
            WorkOrder.work_order_id == work_order_id,
            WorkOrder.tenant_id == tenant_id,
        )
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    await db.delete(wo)
    audit_log("delete", "work_order", entity_id=work_order_id, tenant_id=tenant_id)
