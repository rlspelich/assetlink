"""Lift station CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.db.spatial import lon_lat_columns, make_point
from app.models.sewer import ForceMain, LiftStation
from app.schemas.sewer import (
    LiftStationCreate,
    LiftStationListOut,
    LiftStationOut,
    LiftStationUpdate,
)

from .helpers import _lift_station_to_out

router = APIRouter()


@router.get("/lift-stations", response_model=LiftStationListOut, tags=["sewer-lift-stations"])
async def list_lift_stations(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    has_scada: bool | None = None,
    has_backup_power: bool | None = None,
) -> LiftStationListOut:
    """List lift stations for the current tenant with optional filters."""
    # Subquery for force main count per lift station
    fm_count_subq = (
        select(
            ForceMain.lift_station_id,
            func.count(ForceMain.force_main_id).label("fm_count"),
        )
        .where(ForceMain.tenant_id == tenant_id)
        .group_by(ForceMain.lift_station_id)
        .subquery()
    )

    query = (
        select(
            LiftStation,
            *lon_lat_columns(LiftStation.geometry),
            func.coalesce(fm_count_subq.c.fm_count, 0).label("fm_count"),
        )
        .outerjoin(fm_count_subq, LiftStation.lift_station_id == fm_count_subq.c.lift_station_id)
        .where(LiftStation.tenant_id == tenant_id)
    )

    if status:
        query = query.where(LiftStation.status == status)
    if has_scada is not None:
        query = query.where(LiftStation.has_scada == has_scada)
    if has_backup_power is not None:
        query = query.where(LiftStation.has_backup_power == has_backup_power)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(LiftStation.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    lift_stations = [
        _lift_station_to_out(row.LiftStation, row.lon, row.lat, row.fm_count)
        for row in rows
    ]

    return LiftStationListOut(
        lift_stations=lift_stations, total=total, page=page, page_size=page_size
    )


@router.post("/lift-stations", response_model=LiftStationOut, status_code=201, tags=["sewer-lift-stations"])
async def create_lift_station(
    data: LiftStationCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> LiftStationOut:
    """Create a new lift station."""
    geom = make_point(data.longitude, data.latitude)

    lift_station = LiftStation(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        station_name=data.station_name,
        description=data.description,
        wet_well_depth_ft=data.wet_well_depth_ft,
        wet_well_diameter_ft=data.wet_well_diameter_ft,
        wet_well_material=data.wet_well_material,
        pump_count=data.pump_count,
        pump_type=data.pump_type,
        pump_hp=data.pump_hp,
        firm_capacity_gpm=data.firm_capacity_gpm,
        design_capacity_gpm=data.design_capacity_gpm,
        control_type=data.control_type,
        has_scada=data.has_scada,
        has_backup_power=data.has_backup_power,
        backup_power_type=data.backup_power_type,
        has_alarm=data.has_alarm,
        alarm_type=data.alarm_type,
        electrical_service=data.electrical_service,
        voltage=data.voltage,
        owner=data.owner,
        maintained_by=data.maintained_by,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(lift_station)
    await db.flush()

    return LiftStationOut(
        lift_station_id=lift_station.lift_station_id,
        tenant_id=lift_station.tenant_id,
        asset_tag=lift_station.asset_tag,
        station_name=lift_station.station_name,
        description=lift_station.description,
        wet_well_depth_ft=lift_station.wet_well_depth_ft,
        wet_well_diameter_ft=lift_station.wet_well_diameter_ft,
        wet_well_material=lift_station.wet_well_material,
        pump_count=lift_station.pump_count,
        pump_type=lift_station.pump_type,
        pump_hp=lift_station.pump_hp,
        firm_capacity_gpm=lift_station.firm_capacity_gpm,
        design_capacity_gpm=lift_station.design_capacity_gpm,
        control_type=lift_station.control_type,
        has_scada=lift_station.has_scada,
        has_backup_power=lift_station.has_backup_power,
        backup_power_type=lift_station.backup_power_type,
        has_alarm=lift_station.has_alarm,
        alarm_type=lift_station.alarm_type,
        electrical_service=lift_station.electrical_service,
        voltage=lift_station.voltage,
        owner=lift_station.owner,
        maintained_by=lift_station.maintained_by,
        status=lift_station.status,
        install_date=lift_station.install_date,
        condition_rating=lift_station.condition_rating,
        custom_fields=lift_station.custom_fields,
        notes=lift_station.notes,
        longitude=data.longitude,
        latitude=data.latitude,
        force_main_count=0,
        created_at=lift_station.created_at,
        updated_at=lift_station.updated_at,
    )


@router.get("/lift-stations/{lift_station_id}", response_model=LiftStationOut, tags=["sewer-lift-stations"])
async def get_lift_station(
    lift_station_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> LiftStationOut:
    """Get a single lift station by ID."""
    fm_count_subq = (
        select(func.count(ForceMain.force_main_id).label("fm_count"))
        .where(
            ForceMain.lift_station_id == lift_station_id,
            ForceMain.tenant_id == tenant_id,
        )
        .scalar_subquery()
    )

    query = select(
        LiftStation,
        *lon_lat_columns(LiftStation.geometry),
        func.coalesce(fm_count_subq, 0).label("fm_count"),
    ).where(
        LiftStation.lift_station_id == lift_station_id,
        LiftStation.tenant_id == tenant_id,
    )

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Lift station not found")

    return _lift_station_to_out(row.LiftStation, row.lon, row.lat, row.fm_count)


@router.put("/lift-stations/{lift_station_id}", response_model=LiftStationOut, tags=["sewer-lift-stations"])
async def update_lift_station(
    lift_station_id: uuid.UUID,
    data: LiftStationUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> LiftStationOut:
    """Update a lift station."""
    result = await db.execute(
        select(LiftStation).where(
            LiftStation.lift_station_id == lift_station_id,
            LiftStation.tenant_id == tenant_id,
        )
    )
    lift_station = result.scalar_one_or_none()
    if not lift_station:
        raise HTTPException(status_code=404, detail="Lift station not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        lift_station.geometry = make_point(lon, lat)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(lift_station, field, value)

    await db.flush()

    # Re-fetch with coordinates and force main count
    fm_count_subq = (
        select(func.count(ForceMain.force_main_id).label("fm_count"))
        .where(
            ForceMain.lift_station_id == lift_station_id,
            ForceMain.tenant_id == tenant_id,
        )
        .scalar_subquery()
    )

    query = select(
        LiftStation,
        *lon_lat_columns(LiftStation.geometry),
        func.coalesce(fm_count_subq, 0).label("fm_count"),
    ).where(LiftStation.lift_station_id == lift_station_id)
    result = await db.execute(query)
    row = result.first()

    return _lift_station_to_out(row.LiftStation, row.lon, row.lat, row.fm_count)


@router.delete("/lift-stations/{lift_station_id}", status_code=204, tags=["sewer-lift-stations"])
async def delete_lift_station(
    lift_station_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a lift station. Fails with 409 if force mains are still connected."""
    result = await db.execute(
        select(LiftStation).where(
            LiftStation.lift_station_id == lift_station_id,
            LiftStation.tenant_id == tenant_id,
        )
    )
    lift_station = result.scalar_one_or_none()
    if not lift_station:
        raise HTTPException(status_code=404, detail="Lift station not found")

    # Check for connected force mains
    fm_count = (
        await db.execute(
            select(func.count(ForceMain.force_main_id)).where(
                ForceMain.lift_station_id == lift_station_id,
                ForceMain.tenant_id == tenant_id,
            )
        )
    ).scalar_one()

    if fm_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete lift station with {fm_count} connected force main(s). "
            "Remove or reassign force mains first.",
        )

    await db.delete(lift_station)
