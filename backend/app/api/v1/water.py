"""
Water distribution system API routes.

Assets: water mains (LineString), water valves (Point), fire hydrants (Point),
pressure zones (Polygon).

Lookup tables: water_material_type, water_valve_type.
"""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.water import (
    FireHydrant,
    PressureZone,
    WaterMain,
    WaterMaterialType,
    WaterValve,
    WaterValveType,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

# --- Water Material Type (lookup) ---


class WaterMaterialTypeOut(BaseModel):
    code: str
    description: str
    expected_life_years: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


# --- Water Valve Type (lookup) ---


class WaterValveTypeOut(BaseModel):
    code: str
    description: str
    exercise_interval_days: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


# --- Pressure Zone ---


class PressureZoneCreate(BaseModel):
    zone_name: str
    zone_number: str | None = None
    target_pressure_min_psi: Decimal | None = None
    target_pressure_max_psi: Decimal | None = None
    description: str | None = None
    # Polygon as list of [lon, lat] rings: [[lon, lat], ...]
    coordinates: list[list[float]] | None = None


class PressureZoneOut(BaseModel):
    pressure_zone_id: uuid.UUID
    tenant_id: uuid.UUID
    zone_name: str
    zone_number: str | None = None
    target_pressure_min_psi: Decimal | None = None
    target_pressure_max_psi: Decimal | None = None
    description: str | None = None
    coordinates: list[list[float]] | None = None
    created_at: Any = None
    updated_at: Any = None

    model_config = {"from_attributes": True}


class PressureZoneListOut(BaseModel):
    pressure_zones: list[PressureZoneOut]
    total: int
    page: int
    page_size: int


# --- Water Main ---


class WaterMainCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    material_code: str | None = None
    diameter_inches: Decimal | None = None
    length_feet: Decimal | None = None
    pressure_class: str | None = None
    shape: str | None = None
    lining_type: str | None = None
    lining_date: date | None = None
    depth_feet: Decimal | None = None
    soil_type: str | None = None
    owner: str = "public"
    maintained_by: str | None = None
    status: str = "active"
    install_date: date | None = None
    expected_life_years: int | None = None
    replacement_cost: Decimal | None = None
    flow_direction: str | None = None
    pressure_zone_id: uuid.UUID | None = None
    upstream_node_type: str | None = None
    upstream_node_id: uuid.UUID | None = None
    downstream_node_type: str | None = None
    downstream_node_id: uuid.UUID | None = None
    break_count: int = 0
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    # LineString geometry as list of [lon, lat] pairs
    coordinates: list[list[float]]


class WaterMainUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    material_code: str | None = None
    diameter_inches: Decimal | None = None
    length_feet: Decimal | None = None
    pressure_class: str | None = None
    shape: str | None = None
    lining_type: str | None = None
    lining_date: date | None = None
    depth_feet: Decimal | None = None
    soil_type: str | None = None
    owner: str | None = None
    maintained_by: str | None = None
    status: str | None = None
    install_date: date | None = None
    expected_life_years: int | None = None
    replacement_cost: Decimal | None = None
    flow_direction: str | None = None
    pressure_zone_id: uuid.UUID | None = None
    upstream_node_type: str | None = None
    upstream_node_id: uuid.UUID | None = None
    downstream_node_type: str | None = None
    downstream_node_id: uuid.UUID | None = None
    break_count: int | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    # Optional geometry update
    coordinates: list[list[float]] | None = None


class WaterMainOut(BaseModel):
    water_main_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    material_code: str | None = None
    diameter_inches: Decimal | None = None
    length_feet: Decimal | None = None
    pressure_class: str | None = None
    shape: str | None = None
    lining_type: str | None = None
    lining_date: date | None = None
    depth_feet: Decimal | None = None
    soil_type: str | None = None
    owner: str
    maintained_by: str | None = None
    status: str
    install_date: date | None = None
    expected_life_years: int | None = None
    replacement_cost: Decimal | None = None
    flow_direction: str | None = None
    pressure_zone_id: uuid.UUID | None = None
    upstream_node_type: str | None = None
    upstream_node_id: uuid.UUID | None = None
    downstream_node_type: str | None = None
    downstream_node_id: uuid.UUID | None = None
    break_count: int = 0
    condition_rating: int | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    coordinates: list[list[float]] = []
    created_at: Any = None
    updated_at: Any = None

    model_config = {"from_attributes": True}


class WaterMainListOut(BaseModel):
    water_mains: list[WaterMainOut]
    total: int
    page: int
    page_size: int


# --- Water Valve ---


class WaterValveCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    valve_type_code: str | None = None
    size_inches: Decimal | None = None
    manufacturer: str | None = None
    model: str | None = None
    material: str | None = None
    turns_to_close: int | None = None
    turn_direction: str | None = None
    normal_position: str = "open"
    current_position: str | None = None
    is_operable: str | None = None
    is_critical: bool = False
    installation_type: str | None = None
    depth_feet: Decimal | None = None
    status: str = "active"
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    last_exercised_date: date | None = None
    exercise_interval_days: int | None = None
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class WaterValveUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    valve_type_code: str | None = None
    size_inches: Decimal | None = None
    manufacturer: str | None = None
    model: str | None = None
    material: str | None = None
    turns_to_close: int | None = None
    turn_direction: str | None = None
    normal_position: str | None = None
    current_position: str | None = None
    is_operable: str | None = None
    is_critical: bool | None = None
    installation_type: str | None = None
    depth_feet: Decimal | None = None
    status: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    last_exercised_date: date | None = None
    exercise_interval_days: int | None = None
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class WaterValveOut(BaseModel):
    water_valve_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    valve_type_code: str | None = None
    size_inches: Decimal | None = None
    manufacturer: str | None = None
    model: str | None = None
    material: str | None = None
    turns_to_close: int | None = None
    turn_direction: str | None = None
    normal_position: str
    current_position: str | None = None
    is_operable: str | None = None
    is_critical: bool
    installation_type: str | None = None
    depth_feet: Decimal | None = None
    status: str
    install_date: date | None = None
    condition_rating: int | None = None
    last_exercised_date: date | None = None
    exercise_interval_days: int | None = None
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float
    latitude: float
    created_at: Any = None
    updated_at: Any = None

    model_config = {"from_attributes": True}


class WaterValveListOut(BaseModel):
    water_valves: list[WaterValveOut]
    total: int
    page: int
    page_size: int


# --- Fire Hydrant ---


class FireHydrantCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    make: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    barrel_type: str | None = None
    nozzle_count: int | None = None
    nozzle_sizes: str | None = None
    flow_test_date: date | None = None
    static_pressure_psi: Decimal | None = None
    residual_pressure_psi: Decimal | None = None
    pitot_pressure_psi: Decimal | None = None
    flow_gpm: Decimal | None = None
    flow_class_color: str | None = None
    last_flush_date: date | None = None
    flush_interval_days: int | None = None
    status: str = "active"
    out_of_service_reason: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    ownership: str = "public"
    auxiliary_valve_id: uuid.UUID | None = None
    lateral_size_inches: Decimal | None = None
    main_size_inches: Decimal | None = None
    connected_main_id: uuid.UUID | None = None
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class FireHydrantUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    make: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    barrel_type: str | None = None
    nozzle_count: int | None = None
    nozzle_sizes: str | None = None
    flow_test_date: date | None = None
    static_pressure_psi: Decimal | None = None
    residual_pressure_psi: Decimal | None = None
    pitot_pressure_psi: Decimal | None = None
    flow_gpm: Decimal | None = None
    flow_class_color: str | None = None
    last_flush_date: date | None = None
    flush_interval_days: int | None = None
    status: str | None = None
    out_of_service_reason: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    ownership: str | None = None
    auxiliary_valve_id: uuid.UUID | None = None
    lateral_size_inches: Decimal | None = None
    main_size_inches: Decimal | None = None
    connected_main_id: uuid.UUID | None = None
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class FireHydrantOut(BaseModel):
    hydrant_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    make: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    barrel_type: str | None = None
    nozzle_count: int | None = None
    nozzle_sizes: str | None = None
    flow_test_date: date | None = None
    static_pressure_psi: Decimal | None = None
    residual_pressure_psi: Decimal | None = None
    pitot_pressure_psi: Decimal | None = None
    flow_gpm: Decimal | None = None
    flow_class_color: str | None = None
    last_flush_date: date | None = None
    flush_interval_days: int | None = None
    status: str
    out_of_service_reason: str | None = None
    install_date: date | None = None
    condition_rating: int | None = None
    ownership: str
    auxiliary_valve_id: uuid.UUID | None = None
    lateral_size_inches: Decimal | None = None
    main_size_inches: Decimal | None = None
    connected_main_id: uuid.UUID | None = None
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float
    latitude: float
    created_at: Any = None
    updated_at: Any = None

    model_config = {"from_attributes": True}


class FireHydrantListOut(BaseModel):
    hydrants: list[FireHydrantOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Geometry Helpers
# ---------------------------------------------------------------------------


def _coords_to_linestring_wkt(coordinates: list[list[float]]) -> str:
    """Convert [[lon, lat], ...] to WKT LINESTRING."""
    pairs = ", ".join(f"{c[0]} {c[1]}" for c in coordinates)
    return f"SRID=4326;LINESTRING({pairs})"


def _coords_to_polygon_wkt(coordinates: list[list[float]]) -> str:
    """Convert [[lon, lat], ...] to WKT POLYGON (single ring, auto-closed)."""
    # Auto-close the ring if not already closed
    if coordinates and coordinates[0] != coordinates[-1]:
        coordinates = coordinates + [coordinates[0]]
    pairs = ", ".join(f"{c[0]} {c[1]}" for c in coordinates)
    return f"SRID=4326;POLYGON(({pairs}))"


def _extract_linestring_coords(geometry) -> list[list[float]]:
    """Extract [[lon, lat], ...] from a PostGIS LineString geometry."""
    from geoalchemy2.shape import to_shape

    if geometry is None:
        return []
    shape = to_shape(geometry)
    return [[c[0], c[1]] for c in shape.coords]


def _extract_polygon_coords(geometry) -> list[list[float]] | None:
    """Extract [[lon, lat], ...] from a PostGIS Polygon geometry (exterior ring)."""
    from geoalchemy2.shape import to_shape

    if geometry is None:
        return None
    shape = to_shape(geometry)
    return [[c[0], c[1]] for c in shape.exterior.coords]


# ---------------------------------------------------------------------------
# Converters (ORM → Response Schema)
# ---------------------------------------------------------------------------


def _water_main_to_out(main: WaterMain, coordinates: list[list[float]]) -> WaterMainOut:
    """Convert a WaterMain ORM object to the response schema."""
    return WaterMainOut(
        water_main_id=main.water_main_id,
        tenant_id=main.tenant_id,
        asset_tag=main.asset_tag,
        description=main.description,
        material_code=main.material_code,
        diameter_inches=main.diameter_inches,
        length_feet=main.length_feet,
        pressure_class=main.pressure_class,
        shape=main.shape,
        lining_type=main.lining_type,
        lining_date=main.lining_date,
        depth_feet=main.depth_feet,
        soil_type=main.soil_type,
        owner=main.owner,
        maintained_by=main.maintained_by,
        status=main.status,
        install_date=main.install_date,
        expected_life_years=main.expected_life_years,
        replacement_cost=main.replacement_cost,
        flow_direction=main.flow_direction,
        pressure_zone_id=main.pressure_zone_id,
        upstream_node_type=main.upstream_node_type,
        upstream_node_id=main.upstream_node_id,
        downstream_node_type=main.downstream_node_type,
        downstream_node_id=main.downstream_node_id,
        break_count=main.break_count,
        condition_rating=main.condition_rating,
        custom_fields=main.custom_fields,
        notes=main.notes,
        coordinates=coordinates,
        created_at=main.created_at,
        updated_at=main.updated_at,
    )


def _water_valve_to_out(valve: WaterValve, lon: float, lat: float) -> WaterValveOut:
    """Convert a WaterValve ORM object to the response schema."""
    return WaterValveOut(
        water_valve_id=valve.water_valve_id,
        tenant_id=valve.tenant_id,
        asset_tag=valve.asset_tag,
        description=valve.description,
        valve_type_code=valve.valve_type_code,
        size_inches=valve.size_inches,
        manufacturer=valve.manufacturer,
        model=valve.model,
        material=valve.material,
        turns_to_close=valve.turns_to_close,
        turn_direction=valve.turn_direction,
        normal_position=valve.normal_position,
        current_position=valve.current_position,
        is_operable=valve.is_operable,
        is_critical=valve.is_critical,
        installation_type=valve.installation_type,
        depth_feet=valve.depth_feet,
        status=valve.status,
        install_date=valve.install_date,
        condition_rating=valve.condition_rating,
        last_exercised_date=valve.last_exercised_date,
        exercise_interval_days=valve.exercise_interval_days,
        pressure_zone_id=valve.pressure_zone_id,
        custom_fields=valve.custom_fields,
        notes=valve.notes,
        longitude=lon,
        latitude=lat,
        created_at=valve.created_at,
        updated_at=valve.updated_at,
    )


def _hydrant_to_out(hydrant: FireHydrant, lon: float, lat: float) -> FireHydrantOut:
    """Convert a FireHydrant ORM object to the response schema."""
    return FireHydrantOut(
        hydrant_id=hydrant.hydrant_id,
        tenant_id=hydrant.tenant_id,
        asset_tag=hydrant.asset_tag,
        description=hydrant.description,
        make=hydrant.make,
        model=hydrant.model,
        year_manufactured=hydrant.year_manufactured,
        barrel_type=hydrant.barrel_type,
        nozzle_count=hydrant.nozzle_count,
        nozzle_sizes=hydrant.nozzle_sizes,
        flow_test_date=hydrant.flow_test_date,
        static_pressure_psi=hydrant.static_pressure_psi,
        residual_pressure_psi=hydrant.residual_pressure_psi,
        pitot_pressure_psi=hydrant.pitot_pressure_psi,
        flow_gpm=hydrant.flow_gpm,
        flow_class_color=hydrant.flow_class_color,
        last_flush_date=hydrant.last_flush_date,
        flush_interval_days=hydrant.flush_interval_days,
        status=hydrant.status,
        out_of_service_reason=hydrant.out_of_service_reason,
        install_date=hydrant.install_date,
        condition_rating=hydrant.condition_rating,
        ownership=hydrant.ownership,
        auxiliary_valve_id=hydrant.auxiliary_valve_id,
        lateral_size_inches=hydrant.lateral_size_inches,
        main_size_inches=hydrant.main_size_inches,
        connected_main_id=hydrant.connected_main_id,
        pressure_zone_id=hydrant.pressure_zone_id,
        custom_fields=hydrant.custom_fields,
        notes=hydrant.notes,
        longitude=lon,
        latitude=lat,
        created_at=hydrant.created_at,
        updated_at=hydrant.updated_at,
    )


def _pressure_zone_to_out(
    zone: PressureZone, coordinates: list[list[float]] | None
) -> PressureZoneOut:
    """Convert a PressureZone ORM object to the response schema."""
    return PressureZoneOut(
        pressure_zone_id=zone.pressure_zone_id,
        tenant_id=zone.tenant_id,
        zone_name=zone.zone_name,
        zone_number=zone.zone_number,
        target_pressure_min_psi=zone.target_pressure_min_psi,
        target_pressure_max_psi=zone.target_pressure_max_psi,
        description=zone.description,
        coordinates=coordinates,
        created_at=zone.created_at,
        updated_at=zone.updated_at,
    )


# ===========================================================================
# WATER MAINS (LineString)
# ===========================================================================


@router.get("/water-mains", response_model=WaterMainListOut, tags=["water-mains"])
async def list_water_mains(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    material_code: str | None = None,
    pressure_zone_id: uuid.UUID | None = None,
):
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
):
    """Create a new water main."""
    if len(data.coordinates) < 2:
        raise HTTPException(
            status_code=400,
            detail="LineString requires at least 2 coordinate pairs",
        )

    from geoalchemy2.elements import WKTElement

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
):
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
):
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
            from geoalchemy2.elements import WKTElement

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
):
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


