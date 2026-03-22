import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.inspection_asset import InspectionAsset
from app.models.sign import Sign, SignSupport, SignType
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.inspection import (
    InspectionAssetOut,
    InspectionCreate,
    InspectionListOut,
    InspectionOut,
    InspectionUpdate,
)
from app.schemas.work_order import WorkOrderOut
from app.schemas.work_order_asset import WorkOrderAssetOut

router = APIRouter()


# --- Helper functions ---


async def _populate_asset_labels(
    ia_list: list[InspectionAsset], db: AsyncSession
) -> dict[uuid.UUID, str]:
    """
    Build asset_label for each InspectionAsset.

    Signs: "R1-1 — Stop Sign" (mutcd_code — sign_type description)
    Supports: "U Channel Support" (support_type formatted)
    """
    labels: dict[uuid.UUID, str] = {}
    if not ia_list:
        return labels

    sign_ids = [ia.asset_id for ia in ia_list if ia.asset_type == "sign"]
    support_ids = [ia.asset_id for ia in ia_list if ia.asset_type == "sign_support"]

    if sign_ids:
        result = await db.execute(
            select(Sign.sign_id, Sign.mutcd_code, SignType.description)
            .outerjoin(SignType, Sign.mutcd_code == SignType.mutcd_code)
            .where(Sign.sign_id.in_(sign_ids))
        )
        for row in result.all():
            if row.mutcd_code and row.description:
                labels[row.sign_id] = f"{row.mutcd_code} \u2014 {row.description}"
            elif row.mutcd_code:
                labels[row.sign_id] = row.mutcd_code
            else:
                labels[row.sign_id] = "Sign (no MUTCD code)"

    if support_ids:
        result = await db.execute(
            select(SignSupport.support_id, SignSupport.support_type)
            .where(SignSupport.support_id.in_(support_ids))
        )
        for row in result.all():
            label = row.support_type.replace("_", " ").title() + " Support"
            labels[row.support_id] = label

    return labels


def _ia_to_out(ia: InspectionAsset, label: str | None = None) -> InspectionAssetOut:
    """Convert an InspectionAsset ORM object to the response schema."""
    return InspectionAssetOut(
        inspection_asset_id=ia.inspection_asset_id,
        inspection_id=ia.inspection_id,
        tenant_id=ia.tenant_id,
        asset_type=ia.asset_type,
        asset_id=ia.asset_id,
        condition_rating=ia.condition_rating,
        findings=ia.findings,
        defects=ia.defects,
        retroreflectivity_value=float(ia.retroreflectivity_value) if ia.retroreflectivity_value is not None else None,
        passes_minimum_retro=ia.passes_minimum_retro,
        action_recommended=ia.action_recommended,
        status=ia.status,
        asset_label=label,
        created_at=ia.created_at,
        updated_at=ia.updated_at,
    )


async def _inspection_to_out(
    insp: Inspection,
    db: AsyncSession,
    lon: float | None = None,
    lat: float | None = None,
) -> InspectionOut:
    """Convert an Inspection ORM object to InspectionOut, including asset labels."""
    assets_out = []
    if insp.assets:
        labels = await _populate_asset_labels(insp.assets, db)
        assets_out = [
            _ia_to_out(ia, labels.get(ia.asset_id))
            for ia in insp.assets
        ]

    return InspectionOut(
        inspection_id=insp.inspection_id,
        tenant_id=insp.tenant_id,
        asset_type=insp.asset_type,
        asset_id=insp.asset_id,
        sign_id=insp.sign_id,
        work_order_id=insp.work_order_id,
        inspection_type=insp.inspection_type,
        inspection_date=insp.inspection_date,
        inspector_id=insp.inspector_id,
        status=insp.status,
        condition_rating=insp.condition_rating,
        findings=insp.findings,
        defects=insp.defects,
        recommendations=insp.recommendations,
        repairs_made=insp.repairs_made,
        retroreflectivity_value=float(insp.retroreflectivity_value) if insp.retroreflectivity_value is not None else None,
        passes_minimum_retro=insp.passes_minimum_retro,
        follow_up_required=insp.follow_up_required,
        follow_up_work_order_id=insp.follow_up_work_order_id,
        custom_fields=insp.custom_fields,
        longitude=lon,
        latitude=lat,
        assets=assets_out,
        created_at=insp.created_at,
        updated_at=insp.updated_at,
    )


