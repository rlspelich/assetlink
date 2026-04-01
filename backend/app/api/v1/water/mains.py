"""Water main CRUD routes (LineString geometry)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.water import WaterMain

from .helpers import (
    WaterMainCreate,
    WaterMainListOut,
    WaterMainOut,
    WaterMainUpdate,
    _coords_to_linestring_wkt,
    _extract_linestring_coords,
    _water_main_to_out,
)

router = APIRouter()


@router.get("/water-mains", response_model=WaterMainListOut, tags=["water-mains"])
async def list_water_mains(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    material_code: str | None = None,
    pressure_zone_id: uuid.UUID | None = None,
) -> WaterMainListOut:
    """List water mains for the current tenant with optional filters."""
    query = select(WaterMain).where(WaterMain.tenant_id == tenant_id)

    if status:
        query = query.where(WaterMain.status == status)
    if material_code:
        query = query.where(WaterMain.material_code == material_code)
    if pressure_zone_id:
        query = query.where(WaterMain.pressure_zone_id == pressure_zone_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(WaterMain.created_at.desc())
    result = await db.execute(query)
    rows = result.scalars().all()

    water_mains = [
        _water_main_to_out(main, _extract_linestring_coords(main.geometry))
        for main in rows
    ]

    return WaterMainListOut(
        water_mains=water_mains, total=total, page=page, page_size=page_size
    )


@router.post("/water-mains", response_model=WaterMainOut, status_code=201, tags=["water-mains"])
async def create_water_main(
    data: WaterMainCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WaterMainOut:
    """Create a new water main."""
    if len(data.coordinates) < 2:
        raise HTTPException(
            status_code=400,
            detail="LineString requires at least 2 coordinate pairs",
        )

    geom = WKTElement(_coords_to_linestring_wkt(data.coordinates), srid=4326)

    main = WaterMain(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        material_code=data.material_code,
        diameter_inches=data.diameter_inches,
        length_feet=data.length_feet,
        pressure_class=data.pressure_class,
        shape=data.shape,
        lining_type=data.lining_type,
        lining_date=data.lining_date,
        depth_feet=data.depth_feet,
        soil_type=data.soil_type,
        owner=data.owner,
        maintained_by=data.maintained_by,
        status=data.status,
        install_date=data.install_date,
        expected_life_years=data.expected_life_years,
        replacement_cost=data.replacement_cost,
        flow_direction=data.flow_direction,
        pressure_zone_id=data.pressure_zone_id,
        upstream_node_type=data.upstream_node_type,
        upstream_node_id=data.upstream_node_id,
        downstream_node_type=data.downstream_node_type,
        downstream_node_id=data.downstream_node_id,
        break_count=data.break_count,
        condition_rating=data.condition_rating,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(main)
    await db.flush()

    return _water_main_to_out(main, data.coordinates)


@router.get("/water-mains/{water_main_id}", response_model=WaterMainOut, tags=["water-mains"])
async def get_water_main(
    water_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WaterMainOut:
    """Get a single water main by ID."""
    result = await db.execute(
        select(WaterMain).where(
            WaterMain.water_main_id == water_main_id,
            WaterMain.tenant_id == tenant_id,
        )
    )
    main = result.scalar_one_or_none()
    if not main:
        raise HTTPException(status_code=404, detail="Water main not found")

    return _water_main_to_out(main, _extract_linestring_coords(main.geometry))


@router.put("/water-mains/{water_main_id}", response_model=WaterMainOut, tags=["water-mains"])
async def update_water_main(
    water_main_id: uuid.UUID,
    data: WaterMainUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WaterMainOut:
    """Update a water main."""
    result = await db.execute(
        select(WaterMain).where(
            WaterMain.water_main_id == water_main_id,
            WaterMain.tenant_id == tenant_id,
        )
    )
    main = result.scalar_one_or_none()
    if not main:
        raise HTTPException(status_code=404, detail="Water main not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "coordinates" in update_data:
        coords = update_data.pop("coordinates")
        if coords is not None:
            if len(coords) < 2:
                raise HTTPException(
                    status_code=400,
                    detail="LineString requires at least 2 coordinate pairs",
                )
            main.geometry = WKTElement(_coords_to_linestring_wkt(coords), srid=4326)

    for field, value in update_data.items():
        setattr(main, field, value)

    await db.flush()

    # Re-fetch to get updated geometry
    result = await db.execute(
        select(WaterMain).where(WaterMain.water_main_id == water_main_id)
    )
    main = result.scalar_one()

    return _water_main_to_out(main, _extract_linestring_coords(main.geometry))


@router.delete("/water-mains/{water_main_id}", status_code=204, tags=["water-mains"])
async def delete_water_main(
    water_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a water main."""
    result = await db.execute(
        select(WaterMain).where(
            WaterMain.water_main_id == water_main_id,
            WaterMain.tenant_id == tenant_id,
        )
    )
    main = result.scalar_one_or_none()
    if not main:
        raise HTTPException(status_code=404, detail="Water main not found")

    await db.delete(main)
