import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.inspection import Inspection
from app.schemas.inspection import (
    InspectionCreate,
    InspectionListOut,
    InspectionOut,
)

router = APIRouter()


@router.get("", response_model=InspectionListOut)
async def list_inspections(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    asset_type: str | None = None,
    inspection_type: str | None = None,
    status: str | None = None,
):
    query = select(Inspection).where(Inspection.tenant_id == tenant_id)

    if asset_type:
        query = query.where(Inspection.asset_type == asset_type)
    if inspection_type:
        query = query.where(Inspection.inspection_type == inspection_type)
    if status:
        query = query.where(Inspection.status == status)

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    offset = (page - 1) * page_size
    query = (
        query.offset(offset).limit(page_size).order_by(Inspection.created_at.desc())
    )
    result = await db.execute(query)
    inspections = [
        InspectionOut.model_validate(i) for i in result.scalars().all()
    ]

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

    inspection = Inspection(
        tenant_id=tenant_id,
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

    return InspectionOut.model_validate(inspection)


@router.get("/{inspection_id}", response_model=InspectionOut)
async def get_inspection(
    inspection_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Inspection).where(
            Inspection.inspection_id == inspection_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    inspection = result.scalar_one_or_none()
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return InspectionOut.model_validate(inspection)