async def _resolve_fallback_coords_for_inspections(
    insp_ids: list[uuid.UUID], db: AsyncSession
) -> dict[uuid.UUID, tuple[float, float]]:
    """
    For inspections without geometry, resolve lon/lat from the first linked
    sign via inspection_asset. Returns {inspection_id: (lon, lat)}.
    Batch query — no N+1.
    """
    if not insp_ids:
        return {}

    subq = (
        select(
            InspectionAsset.inspection_id,
            func.ST_X(Sign.geometry).label("lon"),
            func.ST_Y(Sign.geometry).label("lat"),
        )
        .join(Sign, Sign.sign_id == InspectionAsset.asset_id)
        .where(
            InspectionAsset.inspection_id.in_(insp_ids),
            InspectionAsset.asset_type == "sign",
        )
        .distinct(InspectionAsset.inspection_id)
        .order_by(InspectionAsset.inspection_id, InspectionAsset.created_at)
    )

    result = await db.execute(subq)
    return {row.inspection_id: (row.lon, row.lat) for row in result.all()}


async def _update_signs_from_inspection_assets(
    ia_list: list[InspectionAsset],
    inspection_date: date,
    db: AsyncSession,
) -> None:
    """
    Update sign records from per-asset inspection data.
    This is the source of truth for sign condition — the inspection IS the data.
    """
    sign_assets = [ia for ia in ia_list if ia.asset_type == "sign"]
    if not sign_assets:
        return

    sign_ids = [ia.asset_id for ia in sign_assets]
    result = await db.execute(
        select(Sign).where(Sign.sign_id.in_(sign_ids))
    )
    signs_by_id = {s.sign_id: s for s in result.scalars().all()}

    for ia in sign_assets:
        sign = signs_by_id.get(ia.asset_id)
        if not sign:
            continue

        # Update condition rating
        if ia.condition_rating is not None:
            sign.condition_rating = ia.condition_rating

        # Update last inspected date
        sign.last_inspected_date = inspection_date

        # Update retroreflectivity data
        if ia.retroreflectivity_value is not None:
            sign.measured_value = ia.retroreflectivity_value
            sign.last_measured_date = inspection_date
        if ia.passes_minimum_retro is not None:
            sign.passes_minimum = ia.passes_minimum_retro


# --- Generate inspection and WO numbers ---


