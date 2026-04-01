"""Water valve CRUD routes (Point geometry)."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.water import WaterValve

from .helpers import (
    WaterValveCreate,
    WaterValveListOut,
    WaterValveOut,
    WaterValveUpdate,
    _water_valve_to_out,
)

router = APIRouter()


@router.get("/water-valves", response_model=WaterValveListOut, tags=["water-valves"])
async def list_water_valves(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    valve_type_code: str | None = None,
    is_critical: bool | None = None,
) -> WaterValveListOut:
    """List water valves for the current tenant with optional filters."""
    query = select(
        WaterValve,
        func.ST_X(WaterValve.geometry).label("lon"),
        func.ST_Y(WaterValve.geometry).label("lat"),
    ).where(WaterValve.tenant_id == tenant_id)

    if status:
        query = query.where(WaterValve.status == status)
    if valve_type_code:
        query = query.where(WaterValve.valve_type_code == valve_type_code)
    if is_critical is not None:
        query = query.where(WaterValve.is_critical == is_critical)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(WaterValve.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    water_valves = [
        _water_valve_to_out(row.WaterValve, row.lon, row.lat) for row in rows
    ]

    return WaterValveListOut(
        water_valves=water_valves, total=total, page=page, page_size=page_size
    )


@router.post("/water-valves", response_model=WaterValveOut, status_code=201, tags=["water-valves"])
async def create_water_valve(
    data: WaterValveCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WaterValveOut:
    """Create a new water valve."""
    geom = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)

    valve = WaterValve(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        valve_type_code=data.valve_type_code,
        size_inches=data.size_inches,
        manufacturer=data.manufacturer,
        model=data.model,
        material=data.material,
        turns_to_close=data.turns_to_close,
        turn_direction=data.turn_direction,
        normal_position=data.normal_position,
        current_position=data.current_position,
        is_operable=data.is_operable,
        is_critical=data.is_critical,
        installation_type=data.installation_type,
        depth_feet=data.depth_feet,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        last_exercised_date=data.last_exercised_date,
        exercise_interval_days=data.exercise_interval_days,
        pressure_zone_id=data.pressure_zone_id,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(valve)
    await db.flush()

    return _water_valve_to_out(valve, data.longitude, data.latitude)


@router.get(
    "/water-valves/{water_valve_id}", response_model=WaterValveOut, tags=["water-valves"]
)
async def get_water_valve(
    water_valve_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WaterValveOut:
    """Get a single water valve by ID."""
    query = select(
        WaterValve,
        func.ST_X(WaterValve.geometry).label("lon"),
        func.ST_Y(WaterValve.geometry).label("lat"),
    ).where(
        WaterValve.water_valve_id == water_valve_id,
        WaterValve.tenant_id == tenant_id,
    )

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Water valve not found")

    return _water_valve_to_out(row.WaterValve, row.lon, row.lat)


@router.put(
    "/water-valves/{water_valve_id}", response_model=WaterValveOut, tags=["water-valves"]
)
async def update_water_valve(
    water_valve_id: uuid.UUID,
    data: WaterValveUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WaterValveOut:
    """Update a water valve."""
    result = await db.execute(
        select(WaterValve).where(
            WaterValve.water_valve_id == water_valve_id,
            WaterValve.tenant_id == tenant_id,
        )
    )
    valve = result.scalar_one_or_none()
    if not valve:
        raise HTTPException(status_code=404, detail="Water valve not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        valve.geometry = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(valve, field, value)

    await db.flush()

    # Re-fetch with coordinates
    query = select(
        WaterValve,
        func.ST_X(WaterValve.geometry).label("lon"),
        func.ST_Y(WaterValve.geometry).label("lat"),
    ).where(WaterValve.water_valve_id == water_valve_id)
    result = await db.execute(query)
    row = result.first()

    return _water_valve_to_out(row.WaterValve, row.lon, row.lat)


@router.delete("/water-valves/{water_valve_id}", status_code=204, tags=["water-valves"])
async def delete_water_valve(
    water_valve_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a water valve."""
    result = await db.execute(
        select(WaterValve).where(
            WaterValve.water_valve_id == water_valve_id,
            WaterValve.tenant_id == tenant_id,
        )
    )
    valve = result.scalar_one_or_none()
    if not valve:
        raise HTTPException(status_code=404, detail="Water valve not found")

    await db.delete(valve)
