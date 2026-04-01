"""Force main CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.sewer import ForceMain
from app.schemas.sewer import (
    ForceMainCreate,
    ForceMainListOut,
    ForceMainOut,
    ForceMainUpdate,
)

from .helpers import _coords_to_linestring_wkt, _force_main_to_out, _linestring_geom_to_coords

router = APIRouter()


@router.get("/force-mains", response_model=ForceMainListOut, tags=["sewer-force-mains"])
async def list_force_mains(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    material_code: str | None = None,
) -> ForceMainListOut:
    """List force mains for the current tenant with optional filters."""
    query = select(ForceMain).where(ForceMain.tenant_id == tenant_id)

    if status:
        query = query.where(ForceMain.status == status)
    if material_code:
        query = query.where(ForceMain.material_code == material_code)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(ForceMain.created_at.desc())
    result = await db.execute(query)
    force_mains_orm = result.scalars().all()

    force_mains = [
        _force_main_to_out(fm, _linestring_geom_to_coords(fm.geometry))
        for fm in force_mains_orm
    ]

    return ForceMainListOut(
        force_mains=force_mains, total=total, page=page, page_size=page_size
    )


@router.post("/force-mains", response_model=ForceMainOut, status_code=201, tags=["sewer-force-mains"])
async def create_force_main(
    data: ForceMainCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ForceMainOut:
    """Create a new force main with LineString geometry."""
    from geoalchemy2.elements import WKTElement

    wkt = _coords_to_linestring_wkt(data.coordinates)
    geom = WKTElement(wkt, srid=4326)

    force_main = ForceMain(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        material_code=data.material_code,
        diameter_inches=data.diameter_inches,
        length_feet=data.length_feet,
        pressure_class=data.pressure_class,
        depth_feet=data.depth_feet,
        lift_station_id=data.lift_station_id,
        discharge_manhole_id=data.discharge_manhole_id,
        has_cathodic_protection=data.has_cathodic_protection,
        cp_test_date=data.cp_test_date,
        arv_count=data.arv_count,
        owner=data.owner,
        maintained_by=data.maintained_by,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(force_main)
    await db.flush()

    return _force_main_to_out(force_main, data.coordinates)


@router.get("/force-mains/{force_main_id}", response_model=ForceMainOut, tags=["sewer-force-mains"])
async def get_force_main(
    force_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ForceMainOut:
    """Get a single force main by ID."""
    result = await db.execute(
        select(ForceMain).where(
            ForceMain.force_main_id == force_main_id, ForceMain.tenant_id == tenant_id
        )
    )
    force_main = result.scalar_one_or_none()
    if not force_main:
        raise HTTPException(status_code=404, detail="Force main not found")

    return _force_main_to_out(force_main, _linestring_geom_to_coords(force_main.geometry))


@router.put("/force-mains/{force_main_id}", response_model=ForceMainOut, tags=["sewer-force-mains"])
async def update_force_main(
    force_main_id: uuid.UUID,
    data: ForceMainUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ForceMainOut:
    """Update a force main."""
    result = await db.execute(
        select(ForceMain).where(
            ForceMain.force_main_id == force_main_id, ForceMain.tenant_id == tenant_id
        )
    )
    force_main = result.scalar_one_or_none()
    if not force_main:
        raise HTTPException(status_code=404, detail="Force main not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "coordinates" in update_data:
        coords = update_data.pop("coordinates")
        if coords is not None:
            from geoalchemy2.elements import WKTElement

            wkt = _coords_to_linestring_wkt(coords)
            force_main.geometry = WKTElement(wkt, srid=4326)

    for field, value in update_data.items():
        setattr(force_main, field, value)

    await db.flush()

    # Re-fetch to get geometry back as coordinates
    result = await db.execute(
        select(ForceMain).where(ForceMain.force_main_id == force_main_id)
    )
    force_main = result.scalar_one()

    return _force_main_to_out(force_main, _linestring_geom_to_coords(force_main.geometry))


@router.delete("/force-mains/{force_main_id}", status_code=204, tags=["sewer-force-mains"])
async def delete_force_main(
    force_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a force main."""
    result = await db.execute(
        select(ForceMain).where(
            ForceMain.force_main_id == force_main_id, ForceMain.tenant_id == tenant_id
        )
    )
    force_main = result.scalar_one_or_none()
    if not force_main:
        raise HTTPException(status_code=404, detail="Force main not found")

    await db.delete(force_main)