async def _generate_inspection_number(
    tenant_id: uuid.UUID, db: AsyncSession
) -> str:
    """Generate INS-YYYYMMDD-NNN sequential number per tenant per day."""
    today = date.today()
    prefix = f"INS-{today.strftime('%Y%m%d')}-"

    result = await db.execute(
        select(Inspection.inspection_number)
        .where(
            Inspection.tenant_id == tenant_id,
            Inspection.inspection_number.like(f"{prefix}%"),
        )
        .order_by(Inspection.inspection_number.desc())
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


async def _generate_work_order_number(
    tenant_id: uuid.UUID, db: AsyncSession
) -> str:
    """Generate WO-YYYYMMDD-NNN sequential number per tenant per day."""
    today = date.today()
    prefix = f"WO-{today.strftime('%Y%m%d')}-"

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


# --- Endpoints ---


@router.get("", response_model=InspectionListOut)
async def list_inspections(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    asset_type: str | None = None,
    inspection_type: str | None = None,
    status: str | None = None,
    follow_up_required: bool | None = None,
):
    base_query = select(Inspection).where(Inspection.tenant_id == tenant_id)

    if asset_type:
        base_query = base_query.where(Inspection.asset_type == asset_type)
    if inspection_type:
        base_query = base_query.where(Inspection.inspection_type == inspection_type)
    if status:
        base_query = base_query.where(Inspection.status == status)
    if follow_up_required is not None:
        base_query = base_query.where(Inspection.follow_up_required == follow_up_required)

    count_query = select(func.count()).select_from(base_query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(
            Inspection,
            func.ST_X(Inspection.geometry).label("lon"),
            func.ST_Y(Inspection.geometry).label("lat"),
        )
        .where(Inspection.tenant_id == tenant_id)
    )
    # Re-apply filters
    if asset_type:
        query = query.where(Inspection.asset_type == asset_type)
    if inspection_type:
        query = query.where(Inspection.inspection_type == inspection_type)
    if status:
        query = query.where(Inspection.status == status)
    if follow_up_required is not None:
        query = query.where(Inspection.follow_up_required == follow_up_required)

    query = (
        query.options(selectinload(Inspection.assets))
        .offset(offset)
        .limit(page_size)
        .order_by(Inspection.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    # Batch-resolve fallback coordinates for inspections without geometry
    insp_ids_needing_fallback = [
        row.Inspection.inspection_id for row in rows if row.lon is None
    ]
    fallback_coords = await _resolve_fallback_coords_for_inspections(
        insp_ids_needing_fallback, db
    )

    inspections = []
    for row in rows:
        lon = row.lon
        lat = row.lat
        if lon is None:
            fb = fallback_coords.get(row.Inspection.inspection_id)
            if fb:
                lon, lat = fb
        inspections.append(await _inspection_to_out(row.Inspection, db, lon=lon, lat=lat))

    return InspectionListOut(
        inspections=inspections, total=total, page=page, page_size=page_size
    )


@router.post("", response_model=InspectionOut, status_code=201)
async def create_inspection(
    data: InspectionCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    geom = None
    if data.longitude is not None and data.latitude is not None:
        geom = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)

    # If support_id is provided, look up support geometry for inspection location
    support_signs: list[Sign] = []
    support_obj: SignSupport | None = None
    if data.support_id:
        support_result = await db.execute(
            select(
                SignSupport,
                func.ST_X(SignSupport.geometry).label("lon"),
                func.ST_Y(SignSupport.geometry).label("lat"),
            ).where(
                SignSupport.support_id == data.support_id,
                SignSupport.tenant_id == tenant_id,
            )
        )
        support_row = support_result.first()
        if not support_row:
            raise HTTPException(status_code=404, detail="Sign support not found")
        support_obj = support_row.SignSupport
        # Use support geometry if inspection geometry not provided
        if geom is None:
            geom = func.ST_SetSRID(
                func.ST_MakePoint(support_row.lon, support_row.lat), 4326
            )
        # Fetch all signs on this support
        signs_result = await db.execute(
            select(Sign).where(
                Sign.support_id == data.support_id,
                Sign.tenant_id == tenant_id,
            )
        )
        support_signs = list(signs_result.scalars().all())

    inspection_number = await _generate_inspection_number(tenant_id, db)

    inspection = Inspection(
        tenant_id=tenant_id,
        inspection_number=inspection_number,
        asset_type=data.asset_type,
        asset_id=data.asset_id,
        sign_id=data.sign_id,
        work_order_id=data.work_order_id,
        inspection_type=data.inspection_type,
        inspection_date=data.inspection_date,
        inspector_id=data.inspector_id,
        status=data.status,
        condition_rating=data.condition_rating,
        findings=data.findings,
        defects=data.defects,
        recommendations=data.recommendations,
        repairs_made=data.repairs_made,
        retroreflectivity_value=data.retroreflectivity_value,
        passes_minimum_retro=data.passes_minimum_retro,
        follow_up_required=data.follow_up_required,
        custom_fields=data.custom_fields,
        geometry=geom,
    )
    db.add(inspection)
    await db.flush()

    # --- Create InspectionAsset rows ---
    ia_rows: list[InspectionAsset] = []

    # Option 1: support_id provided — create IA for support + all its signs
    if data.support_id and support_obj:
        ia_support = InspectionAsset(
            tenant_id=tenant_id,
            inspection_id=inspection.inspection_id,
            asset_type="sign_support",
            asset_id=data.support_id,
            status="inspected",
        )
        db.add(ia_support)
        ia_rows.append(ia_support)

        for sign in support_signs:
            ia_sign = InspectionAsset(
                tenant_id=tenant_id,
                inspection_id=inspection.inspection_id,
                asset_type="sign",
                asset_id=sign.sign_id,
                status="inspected",
            )
            db.add(ia_sign)
            ia_rows.append(ia_sign)

    # Option 2: explicit assets list provided
    if data.assets:
        for asset_data in data.assets:
            ia = InspectionAsset(
                tenant_id=tenant_id,
                inspection_id=inspection.inspection_id,
                asset_type=asset_data.asset_type,
                asset_id=asset_data.asset_id,
                condition_rating=asset_data.condition_rating,
                findings=asset_data.findings,
                defects=asset_data.defects,
                retroreflectivity_value=asset_data.retroreflectivity_value,
                passes_minimum_retro=asset_data.passes_minimum_retro,
                action_recommended=asset_data.action_recommended,
                status=asset_data.status,
            )
            db.add(ia)
            ia_rows.append(ia)

    # Option 3: legacy sign_id provided — create an IA for backward compat
    if data.sign_id and not data.assets and not data.support_id:
        ia_legacy = InspectionAsset(
            tenant_id=tenant_id,
            inspection_id=inspection.inspection_id,
            asset_type="sign",
            asset_id=data.sign_id,
            condition_rating=data.condition_rating,
            findings=data.findings,
            retroreflectivity_value=data.retroreflectivity_value,
            passes_minimum_retro=data.passes_minimum_retro,
            status="inspected",
        )
        db.add(ia_legacy)
        ia_rows.append(ia_legacy)

    await db.flush()

    # --- Auto-update signs from inspection data ---
    if ia_rows:
        await _update_signs_from_inspection_assets(
            ia_rows, data.inspection_date, db
        )
        await db.flush()

    # Re-fetch with eager-loaded assets and coordinates
    result = await db.execute(
        select(
            Inspection,
            func.ST_X(Inspection.geometry).label("lon"),
            func.ST_Y(Inspection.geometry).label("lat"),
        )
        .options(selectinload(Inspection.assets))
        .where(Inspection.inspection_id == inspection.inspection_id)
    )
    row = result.first()
    inspection = row.Inspection
    lon = row.lon
    lat = row.lat

    # Fallback to first linked sign if no inspection geometry
    if lon is None and inspection.assets:
        fallback = await _resolve_fallback_coords_for_inspections(
            [inspection.inspection_id], db
        )
        fb = fallback.get(inspection.inspection_id)
        if fb:
            lon, lat = fb

    return await _inspection_to_out(inspection, db, lon=lon, lat=lat)


@router.get("/{inspection_id}", response_model=InspectionOut)
async def get_inspection(
    inspection_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(
            Inspection,
            func.ST_X(Inspection.geometry).label("lon"),
            func.ST_Y(Inspection.geometry).label("lat"),
        )
        .options(selectinload(Inspection.assets))
        .where(
            Inspection.inspection_id == inspection_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Inspection not found")
    inspection = row.Inspection
    lon = row.lon
    lat = row.lat

    # Fallback to first linked sign if no inspection geometry
    if lon is None and inspection.assets:
        fallback = await _resolve_fallback_coords_for_inspections(
            [inspection.inspection_id], db
        )
        fb = fallback.get(inspection.inspection_id)
        if fb:
            lon, lat = fb

    return await _inspection_to_out(inspection, db, lon=lon, lat=lat)


@router.put("/{inspection_id}", response_model=InspectionOut)
async def update_inspection(
    inspection_id: uuid.UUID,
    data: InspectionUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.assets))
        .where(
            Inspection.inspection_id == inspection_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle assets_to_add
    assets_to_add = update_data.pop("assets_to_add", None)
    new_ia_rows: list[InspectionAsset] = []
    if assets_to_add:
        for asset_data in assets_to_add:
            ia = InspectionAsset(
                tenant_id=tenant_id,
                inspection_id=inspection.inspection_id,
                asset_type=asset_data["asset_type"],
                asset_id=asset_data["asset_id"],
                condition_rating=asset_data.get("condition_rating"),
                findings=asset_data.get("findings"),
                defects=asset_data.get("defects"),
                retroreflectivity_value=asset_data.get("retroreflectivity_value"),
                passes_minimum_retro=asset_data.get("passes_minimum_retro"),
                action_recommended=asset_data.get("action_recommended"),
                status=asset_data.get("status", "inspected"),
            )
            db.add(ia)
            new_ia_rows.append(ia)

    # Handle assets_to_remove
    assets_to_remove = update_data.pop("assets_to_remove", None)
    if assets_to_remove:
        for ia_id in assets_to_remove:
            ia_result = await db.execute(
                select(InspectionAsset).where(
                    InspectionAsset.inspection_asset_id == ia_id,
                    InspectionAsset.inspection_id == inspection.inspection_id,
                    InspectionAsset.tenant_id == tenant_id,
                )
            )
            ia = ia_result.scalar_one_or_none()
            if ia:
                await db.delete(ia)

    for field, value in update_data.items():
        setattr(inspection, field, value)

    await db.flush()

    # Auto-update signs from new inspection asset data
    if new_ia_rows:
        insp_date = data.inspection_date or inspection.inspection_date
        await _update_signs_from_inspection_assets(new_ia_rows, insp_date, db)
        await db.flush()

    # Re-fetch with fresh assets and coordinates
    insp_id = inspection.inspection_id
    db.expunge(inspection)
    result = await db.execute(
        select(
            Inspection,
            func.ST_X(Inspection.geometry).label("lon"),
            func.ST_Y(Inspection.geometry).label("lat"),
        )
        .options(selectinload(Inspection.assets))
        .where(Inspection.inspection_id == insp_id)
    )
    row = result.first()
    inspection = row.Inspection
    lon = row.lon
    lat = row.lat

    # Fallback to first linked sign if no inspection geometry
    if lon is None and inspection.assets:
        fallback = await _resolve_fallback_coords_for_inspections(
            [inspection.inspection_id], db
        )
        fb = fallback.get(inspection.inspection_id)
        if fb:
            lon, lat = fb

    return await _inspection_to_out(inspection, db, lon=lon, lat=lat)


@router.delete("/{inspection_id}", status_code=204)
async def delete_inspection(
    inspection_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete an inspection. Only open or cancelled inspections can be deleted."""
    result = await db.execute(
        select(Inspection).where(
            Inspection.inspection_id == inspection_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    if inspection.status not in ("open", "cancelled"):
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete inspection in '{inspection.status}' status. Only open or cancelled inspections can be deleted.",
        )

    await db.delete(inspection)


@router.post("/{inspection_id}/create-work-order", response_model=WorkOrderOut, status_code=201)
async def create_work_order_from_inspection(
    inspection_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """
    Create a work order pre-filled from an inspection.

    Copies assets where action_recommended != 'ok', sets priority from
    worst condition rating, and links the inspection to the new WO.
    """
    result = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.assets))
        .where(
            Inspection.inspection_id == inspection_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")

    if inspection.follow_up_work_order_id:
        raise HTTPException(
            status_code=409,
            detail="This inspection already has a linked work order.",
        )

    # Filter assets that need action (exclude 'ok')
    actionable_assets = [
        ia for ia in inspection.assets
        if ia.action_recommended and ia.action_recommended != "ok"
    ]

    # Build description from findings
    description_parts = []
    if inspection.findings:
        description_parts.append(inspection.findings)
    if inspection.recommendations:
        description_parts.append(f"Recommendation: {inspection.recommendations}")
    description = " | ".join(description_parts) if description_parts else f"Follow-up from inspection on {inspection.inspection_date}"

    # Determine priority from worst condition rating across assets
    condition_ratings = [
        ia.condition_rating for ia in inspection.assets
        if ia.condition_rating is not None
    ]
    if inspection.condition_rating is not None:
        condition_ratings.append(inspection.condition_rating)

    if condition_ratings:
        worst = min(condition_ratings)
        if worst <= 2:
            priority = "urgent"
        elif worst == 3:
            priority = "routine"
        else:
            priority = "planned"
    else:
        priority = "routine"

    # Determine work_type from action recommendations
    actions = [ia.action_recommended for ia in actionable_assets if ia.action_recommended]
    if "replace" in actions:
        work_type = "replacement"
    elif "repair" in actions:
        work_type = "repair"
    else:
        work_type = "repair"

    # Get address from first linked sign
    address = None
    sign_assets = [ia for ia in inspection.assets if ia.asset_type == "sign"]
    if sign_assets:
        sign_result = await db.execute(
            select(Sign.road_name, Sign.address).where(
                Sign.sign_id == sign_assets[0].asset_id
            )
        )
        sign_row = sign_result.first()
        if sign_row:
            address = sign_row.address or sign_row.road_name

    # Generate WO number
    wo_number = await _generate_work_order_number(tenant_id, db)

    # Create the work order
    wo = WorkOrder(
        tenant_id=tenant_id,
        work_order_number=wo_number,
        description=description,
        work_type=work_type,
        priority=priority,
        status="open",
        address=address,
        notes=f"Created from inspection {inspection_id}",
        geometry=inspection.geometry,
    )
    db.add(wo)
    await db.flush()

    # Create WorkOrderAsset rows from actionable inspection assets
    for ia in actionable_assets:
        woa = WorkOrderAsset(
            tenant_id=tenant_id,
            work_order_id=wo.work_order_id,
            asset_type=ia.asset_type,
            asset_id=ia.asset_id,
            action_required=ia.action_recommended,
            damage_notes=ia.findings,
            status="pending",
        )
        db.add(woa)

    # If no actionable assets but inspection has assets, copy all for reference
    if not actionable_assets and inspection.assets:
        for ia in inspection.assets:
            woa = WorkOrderAsset(
                tenant_id=tenant_id,
                work_order_id=wo.work_order_id,
                asset_type=ia.asset_type,
                asset_id=ia.asset_id,
                action_required=ia.action_recommended or "inspect",
                damage_notes=ia.findings,
                status="pending",
            )
            db.add(woa)

    # Update inspection with follow-up link
    inspection.follow_up_required = True
    inspection.follow_up_work_order_id = wo.work_order_id

    await db.flush()

    # Re-fetch WO with assets and coordinates
    result = await db.execute(
        select(
            WorkOrder,
            func.ST_X(WorkOrder.geometry).label("lon"),
            func.ST_Y(WorkOrder.geometry).label("lat"),
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
        from app.api.v1.work_orders import _resolve_fallback_coords_for_work_orders
        fallback = await _resolve_fallback_coords_for_work_orders(
            [wo.work_order_id], db
        )
        fb = fallback.get(wo.work_order_id)
        if fb:
            lon, lat = fb

    # Build response with asset labels
    from app.api.v1.work_orders import _wo_to_out
    return await _wo_to_out(wo, db, lon=lon, lat=lat)
