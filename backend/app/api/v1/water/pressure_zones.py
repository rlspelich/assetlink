"""Pressure zone CRUD routes (Polygon geometry)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.elements import WKTElement
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.water import PressureZone

from .helpers import (
    PressureZoneCreate,
    PressureZoneListOut,
    PressureZoneOut,
    _coords_to_polygon_wkt,
    _extract_polygon_coords,
    _pressure_zone_to_out,
)

router = APIRouter()


@router.get("/pressure-zones", response_model=PressureZoneListOut, tags=["pressure-zones"])
async def list_pressure_zones(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
) -> PressureZoneListOut:
    """List pressure zones for the current tenant."""
    query = select(PressureZone).where(PressureZone.tenant_id == tenant_id)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(PressureZone.zone_name)
    result = await db.execute(query)
    rows = result.scalars().all()

    pressure_zones = [
        _pressure_zone_to_out(zone, _extract_polygon_coords(zone.geometry))
        for zone in rows
    ]

    return PressureZoneListOut(
        pressure_zones=pressure_zones, total=total, page=page, page_size=page_size
    )


@router.post(
    "/pressure-zones", response_model=PressureZoneOut, status_code=201, tags=["pressure-zones"]
)
async def create_pressure_zone(
    data: PressureZoneCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PressureZoneOut:
    """Create a new pressure zone."""
    geom = None
    if data.coordinates:
        if len(data.coordinates) < 3:
            raise HTTPException(
                status_code=400,
                detail="Polygon requires at least 3 coordinate pairs",
            )
        geom = WKTElement(_coords_to_polygon_wkt(data.coordinates), srid=4326)

    zone = PressureZone(
        tenant_id=tenant_id,
        zone_name=data.zone_name,
        zone_number=data.zone_number,
        target_pressure_min_psi=data.target_pressure_min_psi,
        target_pressure_max_psi=data.target_pressure_max_psi,
        description=data.description,
        geometry=geom,
    )
    db.add(zone)
    await db.flush()

    return _pressure_zone_to_out(zone, data.coordinates)


@router.get(
    "/pressure-zones/{pressure_zone_id}",
    response_model=PressureZoneOut,
    tags=["pressure-zones"],
)
async def get_pressure_zone(
    pressure_zone_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> PressureZoneOut:
    """Get a single pressure zone by ID."""
    result = await db.execute(
        select(PressureZone).where(
            PressureZone.pressure_zone_id == pressure_zone_id,
            PressureZone.tenant_id == tenant_id,
        )
    )
    zone = result.scalar_one_or_none()
    if not zone:
        raise HTTPException(status_code=404, detail="Pressure zone not found")

    return _pressure_zone_to_out(zone, _extract_polygon_coords(zone.geometry))
