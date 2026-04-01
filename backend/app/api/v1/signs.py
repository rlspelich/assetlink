import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.spatial import lon_lat_columns, make_point
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.inspection_asset import InspectionAsset
from app.models.sign import Sign, SignSupport, SignType
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.inspection import InspectionListOut, InspectionOut
from app.schemas.sign import (
    SignCreate,
    SignImportOut,
    SignListOut,
    SignOut,
    SignTypeOut,
    SignUpdate,
)
from app.schemas.work_order import WorkOrderListOut, WorkOrderOut
from app.services.import_service import import_signs_from_csv

router = APIRouter()


def _sign_to_out(
    sign: Sign,
    lon: float,
    lat: float,
    support_type: str | None = None,
    support_status: str | None = None,
) -> SignOut:
    """Convert a Sign ORM object to the response schema."""
    return SignOut(
        sign_id=sign.sign_id,
        tenant_id=sign.tenant_id,
        support_id=sign.support_id,
        mutcd_code=sign.mutcd_code,
        description=sign.description,
        legend_text=sign.legend_text,
        sign_category=sign.sign_category,
        size_width_inches=sign.size_width_inches,
        size_height_inches=sign.size_height_inches,
        shape=sign.shape,
        background_color=sign.background_color,
        condition_rating=sign.condition_rating,
        road_name=sign.road_name,
        address=sign.address,
        side_of_road=sign.side_of_road,
        intersection_with=sign.intersection_with,
        location_notes=sign.location_notes,
        sheeting_type=sign.sheeting_type,
        sheeting_manufacturer=sign.sheeting_manufacturer,
        expected_life_years=sign.expected_life_years,
        install_date=sign.install_date,
        expected_replacement_date=sign.expected_replacement_date,
        last_measured_date=sign.last_measured_date,
        measured_value=sign.measured_value,
        passes_minimum=sign.passes_minimum,
        last_inspected_date=sign.last_inspected_date,
        last_replaced_date=sign.last_replaced_date,
        replacement_cost_estimate=sign.replacement_cost_estimate,
        status=sign.status,
        facing_direction=sign.facing_direction,
        mount_height_inches=sign.mount_height_inches,
        offset_from_road_inches=sign.offset_from_road_inches,
        custom_fields=sign.custom_fields,
        longitude=lon,
        latitude=lat,
        support_type=support_type,
        support_status=support_status,
        created_at=sign.created_at,
        updated_at=sign.updated_at,
    )


@router.get("", response_model=SignListOut)
async def list_signs(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    road_name: str | None = None,
    mutcd_code: str | None = None,
    sign_category: str | None = None,
) -> SignListOut:
    """List signs for the current tenant with optional filters."""
    query = (
        select(
            Sign,
            *lon_lat_columns(Sign.geometry),
            SignSupport.support_type.label("support_type"),
            SignSupport.status.label("support_status"),
        )
        .outerjoin(SignSupport, Sign.support_id == SignSupport.support_id)
        .where(Sign.tenant_id == tenant_id)
    )

    if status:
        query = query.where(Sign.status == status)
    if road_name:
        query = query.where(Sign.road_name.ilike(f"%{road_name}%"))
    if mutcd_code:
        query = query.where(Sign.mutcd_code == mutcd_code)
    if sign_category:
        query = query.where(Sign.sign_category == sign_category)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Sign.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    signs = [
        _sign_to_out(row.Sign, row.lon, row.lat, row.support_type, row.support_status)
        for row in rows
    ]

    return SignListOut(signs=signs, total=total, page=page, page_size=page_size)