# ===========================================================================
# WATER VALVES (Point)
# ===========================================================================


@router.get("/water-valves", response_model=WaterValveListOut, tags=["water-valves"])
async def list_water_valves(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    valve_type_code: str | None = None,
    is_critical: bool | None = None,
):
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
):
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
):
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
):
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
):
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


# ===========================================================================
# FIRE HYDRANTS (Point)
# ===========================================================================


@router.get("/hydrants", response_model=FireHydrantListOut, tags=["hydrants"])
async def list_hydrants(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    flow_class_color: str | None = None,
):
    """List fire hydrants for the current tenant with optional filters."""
    query = select(
        FireHydrant,
        func.ST_X(FireHydrant.geometry).label("lon"),
        func.ST_Y(FireHydrant.geometry).label("lat"),
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
):
    """Create a new fire hydrant."""
    geom = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)

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
):
    """Get a single fire hydrant by ID."""
    query = select(
        FireHydrant,
        func.ST_X(FireHydrant.geometry).label("lon"),
        func.ST_Y(FireHydrant.geometry).label("lat"),
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
):
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
        hydrant.geometry = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(hydrant, field, value)

    await db.flush()

    # Re-fetch with coordinates
    query = select(
        FireHydrant,
        func.ST_X(FireHydrant.geometry).label("lon"),
        func.ST_Y(FireHydrant.geometry).label("lat"),
    ).where(FireHydrant.hydrant_id == hydrant_id)
    result = await db.execute(query)
    row = result.first()

    return _hydrant_to_out(row.FireHydrant, row.lon, row.lat)


