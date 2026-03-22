import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


# --- Sign Type (MUTCD lookup) ---


class SignTypeOut(BaseModel):
    mutcd_code: str
    category: str
    description: str
    standard_width: float | None = None
    standard_height: float | None = None
    shape: str | None = None
    background_color: str | None = None
    legend_color: str | None = None
    default_sheeting_type: str | None = None
    expected_life_years: int | None = None
    thumbnail_url: str | None = None

    model_config = {"from_attributes": True}


# --- Sign ---


class SignCreate(BaseModel):
    asset_tag: str | None = None
    mutcd_code: str | None = None
    description: str | None = None
    legend_text: str | None = None
    sign_category: str | None = None
    size_width_inches: float | None = None
    size_height_inches: float | None = None
    shape: str | None = None
    background_color: str | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    # Location
    road_name: str | None = None
    address: str | None = None
    side_of_road: str | None = None
    intersection_with: str | None = None
    location_notes: str | None = None
    # Retroreflectivity
    sheeting_type: str | None = None
    sheeting_manufacturer: str | None = None
    expected_life_years: int | None = None
    install_date: date | None = None
    # Lifecycle
    status: str = "active"
    facing_direction: int | None = Field(None, ge=0, le=360)
    mount_height_inches: float | None = None
    offset_from_road_inches: float | None = None
    custom_fields: dict | None = None
    # Geometry — required unless support_id is provided (inherits from support)
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    # Optional support link
    support_id: uuid.UUID | None = None


class SignUpdate(BaseModel):
    asset_tag: str | None = None
    mutcd_code: str | None = None
    description: str | None = None
    legend_text: str | None = None
    sign_category: str | None = None
    size_width_inches: float | None = None
    size_height_inches: float | None = None
    shape: str | None = None
    background_color: str | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    road_name: str | None = None
    address: str | None = None
    side_of_road: str | None = None
    intersection_with: str | None = None
    location_notes: str | None = None
    sheeting_type: str | None = None
    sheeting_manufacturer: str | None = None
    expected_life_years: int | None = None
    install_date: date | None = None
    status: str | None = None
    facing_direction: int | None = Field(None, ge=0, le=360)
    mount_height_inches: float | None = None
    offset_from_road_inches: float | None = None
    custom_fields: dict | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    support_id: uuid.UUID | None = None


class SignOut(BaseModel):
    sign_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    support_id: uuid.UUID | None = None
    mutcd_code: str | None = None
    description: str | None = None
    legend_text: str | None = None
    sign_category: str | None = None
    size_width_inches: float | None = None
    size_height_inches: float | None = None
    shape: str | None = None
    background_color: str | None = None
    condition_rating: int | None = None
    road_name: str | None = None
    address: str | None = None
    side_of_road: str | None = None
    intersection_with: str | None = None
    location_notes: str | None = None
    sheeting_type: str | None = None
    sheeting_manufacturer: str | None = None
    expected_life_years: int | None = None
    install_date: date | None = None
    expected_replacement_date: date | None = None
    last_measured_date: date | None = None
    measured_value: float | None = None
    passes_minimum: bool | None = None
    last_inspected_date: date | None = None
    last_replaced_date: date | None = None
    replacement_cost_estimate: float | None = None
    status: str
    facing_direction: int | None = None
    mount_height_inches: float | None = None
    offset_from_road_inches: float | None = None
    custom_fields: dict | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float
    latitude: float
    # Basic support info (populated when support_id is set)
    support_type: str | None = None
    support_status: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SignListOut(BaseModel):
    signs: list[SignOut]
    total: int
    page: int
    page_size: int


class SignImportOut(BaseModel):
    created: int
    skipped: int
    total_rows: int
    errors: list[dict]
    column_mapping: dict[str, str]