@router.post("/import/csv", response_model=SignImportOut)
async def import_signs_csv(
    file: UploadFile = File(...),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignImportOut:
    """Import signs from a CSV file. Returns per-row results.

    Supports files up to 50 MB and 20,000+ rows. Rows are processed in batches
    of 500 for memory efficiency. The entire import is atomic — if any batch
    fails, all rows are rolled back.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")
    if file.content_type and file.content_type not in (
        "text/csv", "text/plain", "application/csv",
        "application/vnd.ms-excel", "application/octet-stream",
    ):
        raise HTTPException(status_code=400, detail=f"Invalid file type: {file.content_type}. Expected CSV.")

    content = await file.read()
    max_size = settings.max_import_file_size
    if len(content) > max_size:
        max_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Maximum {max_mb} MB.")

    result = await import_signs_from_csv(content, tenant_id, db)

    return SignImportOut(
        created=result.created,
        skipped=result.skipped,
        total_rows=result.total_rows,
        errors=[
            {"row": e.row, "field": e.field, "message": e.message}
            for e in result.errors
        ],
        column_mapping=result.column_mapping,
        unmapped_columns=result.unmapped_columns,
        duration_seconds=result.duration_seconds,
        rows_per_second=result.rows_per_second,
        signs_created=result.signs_created,
        signs_skipped=result.signs_skipped,
        signs_total_rows=result.signs_total_rows,
        supports_created=result.supports_created,
        supports_skipped=result.supports_skipped,
        supports_total_rows=result.supports_total_rows,
        import_mode=result.import_mode,
        support_groups=result.support_groups,
        signs_linked_to_supports=result.signs_linked_to_supports,
        support_column_mapping=result.support_column_mapping,
    )


@router.post("", response_model=SignOut, status_code=201)
async def create_sign(
    data: SignCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignOut:
    """Create a new sign."""
    longitude = data.longitude
    latitude = data.latitude
    support_type = None
    support_status = None

    # If support_id is provided, look up the support
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
        support_type = support_row.SignSupport.support_type
        support_status = support_row.SignSupport.status
        # Inherit geometry from support if not provided
        if longitude is None or latitude is None:
            longitude = support_row.lon
            latitude = support_row.lat

    if longitude is None or latitude is None:
        raise HTTPException(
            status_code=400,
            detail="longitude and latitude are required when no support_id is provided",
        )

    geom = make_point(longitude, latitude)

    sign = Sign(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        support_id=data.support_id,
        mutcd_code=data.mutcd_code,
        description=data.description,
        legend_text=data.legend_text,
        sign_category=data.sign_category,
        size_width_inches=data.size_width_inches,
        size_height_inches=data.size_height_inches,
        shape=data.shape,
        background_color=data.background_color,
        condition_rating=data.condition_rating,
        road_name=data.road_name,
        address=data.address,
        side_of_road=data.side_of_road,
        intersection_with=data.intersection_with,
        location_notes=data.location_notes,
        sheeting_type=data.sheeting_type,
        sheeting_manufacturer=data.sheeting_manufacturer,
        expected_life_years=data.expected_life_years,
        install_date=data.install_date,
        status=data.status,
        facing_direction=data.facing_direction,
        mount_height_inches=data.mount_height_inches,
        custom_fields=data.custom_fields,
        geometry=geom,
    )
    db.add(sign)
    await db.flush()

    return SignOut(
        **{
            k: v
            for k, v in sign.__dict__.items()
            if k
            in SignOut.model_fields
            and k not in ("longitude", "latitude", "support_type", "support_status")
        },
        longitude=longitude,
        latitude=latitude,
        support_type=support_type,
        support_status=support_status,
    )


@router.get("/{sign_id}", response_model=SignOut)
async def get_sign(
    sign_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignOut:
    """Get a single sign by ID."""
    query = (
        select(
            Sign,
            *lon_lat_columns(Sign.geometry),
            SignSupport.support_type.label("support_type"),
            SignSupport.status.label("support_status"),
        )
        .outerjoin(SignSupport, Sign.support_id == SignSupport.support_id)
        .where(Sign.sign_id == sign_id, Sign.tenant_id == tenant_id)
    )

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Sign not found")

    return _sign_to_out(row.Sign, row.lon, row.lat, row.support_type, row.support_status)


@router.put("/{sign_id}", response_model=SignOut)
async def update_sign(
    sign_id: uuid.UUID,
    data: SignUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignOut:
    """Update a sign."""
    result = await db.execute(
        select(Sign).where(Sign.sign_id == sign_id, Sign.tenant_id == tenant_id)
    )
    sign = result.scalar_one_or_none()
    if not sign:
        raise HTTPException(status_code=404, detail="Sign not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        sign.geometry = make_point(lon, lat)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(sign, field, value)

    await db.flush()

    # Re-fetch with coordinates and support info
    query = (
        select(
            Sign,
            *lon_lat_columns(Sign.geometry),
            SignSupport.support_type.label("support_type"),
            SignSupport.status.label("support_status"),
        )
        .outerjoin(SignSupport, Sign.support_id == SignSupport.support_id)
        .where(Sign.sign_id == sign_id)
    )
    result = await db.execute(query)
    row = result.first()

    return _sign_to_out(row.Sign, row.lon, row.lat, row.support_type, row.support_status)


@router.delete("/{sign_id}", status_code=204)
async def delete_sign(
    sign_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a sign."""
    result = await db.execute(
        select(Sign).where(Sign.sign_id == sign_id, Sign.tenant_id == tenant_id)
    )
    sign = result.scalar_one_or_none()
    if not sign:
        raise HTTPException(status_code=404, detail="Sign not found")

    await db.delete(sign)


# --- Work Orders for a Sign ---


@router.get("/{sign_id}/work-orders", response_model=WorkOrderListOut)
async def list_sign_work_orders(
    sign_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
) -> WorkOrderListOut:
    """List work orders linked to a specific sign via the junction table, ordered by created_at desc."""
    # Verify the sign exists and belongs to this tenant
    sign_result = await db.execute(
        select(Sign.sign_id).where(
            Sign.sign_id == sign_id, Sign.tenant_id == tenant_id
        )
    )
    if not sign_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sign not found")

    # Query via the junction table (work_order_asset)
    # Also include legacy sign_id matches for backward compatibility
    junction_wo_ids = (
        select(WorkOrderAsset.work_order_id)
        .where(
            WorkOrderAsset.asset_type == "sign",
            WorkOrderAsset.asset_id == sign_id,
            WorkOrderAsset.tenant_id == tenant_id,
        )
    )
    legacy_wo_ids = (
        select(WorkOrder.work_order_id)
        .where(
            WorkOrder.sign_id == sign_id,
            WorkOrder.tenant_id == tenant_id,
        )
    )
    combined_wo_ids = junction_wo_ids.union(legacy_wo_ids).subquery()

    base_filter = select(WorkOrder).where(
        WorkOrder.work_order_id.in_(select(combined_wo_ids)),
        WorkOrder.tenant_id == tenant_id,
    )

    count_query = select(func.count()).select_from(base_filter.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(
            WorkOrder,
            *lon_lat_columns(WorkOrder.geometry),
        )
        .where(
            WorkOrder.work_order_id.in_(select(combined_wo_ids)),
            WorkOrder.tenant_id == tenant_id,
        )
        .options(selectinload(WorkOrder.assets))
        .offset(offset)
        .limit(page_size)
        .order_by(WorkOrder.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    from app.api.v1.work_orders import _wo_to_out, _resolve_fallback_coords_for_work_orders

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
        work_orders.append(await _wo_to_out(row.WorkOrder, db, lon=lon, lat=lat))

    return WorkOrderListOut(
        work_orders=work_orders, total=total, page=page, page_size=page_size
    )


# --- Inspections for a Sign ---


@router.get("/{sign_id}/inspections", response_model=InspectionListOut)
async def list_sign_inspections(
    sign_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
) -> InspectionListOut:
    """List inspections linked to a specific sign via the junction table."""
    # Verify the sign exists and belongs to this tenant
    sign_result = await db.execute(
        select(Sign.sign_id).where(
            Sign.sign_id == sign_id, Sign.tenant_id == tenant_id
        )
    )
    if not sign_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sign not found")

    # Query via the junction table (inspection_asset)
    junction_insp_ids = (
        select(InspectionAsset.inspection_id)
        .where(
            InspectionAsset.asset_type == "sign",
            InspectionAsset.asset_id == sign_id,
            InspectionAsset.tenant_id == tenant_id,
        )
    )
    # Also include legacy sign_id matches for backward compatibility
    legacy_insp_ids = (
        select(Inspection.inspection_id)
        .where(
            Inspection.sign_id == sign_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    combined_insp_ids = junction_insp_ids.union(legacy_insp_ids).subquery()

    base_filter = select(Inspection).where(
        Inspection.inspection_id.in_(select(combined_insp_ids)),
        Inspection.tenant_id == tenant_id,
    )

    count_query = select(func.count()).select_from(base_filter.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        select(
            Inspection,
            *lon_lat_columns(Inspection.geometry),
        )
        .where(
            Inspection.inspection_id.in_(select(combined_insp_ids)),
            Inspection.tenant_id == tenant_id,
        )
        .options(selectinload(Inspection.assets))
        .offset(offset)
        .limit(page_size)
        .order_by(Inspection.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()

    from app.api.v1.inspections import _inspection_to_out, _resolve_fallback_coords_for_inspections

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


# --- Sign Types (MUTCD lookup) ---


@router.get("/types/all", response_model=list[SignTypeOut])
async def list_sign_types(
    db: AsyncSession = Depends(get_db),
    category: str | None = None,
) -> list[SignTypeOut]:
    """List all MUTCD sign types. Not tenant-specific."""
    query = select(SignType).where(SignType.is_active == True)
    if category:
        query = query.where(SignType.category == category)
    query = query.order_by(SignType.mutcd_code)

    result = await db.execute(query)
    return [SignTypeOut.model_validate(st) for st in result.scalars().all()]