@router.delete("/hydrants/{hydrant_id}", status_code=204, tags=["hydrants"])
async def delete_hydrant(
    hydrant_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
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


# ===========================================================================
# PRESSURE ZONES (Polygon)
# ===========================================================================


@router.get("/pressure-zones", response_model=PressureZoneListOut, tags=["pressure-zones"])
async def list_pressure_zones(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
):
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
):
    """Create a new pressure zone."""
    geom = None
    if data.coordinates:
        if len(data.coordinates) < 3:
            raise HTTPException(
                status_code=400,
                detail="Polygon requires at least 3 coordinate pairs",
            )
        from geoalchemy2.elements import WKTElement

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
):
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


# ===========================================================================
# LOOKUP TABLES (Reference data — not tenant-specific)
# ===========================================================================


@router.get(
    "/water-material-types",
    response_model=list[WaterMaterialTypeOut],
    tags=["water-lookups"],
)
async def list_water_material_types(
    db: AsyncSession = Depends(get_db),
):
    """List all active water material types. Not tenant-specific."""
    query = (
        select(WaterMaterialType)
        .where(WaterMaterialType.is_active == True)
        .order_by(WaterMaterialType.code)
    )
    result = await db.execute(query)
    return [WaterMaterialTypeOut.model_validate(mt) for mt in result.scalars().all()]


@router.get(
    "/water-valve-types",
    response_model=list[WaterValveTypeOut],
    tags=["water-lookups"],
)
async def list_water_valve_types(
    db: AsyncSession = Depends(get_db),
):
    """List all active water valve types. Not tenant-specific."""
    query = (
        select(WaterValveType)
        .where(WaterValveType.is_active == True)
        .order_by(WaterValveType.code)
    )
    result = await db.execute(query)
    return [WaterValveTypeOut.model_validate(vt) for vt in result.scalars().all()]
