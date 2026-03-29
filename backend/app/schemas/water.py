"""Pydantic schemas for the Water module."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Reference Table Out Schemas
# ---------------------------------------------------------------------------


class WaterMaterialTypeOut(BaseModel):
    code: str
    description: str
    expected_life_years: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class WaterValveTypeOut(BaseModel):
    code: str
    description: str
    exercise_interval_days: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Water Main (LineString)
# ---------------------------------------------------------------------------


class WaterMainCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    # Material / Physical
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    pressure_class: str | None = None
    shape: str | None = None
    # Lining
    lining_type: str | None = None
    lining_date: date | None = None
    # Burial
    depth_feet: float | None = None
    soil_type: str | None = None
    # Ownership
    owner: str = "public"
    maintained_by: str | None = None
    # Status / Lifecycle
    status: str = "active"
    install_date: date | None = None
    expected_life_years: int | None = None
    replacement_cost: float | None = None
    # Flow / Pressure
    flow_direction: str | None = None
    pressure_zone_id: uuid.UUID | None = None
    # Network topology
    upstream_node_type: str | None = None
    upstream_node_id: uuid.UUID | None = None
    downstream_node_type: str | None = None
    downstream_node_id: uuid.UUID | None = None
    # History
    break_count: int = 0
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — LineString as coordinate array [[lon, lat], ...]
    coordinates: list[list[float]]


class WaterMainUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    pressure_class: str | None = None
    shape: str | None = None
    lining_type: str | None = None
    lining_date: date | None = None
    depth_feet: float | None = None
    soil_type: str | None = None
    owner: str | None = None
    maintained_by: str | None = None
    status: str | None = None
    install_date: date | None = None
    expected_life_years: int | None = None
    replacement_cost: float | None = None
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
    coordinates: list[list[float]] | None = None


class WaterMainOut(BaseModel):
    water_main_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    # Material / Physical
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    pressure_class: str | None = None
    shape: str | None = None
    # Lining
    lining_type: str | None = None
    lining_date: date | None = None
    # Burial
    depth_feet: float | None = None
    soil_type: str | None = None
    # Ownership
    owner: str
    maintained_by: str | None = None
    # Status / Lifecycle
    status: str
    install_date: date | None = None
    expected_life_years: int | None = None
    replacement_cost: float | None = None
    # Flow / Pressure
    flow_direction: str | None = None
    pressure_zone_id: uuid.UUID | None = None
    # Network topology
    upstream_node_type: str | None = None
    upstream_node_id: uuid.UUID | None = None
    downstream_node_type: str | None = None
    downstream_node_id: uuid.UUID | None = None
    # History
    break_count: int
    condition_rating: int | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — LineString as coordinate array
    coordinates: list[list[float]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WaterMainListOut(BaseModel):
    water_mains: list[WaterMainOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Water Valve (Point)
# ---------------------------------------------------------------------------


class WaterValveCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    # Type / Physical
    valve_type_code: str | None = None
    size_inches: float | None = None
    manufacturer: str | None = None
    model: str | None = None
    material: str | None = None
    # Operation
    turns_to_close: int | None = None
    turn_direction: str | None = None
    normal_position: str = "open"
    current_position: str | None = None
    is_operable: str | None = None
    is_critical: bool = False
    # Installation
    installation_type: str | None = None
    depth_feet: float | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    # Exercise tracking
    last_exercised_date: date | None = None
    exercise_interval_days: int | None = None
    # Network
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class WaterValveUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    valve_type_code: str | None = None
    size_inches: float | None = None
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
    depth_feet: float | None = None
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
    # Type / Physical
    valve_type_code: str | None = None
    size_inches: float | None = None
    manufacturer: str | None = None
    model: str | None = None
    material: str | None = None
    # Operation
    turns_to_close: int | None = None
    turn_direction: str | None = None
    normal_position: str
    current_position: str | None = None
    is_operable: str | None = None
    is_critical: bool
    # Installation
    installation_type: str | None = None
    depth_feet: float | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    condition_rating: int | None = None
    # Exercise tracking
    last_exercised_date: date | None = None
    exercise_interval_days: int | None = None
    # Network
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float | None = None
    latitude: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WaterValveListOut(BaseModel):
    water_valves: list[WaterValveOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Fire Hydrant (Point)
# ---------------------------------------------------------------------------


class FireHydrantCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    # Manufacturer
    make: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    # Type
    barrel_type: str | None = None
    nozzle_count: int | None = None
    nozzle_sizes: str | None = None
    # Flow test data
    flow_test_date: date | None = None
    static_pressure_psi: float | None = None
    residual_pressure_psi: float | None = None
    pitot_pressure_psi: float | None = None
    flow_gpm: float | None = None
    # NFPA/ISO color coding
    flow_class_color: str | None = None
    # Flushing
    last_flush_date: date | None = None
    flush_interval_days: int | None = None
    # Lifecycle
    status: str = "active"
    out_of_service_reason: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    ownership: str = "public"
    # Connection
    auxiliary_valve_id: uuid.UUID | None = None
    lateral_size_inches: float | None = None
    main_size_inches: float | None = None
    connected_main_id: uuid.UUID | None = None
    # Network
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required
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
    static_pressure_psi: float | None = None
    residual_pressure_psi: float | None = None
    pitot_pressure_psi: float | None = None
    flow_gpm: float | None = None
    flow_class_color: str | None = None
    last_flush_date: date | None = None
    flush_interval_days: int | None = None
    status: str | None = None
    out_of_service_reason: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    ownership: str | None = None
    auxiliary_valve_id: uuid.UUID | None = None
    lateral_size_inches: float | None = None
    main_size_inches: float | None = None
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
    # Manufacturer
    make: str | None = None
    model: str | None = None
    year_manufactured: int | None = None
    # Type
    barrel_type: str | None = None
    nozzle_count: int | None = None
    nozzle_sizes: str | None = None
    # Flow test data
    flow_test_date: date | None = None
    static_pressure_psi: float | None = None
    residual_pressure_psi: float | None = None
    pitot_pressure_psi: float | None = None
    flow_gpm: float | None = None
    # NFPA/ISO color coding
    flow_class_color: str | None = None
    # Flushing
    last_flush_date: date | None = None
    flush_interval_days: int | None = None
    # Lifecycle
    status: str
    out_of_service_reason: str | None = None
    install_date: date | None = None
    condition_rating: int | None = None
    ownership: str
    # Connection
    auxiliary_valve_id: uuid.UUID | None = None
    lateral_size_inches: float | None = None
    main_size_inches: float | None = None
    connected_main_id: uuid.UUID | None = None
    # Network
    pressure_zone_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float | None = None
    latitude: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FireHydrantListOut(BaseModel):
    hydrants: list[FireHydrantOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Water Service Connection (Point or LineString — generic geometry)
# ---------------------------------------------------------------------------


class WaterServiceCreate(BaseModel):
    asset_tag: str | None = None
    # Type
    service_type: str
    # Meter
    meter_number: str | None = None
    meter_size_inches: float | None = None
    meter_type: str | None = None
    # Service line
    service_line_material: str | None = None
    service_line_size_inches: float | None = None
    # Tap
    tap_main_id: uuid.UUID | None = None
    # Location / Account
    address: str | None = None
    account_number: str | None = None
    curb_stop_location: str | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — Point as lon/lat or LineString as coordinate array
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    coordinates: list[list[float]] | None = None


class WaterServiceUpdate(BaseModel):
    asset_tag: str | None = None
    service_type: str | None = None
    meter_number: str | None = None
    meter_size_inches: float | None = None
    meter_type: str | None = None
    service_line_material: str | None = None
    service_line_size_inches: float | None = None
    tap_main_id: uuid.UUID | None = None
    address: str | None = None
    account_number: str | None = None
    curb_stop_location: str | None = None
    status: str | None = None
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    coordinates: list[list[float]] | None = None


class WaterServiceOut(BaseModel):
    water_service_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    # Type
    service_type: str
    # Meter
    meter_number: str | None = None
    meter_size_inches: float | None = None
    meter_type: str | None = None
    # Service line
    service_line_material: str | None = None
    service_line_size_inches: float | None = None
    # Tap
    tap_main_id: uuid.UUID | None = None
    # Location / Account
    address: str | None = None
    account_number: str | None = None
    curb_stop_location: str | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — Point as lon/lat or LineString as coordinates
    longitude: float | None = None
    latitude: float | None = None
    coordinates: list[list[float]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WaterServiceListOut(BaseModel):
    water_services: list[WaterServiceOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Water Fitting (Point)
# ---------------------------------------------------------------------------


class WaterFittingCreate(BaseModel):
    asset_tag: str | None = None
    fitting_type: str
    material_code: str | None = None
    primary_size_inches: float | None = None
    secondary_size_inches: float | None = None
    status: str = "active"
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class WaterFittingUpdate(BaseModel):
    asset_tag: str | None = None
    fitting_type: str | None = None
    material_code: str | None = None
    primary_size_inches: float | None = None
    secondary_size_inches: float | None = None
    status: str | None = None
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class WaterFittingOut(BaseModel):
    water_fitting_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    fitting_type: str
    material_code: str | None = None
    primary_size_inches: float | None = None
    secondary_size_inches: float | None = None
    status: str
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float | None = None
    latitude: float | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WaterFittingListOut(BaseModel):
    water_fittings: list[WaterFittingOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Pressure Zone (Polygon)
# ---------------------------------------------------------------------------


class PressureZoneCreate(BaseModel):
    zone_name: str
    zone_number: str | None = None
    target_pressure_min_psi: float | None = None
    target_pressure_max_psi: float | None = None
    description: str | None = None
    # Geometry — Polygon as coordinate array [[[lon, lat], ...]]
    coordinates: list[list[list[float]]] | None = None


class PressureZoneUpdate(BaseModel):
    zone_name: str | None = None
    zone_number: str | None = None
    target_pressure_min_psi: float | None = None
    target_pressure_max_psi: float | None = None
    description: str | None = None
    coordinates: list[list[list[float]]] | None = None


class PressureZoneOut(BaseModel):
    pressure_zone_id: uuid.UUID
    tenant_id: uuid.UUID
    zone_name: str
    zone_number: str | None = None
    target_pressure_min_psi: float | None = None
    target_pressure_max_psi: float | None = None
    description: str | None = None
    # Geometry — Polygon as coordinate array
    coordinates: list[list[list[float]]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PressureZoneListOut(BaseModel):
    pressure_zones: list[PressureZoneOut]
    total: int
    page: int
    page_size: int
