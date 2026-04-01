import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.inspection_asset import InspectionAsset
from app.models.sign import Sign, SignSupport
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.inspection import InspectionListOut, InspectionOut
from app.schemas.sign import SignImportOut, SignOut
from app.schemas.work_order import WorkOrderListOut, WorkOrderOut
from app.schemas.support import (
    SignSupportCreate,
    SignSupportDetailOut,
    SignSupportListOut,
    SignSupportOut,
    SignSupportUpdate,
)
from app.db.spatial import lon_lat_columns, make_point
from app.services.import_service import import_supports_from_csv

router = APIRouter()


def _support_to_out(
    support: SignSupport, lon: float, lat: float, sign_count: int = 0
) -> SignSupportOut:
    """Convert a SignSupport ORM object to the response schema."""
    return SignSupportOut(
        support_id=support.support_id,
        tenant_id=support.tenant_id,
        support_type=support.support_type,
        support_material=support.support_material,
        install_date=support.install_date,
        condition_rating=support.condition_rating,
        height_inches=float(support.height_inches) if support.height_inches is not None else None,
        status=support.status,
        notes=support.notes,
        longitude=lon,
        latitude=lat,
        sign_count=sign_count,
        created_at=support.created_at,
        updated_at=support.updated_at,
    )


@router.get("", response_model=SignSupportListOut)
async def list_supports(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    support_type: str | None = None,
) -> SignSupportListOut:
    """List sign supports for the current tenant with optional filters."""
    # Subquery for sign count per support
    sign_count_subq = (
        select(
            Sign.support_id,
            func.count(Sign.sign_id).label("sign_count"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(Sign.support_id)
        .subquery()
    )

    query = (
        select(
            SignSupport,
            *lon_lat_columns(SignSupport.geometry),
            func.coalesce(sign_count_subq.c.sign_count, 0).label("sign_count"),
        )
        .outerjoin(sign_count_subq, SignSupport.support_id == sign_count_subq.c.support_id)
        .where(SignSupport.tenant_id == tenant_id)
    )

    if status:
        query = query.where(SignSupport.status == status)
    if support_type:
        query = query.where(SignSupport.support_type == support_type)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(SignSupport.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    supports = [
        _support_to_out(row.SignSupport, row.lon, row.lat, row.sign_count)
        for row in rows
    ]

    return SignSupportListOut(supports=supports, total=total, page=page, page_size=page_size)


@router.post("", response_model=SignSupportOut, status_code=201)
async def create_support(
    data: SignSupportCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignSupportOut:
    """Create a new sign support."""
    geom = make_point(data.longitude, data.latitude)

    support = SignSupport(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        support_type=data.support_type,
        support_material=data.support_material,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        height_inches=data.height_inches,
        status=data.status,
        notes=data.notes,
        geometry=geom,
    )
    db.add(support)
    await db.flush()

    return SignSupportOut(
        support_id=support.support_id,
        tenant_id=support.tenant_id,
        support_type=support.support_type,
        support_material=support.support_material,
        install_date=support.install_date,
        condition_rating=support.condition_rating,
        height_inches=float(support.height_inches) if support.height_inches is not None else None,
        status=support.status,
        notes=support.notes,
        longitude=data.longitude,
        latitude=data.latitude,
        sign_count=0,
        created_at=support.created_at,
        updated_at=support.updated_at,
    )


@router.get("/{support_id}", response_model=SignSupportDetailOut)
async def get_support(
    support_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignSupportDetailOut:
    """Get a single sign support by ID, including all attached signs."""
    # Fetch support with coordinates
    query = select(
        SignSupport,
        *lon_lat_columns(SignSupport.geometry),
    ).where(SignSupport.support_id == support_id, SignSupport.tenant_id == tenant_id)

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Sign support not found")

    support = row.SignSupport

    # Fetch attached signs
    signs_query = select(
        Sign,
        *lon_lat_columns(Sign.geometry),
    ).where(Sign.support_id == support_id, Sign.tenant_id == tenant_id)

    signs_result = await db.execute(signs_query)
    sign_rows = signs_result.all()

    signs_out = [_sign_to_out(sr.Sign, sr.lon, sr.lat) for sr in sign_rows]

    return SignSupportDetailOut(
        support_id=support.support_id,
        tenant_id=support.tenant_id,
        support_type=support.support_type,
        support_material=support.support_material,
        install_date=support.install_date,
        condition_rating=support.condition_rating,
        height_inches=float(support.height_inches) if support.height_inches is not None else None,
        status=support.status,
        notes=support.notes,
        longitude=row.lon,
        latitude=row.lat,
        sign_count=len(signs_out),
        created_at=support.created_at,
        updated_at=support.updated_at,
        signs=signs_out,
    )


@router.put("/{support_id}", response_model=SignSupportOut)
async def update_support(
    support_id: uuid.UUID,
    data: SignSupportUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignSupportOut:
    """Update a sign support."""
    result = await db.execute(
        select(SignSupport).where(
            SignSupport.support_id == support_id, SignSupport.tenant_id == tenant_id
        )
    )
    support = result.scalar_one_or_none()
    if not support:
        raise HTTPException(status_code=404, detail="Sign support not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        support.geometry = make_point(lon, lat)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(support, field, value)

    await db.flush()

    # Re-fetch with coordinates and sign count
    sign_count_subq = (
        select(func.count(Sign.sign_id).label("sign_count"))
        .where(Sign.support_id == support_id, Sign.tenant_id == tenant_id)
        .scalar_subquery()
    )

    query = select(
        SignSupport,
        *lon_lat_columns(SignSupport.geometry),
        func.coalesce(sign_count_subq, 0).label("sign_count"),
    ).where(SignSupport.support_id == support_id)
    result = await db.execute(query)
    row = result.first()

    return _support_to_out(row.SignSupport, row.lon, row.lat, row.sign_count)


@router.delete("/{support_id}", status_code=204)
async def delete_support(
    support_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a sign support. Fails with 409 if signs are still attached."""
    result = await db.execute(
        select(SignSupport).where(
            SignSupport.support_id == support_id, SignSupport.tenant_id == tenant_id
        )
    )
    support = result.scalar_one_or_none()
    if not support:
        raise HTTPException(status_code=404, detail="Sign support not found")

    # Check for attached signs
    sign_count = (
        await db.execute(
            select(func.count(Sign.sign_id)).where(
                Sign.support_id == support_id, Sign.tenant_id == tenant_id
            )
        )
    ).scalar_one()

    if sign_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete support with {sign_count} attached sign(s). "
            "Remove or reassign signs first.",
        )

    await db.delete(support)


@router.get("/{support_id}/signs", response_model=list[SignOut])
async def list_support_signs(
    support_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> list[SignOut]:
    """List all signs attached to a specific support."""
    # Verify support exists and belongs to tenant
    support_result = await db.execute(
        select(SignSupport.support_id).where(
            SignSupport.support_id == support_id, SignSupport.tenant_id == tenant_id
        )
    )
    if not support_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sign support not found")

    query = select(
        Sign,
        *lon_lat_columns(Sign.geometry),
    ).where(Sign.support_id == support_id, Sign.tenant_id == tenant_id)

    result = await db.execute(query)
    rows = result.all()

    return [_sign_to_out(row.Sign, row.lon, row.lat) for row in rows]


@router.get("/{support_id}/work-orders", response_model=WorkOrderListOut)
async def list_support_work_orders(
    support_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
) -> WorkOrderListOut:
    """List work orders linked to a specific support via the junction table."""
    # Verify support exists and belongs to tenant
    support_result = await db.execute(
        select(SignSupport.support_id).where(
            SignSupport.support_id == support_id, SignSupport.tenant_id == tenant_id
        )
    )
    if not support_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sign support not found")

    # Query via the junction table
    junction_wo_ids = (
        select(WorkOrderAsset.work_order_id)
        .where(
            WorkOrderAsset.asset_type == "sign_support",
            WorkOrderAsset.asset_id == support_id,
            WorkOrderAsset.tenant_id == tenant_id,
        )
    ).subquery()

    query = select(WorkOrder).where(
        WorkOrder.work_order_id.in_(select(junction_wo_ids)),
        WorkOrder.tenant_id == tenant_id,
    )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(WorkOrder.created_at.desc())
    result = await db.execute(query)
    work_orders = [
        WorkOrderOut.model_validate(wo) for wo in result.scalars().all()
    ]

    return WorkOrderListOut(
        work_orders=work_orders, total=total, page=page, page_size=page_size
    )


@router.get("/{support_id}/inspections", response_model=InspectionListOut)
async def list_support_inspections(
    support_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
) -> InspectionListOut:
    """List inspections linked to a specific support via the junction table."""
    # Verify support exists and belongs to tenant
    support_result = await db.execute(
        select(SignSupport.support_id).where(
            SignSupport.support_id == support_id, SignSupport.tenant_id == tenant_id
        )
    )
    if not support_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Sign support not found")

    # Query via the junction table
    junction_insp_ids = (
        select(InspectionAsset.inspection_id)
        .where(
            InspectionAsset.asset_type == "sign_support",
            InspectionAsset.asset_id == support_id,
            InspectionAsset.tenant_id == tenant_id,
        )
    ).subquery()

    query = select(Inspection).where(
        Inspection.inspection_id.in_(select(junction_insp_ids)),
        Inspection.tenant_id == tenant_id,
    )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Inspection.created_at.desc())
    result = await db.execute(query)
    inspections = [
        InspectionOut.model_validate(i) for i in result.scalars().all()
    ]

    return InspectionListOut(
        inspections=inspections, total=total, page=page, page_size=page_size
    )


@router.post("/import/csv", response_model=SignImportOut)
async def import_supports_csv(
    file: UploadFile = File(...),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SignImportOut:
    """Import sign supports from a CSV file. Returns per-row results.

    Supports files up to 50 MB. Rows are processed in batches of 500.
    The entire import is atomic.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a .csv")

    content = await file.read()
    max_size = settings.max_import_file_size
    if len(content) > max_size:
        max_mb = max_size // (1024 * 1024)
        raise HTTPException(status_code=400, detail=f"File too large. Maximum {max_mb} MB.")

    result = await import_supports_from_csv(content, tenant_id, db)

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


def _sign_to_out(sign: Sign, lon: float, lat: float) -> SignOut:
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
        created_at=sign.created_at,
        updated_at=sign.updated_at,
    )
