"""Sewer main CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.sewer import SewerMain
from app.schemas.sewer import (
    SewerMainCreate,
    SewerMainListOut,
    SewerMainOut,
    SewerMainUpdate,
)

from .helpers import _coords_to_linestring_wkt, _linestring_geom_to_coords, _sewer_main_to_out

router = APIRouter()


@router.get("/sewer-mains", response_model=SewerMainListOut, tags=["sewer-mains"])
async def list_sewer_mains(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    system_type: str | None = None,
    material_code: str | None = None,
) -> SewerMainListOut:
    """List sewer mains for the current tenant with optional filters."""
    query = select(SewerMain).where(SewerMain.tenant_id == tenant_id)

    if status:
        query = query.where(SewerMain.status == status)
    if system_type:
        query = query.where(SewerMain.system_type == system_type)
    if material_code:
        query = query.where(SewerMain.material_code == material_code)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(SewerMain.created_at.desc())
    result = await db.execute(query)
    sewer_mains_orm = result.scalars().all()

    sewer_mains = [
        _sewer_main_to_out(sm, _linestring_geom_to_coords(sm.geometry))
        for sm in sewer_mains_orm
    ]

    return SewerMainListOut(
        sewer_mains=sewer_mains, total=total, page=page, page_size=page_size
    )


@router.post("/sewer-mains", response_model=SewerMainOut, status_code=201, tags=["sewer-mains"])
async def create_sewer_main(
    data: SewerMainCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerMainOut:
    """Create a new sewer main with LineString geometry."""
    from geoalchemy2.elements import WKTElement

    wkt = _coords_to_linestring_wkt(data.coordinates)
    geom = WKTElement(wkt, srid=4326)

    sewer_main = SewerMain(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        material_code=data.material_code,
        shape_code=data.shape_code,
        diameter_inches=data.diameter_inches,
        height_inches=data.height_inches,
        width_inches=data.width_inches,
        length_feet=data.length_feet,
        lining_type=data.lining_type,
        lining_date=data.lining_date,
        lining_thickness_mm=data.lining_thickness_mm,
        depth_ft_upstream=data.depth_ft_upstream,
        depth_ft_downstream=data.depth_ft_downstream,
        slope_pct=data.slope_pct,
        upstream_invert_ft=data.upstream_invert_ft,
        downstream_invert_ft=data.downstream_invert_ft,
        upstream_manhole_id=data.upstream_manhole_id,
        downstream_manhole_id=data.downstream_manhole_id,
        system_type=data.system_type,
        owner=data.owner,
        maintained_by=data.maintained_by,
        pacp_grade=data.pacp_grade,
        pacp_structural_score=data.pacp_structural_score,
        pacp_om_score=data.pacp_om_score,
        last_pacp_date=data.last_pacp_date,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        expected_life_years=data.expected_life_years,
        replacement_cost=data.replacement_cost,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(sewer_main)
    await db.flush()

    return _sewer_main_to_out(sewer_main, data.coordinates)


@router.get("/sewer-mains/{sewer_main_id}", response_model=SewerMainOut, tags=["sewer-mains"])
async def get_sewer_main(
    sewer_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerMainOut:
    """Get a single sewer main by ID."""
    result = await db.execute(
        select(SewerMain).where(
            SewerMain.sewer_main_id == sewer_main_id, SewerMain.tenant_id == tenant_id
        )
    )
    sewer_main = result.scalar_one_or_none()
    if not sewer_main:
        raise HTTPException(status_code=404, detail="Sewer main not found")

    return _sewer_main_to_out(sewer_main, _linestring_geom_to_coords(sewer_main.geometry))


@router.put("/sewer-mains/{sewer_main_id}", response_model=SewerMainOut, tags=["sewer-mains"])
async def update_sewer_main(
    sewer_main_id: uuid.UUID,
    data: SewerMainUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerMainOut:
    """Update a sewer main."""
    result = await db.execute(
        select(SewerMain).where(
            SewerMain.sewer_main_id == sewer_main_id, SewerMain.tenant_id == tenant_id
        )
    )
    sewer_main = result.scalar_one_or_none()
    if not sewer_main:
        raise HTTPException(status_code=404, detail="Sewer main not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "coordinates" in update_data:
        coords = update_data.pop("coordinates")
        if coords is not None:
            from geoalchemy2.elements import WKTElement

            wkt = _coords_to_linestring_wkt(coords)
            sewer_main.geometry = WKTElement(wkt, srid=4326)

    for field, value in update_data.items():
        setattr(sewer_main, field, value)

    await db.flush()

    # Re-fetch to get geometry back as coordinates
    result = await db.execute(
        select(SewerMain).where(SewerMain.sewer_main_id == sewer_main_id)
    )
    sewer_main = result.scalar_one()

    return _sewer_main_to_out(sewer_main, _linestring_geom_to_coords(sewer_main.geometry))


@router.delete("/sewer-mains/{sewer_main_id}", status_code=204, tags=["sewer-mains"])
async def delete_sewer_main(
    sewer_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a sewer main."""
    result = await db.execute(
        select(SewerMain).where(
            SewerMain.sewer_main_id == sewer_main_id, SewerMain.tenant_id == tenant_id
        )
    )
    sewer_main = result.scalar_one_or_none()
    if not sewer_main:
        raise HTTPException(status_code=404, detail="Sewer main not found")

    await db.delete(sewer_main)
