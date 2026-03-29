import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Reference Table Out Schemas
# ---------------------------------------------------------------------------


class SewerMaterialTypeOut(BaseModel):
    code: str
    description: str
    expected_life_years: int | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class SewerPipeShapeOut(BaseModel):
    code: str
    description: str
    is_active: bool

    model_config = {"from_attributes": True}


class ManholeTypeOut(BaseModel):
    code: str
    description: str
    is_active: bool

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Manhole-Pipe Junction Out Schema
# ---------------------------------------------------------------------------


class ManholePipeOut(BaseModel):
    manhole_pipe_id: uuid.UUID
    tenant_id: uuid.UUID
    manhole_id: uuid.UUID
    pipe_type: str
    pipe_id: uuid.UUID
    direction: str | None = None
    invert_elevation_ft: float | None = None
    clock_position: str | None = None
    pipe_diameter_inches: float | None = None

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Manhole (Point)
# ---------------------------------------------------------------------------


class ManholeCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    # Type / Construction
    manhole_type_code: str | None = None
    material: str | None = None
    diameter_inches: float | None = None
    # Elevations
    rim_elevation_ft: float | None = None
    invert_elevation_ft: float | None = None
    depth_ft: float | None = None
    # Cover / Frame
    cover_type: str | None = None
    cover_diameter_inches: float | None = None
    frame_type: str | None = None
    has_steps: bool | None = None
    step_material: str | None = None
    # Chimney / Cone
    cone_type: str | None = None
    chimney_height_inches: float | None = None
    # Channel / Bench
    channel_type: str | None = None
    bench_type: str | None = None
    # System classification
    system_type: str = "sanitary"
    # NASSCO MACP
    macp_grade: int | None = Field(None, ge=1, le=5)
    macp_score: float | None = None
    last_macp_date: date | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class ManholeUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    manhole_type_code: str | None = None
    material: str | None = None
    diameter_inches: float | None = None
    rim_elevation_ft: float | None = None
    invert_elevation_ft: float | None = None
    depth_ft: float | None = None
    cover_type: str | None = None
    cover_diameter_inches: float | None = None
    frame_type: str | None = None
    has_steps: bool | None = None
    step_material: str | None = None
    cone_type: str | None = None
    chimney_height_inches: float | None = None
    channel_type: str | None = None
    bench_type: str | None = None
    system_type: str | None = None
    macp_grade: int | None = Field(None, ge=1, le=5)
    macp_score: float | None = None
    last_macp_date: date | None = None
    status: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class ManholeOut(BaseModel):
    manhole_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    # Type / Construction
    manhole_type_code: str | None = None
    material: str | None = None
    diameter_inches: float | None = None
    # Elevations
    rim_elevation_ft: float | None = None
    invert_elevation_ft: float | None = None
    depth_ft: float | None = None
    # Cover / Frame
    cover_type: str | None = None
    cover_diameter_inches: float | None = None
    frame_type: str | None = None
    has_steps: bool | None = None
    step_material: str | None = None
    # Chimney / Cone
    cone_type: str | None = None
    chimney_height_inches: float | None = None
    # Channel / Bench
    channel_type: str | None = None
    bench_type: str | None = None
    # System classification
    system_type: str
    # NASSCO MACP
    macp_grade: int | None = None
    macp_score: float | None = None
    last_macp_date: date | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    condition_rating: int | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float
    latitude: float
    # Pipe connection count
    pipe_connection_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ManholeListOut(BaseModel):
    manholes: list[ManholeOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Sewer Main — Gravity (LineString)
# ---------------------------------------------------------------------------


class SewerMainCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    # Material / Physical
    material_code: str | None = None
    shape_code: str | None = None
    diameter_inches: float | None = None
    height_inches: float | None = None
    width_inches: float | None = None
    length_feet: float | None = None
    # Lining / Rehab
    lining_type: str | None = None
    lining_date: date | None = None
    lining_thickness_mm: float | None = None
    # Burial
    depth_ft_upstream: float | None = None
    depth_ft_downstream: float | None = None
    # Hydraulics
    slope_pct: float | None = None
    upstream_invert_ft: float | None = None
    downstream_invert_ft: float | None = None
    # Network topology
    upstream_manhole_id: uuid.UUID | None = None
    downstream_manhole_id: uuid.UUID | None = None
    # System classification
    system_type: str = "sanitary"
    # Ownership
    owner: str = "public"
    maintained_by: str | None = None
    # NASSCO PACP
    pacp_grade: int | None = Field(None, ge=1, le=5)
    pacp_structural_score: float | None = None
    pacp_om_score: float | None = None
    last_pacp_date: date | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    expected_life_years: int | None = None
    replacement_cost: float | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required, list of [lon, lat] coordinate pairs
    coordinates: list[list[float]] = Field(..., min_length=2)


class SewerMainUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    material_code: str | None = None
    shape_code: str | None = None
    diameter_inches: float | None = None
    height_inches: float | None = None
    width_inches: float | None = None
    length_feet: float | None = None
    lining_type: str | None = None
    lining_date: date | None = None
    lining_thickness_mm: float | None = None
    depth_ft_upstream: float | None = None
    depth_ft_downstream: float | None = None
    slope_pct: float | None = None
    upstream_invert_ft: float | None = None
    downstream_invert_ft: float | None = None
    upstream_manhole_id: uuid.UUID | None = None
    downstream_manhole_id: uuid.UUID | None = None
    system_type: str | None = None
    owner: str | None = None
    maintained_by: str | None = None
    pacp_grade: int | None = Field(None, ge=1, le=5)
    pacp_structural_score: float | None = None
    pacp_om_score: float | None = None
    last_pacp_date: date | None = None
    status: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    expected_life_years: int | None = None
    replacement_cost: float | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    coordinates: list[list[float]] | None = Field(None, min_length=2)


class SewerMainOut(BaseModel):
    sewer_main_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    # Material / Physical
    material_code: str | None = None
    shape_code: str | None = None
    diameter_inches: float | None = None
    height_inches: float | None = None
    width_inches: float | None = None
    length_feet: float | None = None
    # Lining / Rehab
    lining_type: str | None = None
    lining_date: date | None = None
    lining_thickness_mm: float | None = None
    # Burial
    depth_ft_upstream: float | None = None
    depth_ft_downstream: float | None = None
    # Hydraulics
    slope_pct: float | None = None
    upstream_invert_ft: float | None = None
    downstream_invert_ft: float | None = None
    # Network topology
    upstream_manhole_id: uuid.UUID | None = None
    downstream_manhole_id: uuid.UUID | None = None
    # System classification
    system_type: str
    # Ownership
    owner: str
    maintained_by: str | None = None
    # NASSCO PACP
    pacp_grade: int | None = None
    pacp_structural_score: float | None = None
    pacp_om_score: float | None = None
    last_pacp_date: date | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    condition_rating: int | None = None
    expected_life_years: int | None = None
    replacement_cost: float | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as coordinate array for LineString
    coordinates: list[list[float]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SewerMainListOut(BaseModel):
    sewer_mains: list[SewerMainOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Force Main — Pressurized (LineString)
# ---------------------------------------------------------------------------


class ForceMainCreate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    # Material / Physical
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    pressure_class: str | None = None
    # Burial
    depth_feet: float | None = None
    # Network
    lift_station_id: uuid.UUID | None = None
    discharge_manhole_id: uuid.UUID | None = None
    # Cathodic protection
    has_cathodic_protection: bool | None = None
    cp_test_date: date | None = None
    # Air release valves
    arv_count: int | None = None
    # Ownership
    owner: str = "public"
    maintained_by: str | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required, list of [lon, lat] coordinate pairs
    coordinates: list[list[float]] = Field(..., min_length=2)


class ForceMainUpdate(BaseModel):
    asset_tag: str | None = None
    description: str | None = None
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    pressure_class: str | None = None
    depth_feet: float | None = None
    lift_station_id: uuid.UUID | None = None
    discharge_manhole_id: uuid.UUID | None = None
    has_cathodic_protection: bool | None = None
    cp_test_date: date | None = None
    arv_count: int | None = None
    owner: str | None = None
    maintained_by: str | None = None
    status: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    coordinates: list[list[float]] | None = Field(None, min_length=2)


class ForceMainOut(BaseModel):
    force_main_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    description: str | None = None
    # Material / Physical
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    pressure_class: str | None = None
    # Burial
    depth_feet: float | None = None
    # Network
    lift_station_id: uuid.UUID | None = None
    discharge_manhole_id: uuid.UUID | None = None
    # Cathodic protection
    has_cathodic_protection: bool | None = None
    cp_test_date: date | None = None
    # Air release valves
    arv_count: int | None = None
    # Ownership
    owner: str
    maintained_by: str | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    condition_rating: int | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as coordinate array for LineString
    coordinates: list[list[float]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ForceMainListOut(BaseModel):
    force_mains: list[ForceMainOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Lift Station / Pump Station (Point)
# ---------------------------------------------------------------------------


class LiftStationCreate(BaseModel):
    asset_tag: str | None = None
    station_name: str | None = None
    description: str | None = None
    # Wet Well
    wet_well_depth_ft: float | None = None
    wet_well_diameter_ft: float | None = None
    wet_well_material: str | None = None
    # Pumps
    pump_count: int | None = None
    pump_type: str | None = None
    pump_hp: float | None = None
    firm_capacity_gpm: float | None = None
    design_capacity_gpm: float | None = None
    # Controls
    control_type: str | None = None
    has_scada: bool | None = None
    has_backup_power: bool | None = None
    backup_power_type: str | None = None
    has_alarm: bool | None = None
    alarm_type: str | None = None
    # Electrical
    electrical_service: str | None = None
    voltage: int | None = None
    # Ownership
    owner: str = "public"
    maintained_by: str | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class LiftStationUpdate(BaseModel):
    asset_tag: str | None = None
    station_name: str | None = None
    description: str | None = None
    wet_well_depth_ft: float | None = None
    wet_well_diameter_ft: float | None = None
    wet_well_material: str | None = None
    pump_count: int | None = None
    pump_type: str | None = None
    pump_hp: float | None = None
    firm_capacity_gpm: float | None = None
    design_capacity_gpm: float | None = None
    control_type: str | None = None
    has_scada: bool | None = None
    has_backup_power: bool | None = None
    backup_power_type: str | None = None
    has_alarm: bool | None = None
    alarm_type: str | None = None
    electrical_service: str | None = None
    voltage: int | None = None
    owner: str | None = None
    maintained_by: str | None = None
    status: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class LiftStationOut(BaseModel):
    lift_station_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    station_name: str | None = None
    description: str | None = None
    # Wet Well
    wet_well_depth_ft: float | None = None
    wet_well_diameter_ft: float | None = None
    wet_well_material: str | None = None
    # Pumps
    pump_count: int | None = None
    pump_type: str | None = None
    pump_hp: float | None = None
    firm_capacity_gpm: float | None = None
    design_capacity_gpm: float | None = None
    # Controls
    control_type: str | None = None
    has_scada: bool | None = None
    has_backup_power: bool | None = None
    backup_power_type: str | None = None
    has_alarm: bool | None = None
    alarm_type: str | None = None
    # Electrical
    electrical_service: str | None = None
    voltage: int | None = None
    # Ownership
    owner: str
    maintained_by: str | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    condition_rating: int | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float
    latitude: float
    # Force main count
    force_main_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LiftStationListOut(BaseModel):
    lift_stations: list[LiftStationOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Sewer Lateral / Service Connection (Point or LineString — generic geometry)
# ---------------------------------------------------------------------------


class SewerLateralCreate(BaseModel):
    asset_tag: str | None = None
    # Type
    service_type: str | None = None
    # Material / Physical
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    depth_at_main_ft: float | None = None
    # Connection
    connected_main_id: uuid.UUID | None = None
    tap_location: str | None = None
    has_cleanout: bool | None = None
    cleanout_location: str | None = None
    # Location / Account
    address: str | None = None
    account_number: str | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required. Point: {longitude, latitude}. LineString: {coordinates}.
    # Provide either longitude+latitude OR coordinates, not both.
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    coordinates: list[list[float]] | None = Field(None, min_length=2)


class SewerLateralUpdate(BaseModel):
    asset_tag: str | None = None
    service_type: str | None = None
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    depth_at_main_ft: float | None = None
    connected_main_id: uuid.UUID | None = None
    tap_location: str | None = None
    has_cleanout: bool | None = None
    cleanout_location: str | None = None
    address: str | None = None
    account_number: str | None = None
    status: str | None = None
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    coordinates: list[list[float]] | None = Field(None, min_length=2)


class SewerLateralOut(BaseModel):
    sewer_lateral_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    # Type
    service_type: str | None = None
    # Material / Physical
    material_code: str | None = None
    diameter_inches: float | None = None
    length_feet: float | None = None
    depth_at_main_ft: float | None = None
    # Connection
    connected_main_id: uuid.UUID | None = None
    tap_location: str | None = None
    has_cleanout: bool | None = None
    cleanout_location: str | None = None
    # Location / Account
    address: str | None = None
    account_number: str | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — Point as lon/lat, LineString as coordinates, or both if needed
    longitude: float | None = None
    latitude: float | None = None
    coordinates: list[list[float]] | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SewerLateralListOut(BaseModel):
    sewer_laterals: list[SewerLateralOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Sewer Fitting (Point)
# ---------------------------------------------------------------------------


class SewerFittingCreate(BaseModel):
    asset_tag: str | None = None
    fitting_type: str  # required
    material_code: str | None = None
    primary_size_inches: float | None = None
    secondary_size_inches: float | None = None
    # Lifecycle
    status: str = "active"
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry — required
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class SewerFittingUpdate(BaseModel):
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


class SewerFittingOut(BaseModel):
    sewer_fitting_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    fitting_type: str
    material_code: str | None = None
    primary_size_inches: float | None = None
    secondary_size_inches: float | None = None
    # Lifecycle
    status: str
    install_date: date | None = None
    custom_fields: dict | None = None
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float
    latitude: float
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SewerFittingListOut(BaseModel):
    sewer_fittings: list[SewerFittingOut]
    total: int
    page: int
    page_size: int
