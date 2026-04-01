"""Fire hydrant CRUD routes (Point geometry)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.db.spatial import lon_lat_columns, make_point
from app.models.water import FireHydrant

from .helpers import (
    FireHydrantCreate,
    FireHydrantListOut,
    FireHydrantOut,
    FireHydrantUpdate,
    _hydrant_to_out,
)

router = APIRouter()


@router.get("/hydrants", response_model=FireHydrantListOut, tags=["hydrants"])
async def list_hydrants(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    flow_class_color: str | None = None,
) -> FireHydrantListOut:
    """List fire hydrants for the current tenant with optional filters."""
    query = select(
        FireHydrant,
        *lon_lat_columns(FireHydrant.geometry),
    ).where(FireHydrant.tenant_id == tenant_id)

    if status:
        query = query.where(FireHydrant.status == status)
    if flow_class_color:
        query = query.where(FireHydrant.flow_class_color == flow_class_color)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(FireHydrant.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    hydrants = [
        _hydrant_to_out(row.FireHydrant, row.lon, row.lat) for row in rows
    ]

    return FireHydrantListOut(
        hydrants=hydrants, total=total, page=page, page_size=page_size
    )


@router.post("/hydrants", response_model=FireHydrantOut, status_code=201, tags=["hydrants"])
async def create_hydrant(
    data: FireHydrantCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> FireHydrantOut:
    """Create a new fire hydrant."""
    geom = make_point(data.longitude, data.latitude)

    hydrant = FireHydrant(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        make=data.make,
        model=data.model,
        year_manufactured=data.year_manufactured,
        barrel_type=data.barrel_type,
        nozzle_count=data.nozzle_count,
        nozzle_sizes=data.nozzle_sizes,
        flow_test_date=data.flow_test_date,
        static_pressure_psi=data.static_pressure_psi,
        residual_pressure_psi=data.residual_pressure_psi,
        pitot_pressure_psi=data.pitot_pressure_psi,
        flow_gpm=data.flow_gpm,
        flow_class_color=data.flow_class_color,
        last_flush_date=data.last_flush_date,
        flush_interval_days=data.flush_interval_days,
        status=data.status,
        out_of_service_reason=data.out_of_service_reason,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        ownership=data.ownership,
        auxiliary_valve_id=data.auxiliary_valve_id,
        lateral_size_inches=data.lateral_size_inches,
        main_size_inches=data.main_size_inches,
        connected_main_id=data.connected_main_id,
        pressure_zone_id=data.pressure_zone_id,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(hydrant)
    await db.flush()

    return _hydrant_to_out(hydrant, data.longitude, data.latitude)


@router.get("/hydrants/{hydrant_id}", response_model=FireHydrantOut, tags=["hydrants"])
async def get_hydrant(
    hydrant_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> FireHydrantOut:
    """Get a single fire hydrant by ID."""
    query = select(
        FireHydrant,
        *lon_lat_columns(FireHydrant.geometry),
    ).where(
        FireHydrant.hydrant_id == hydrant_id,
        FireHydrant.tenant_id == tenant_id,
    )

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Fire hydrant not found")

    return _hydrant_to_out(row.FireHydrant, row.lon, row.lat)


@router.put("/hydrants/{hydrant_id}", response_model=FireHydrantOut, tags=["hydrants"])
async def update_hydrant(
    hydrant_id: uuid.UUID,
    data: FireHydrantUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> FireHydrantOut:
    """Update a fire hydrant."""
    result = await db.execute(
        select(FireHydrant).where(
            FireHydrant.hydrant_id == hydrant_id,
            FireHydrant.tenant_id == tenant_id,
        )
    )
    hydrant = result.scalar_one_or_none()
    if not hydrant:
        raise HTTPException(status_code=404, detail="Fire hydrant not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        hydrant.geometry = make_point(lon, lat)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(hydrant, field, value)

    await db.flush()

    # Re-fetch with coordinates
    query = select(
        FireHydrant,
        *lon_lat_columns(FireHydrant.geometry),
    ).where(FireHydrant.hydrant_id == hydrant_id)
    result = await db.execute(query)
    row = result.first()

    return _hydrant_to_out(row.FireHydrant, row.lon, row.lat)


@router.delete("/hydrants/{hydrant_id}", status_code=204, tags=["hydrants"])
async def delete_hydrant(
    hydrant_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a fire hydrant."""
    result = await db.execute(
        select(FireHydrant).where(
            FireHydrant.hydrant_id == hydrant_id,
            FireHydrant.tenant_id == tenant_id,
        )
    )
    hydrant = result.scalar_one_or_none()
    if not hydrant:
        raise HTTPException(status_code=404, detail="Fire hydrant not found")

    await db.delete(hydrant)
