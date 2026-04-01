"""Shared geometry helpers and ORM-to-schema converters for water routes."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from geoalchemy2.shape import to_shape
from pydantic import BaseModel, Field

from app.models.water import (
    FireHydrant,
    PressureZone,
    WaterMain,
    WaterValve,
)


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
    if geometry is None:
        return []
    shape = to_shape(geometry)
    return [[c[0], c[1]] for c in shape.coords]


def _extract_polygon_coords(geometry) -> list[list[float]] | None:
    """Extract [[lon, lat], ...] from a PostGIS Polygon geometry (exterior ring)."""
    if geometry is None:
        return None
    shape = to_shape(geometry)
    return [[c[0], c[1]] for c in shape.exterior.coords]


# ---------------------------------------------------------------------------
# Converters (ORM -> Response Schema)
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
