import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class InspectionAssetCreate(BaseModel):
    asset_type: str  # "sign", "sign_support"
    asset_id: uuid.UUID
    condition_rating: int | None = Field(None, ge=1, le=5)
    findings: str | None = None
    defects: dict | None = None
    retroreflectivity_value: float | None = None
    passes_minimum_retro: bool | None = None
    action_recommended: str | None = None  # replace, repair, monitor, ok
    status: str = "inspected"  # inspected, needs_action, deferred, ok


class InspectionAssetOut(BaseModel):
    inspection_asset_id: uuid.UUID
    inspection_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_type: str
    asset_id: uuid.UUID
    condition_rating: int | None = None
    findings: str | None = None
    defects: dict | None = None
    retroreflectivity_value: float | None = None
    passes_minimum_retro: bool | None = None
    action_recommended: str | None = None
    status: str
    asset_label: str | None = None  # Denormalized display name
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InspectionCreate(BaseModel):
    asset_type: str | None = None
    asset_id: uuid.UUID | None = None
    sign_id: uuid.UUID | None = None
    support_id: uuid.UUID | None = None  # Auto-attaches support + all its signs
    work_order_id: uuid.UUID | None = None
    inspection_type: str
    inspection_date: date
    inspector_id: uuid.UUID | None = None
    status: str = "completed"
    condition_rating: int | None = Field(None, ge=1, le=5)
    findings: str | None = None
    defects: dict | None = None
    recommendations: str | None = None
    repairs_made: str | None = None
    retroreflectivity_value: float | None = None
    passes_minimum_retro: bool | None = None
    follow_up_required: bool = False
    custom_fields: dict | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)
    assets: list[InspectionAssetCreate] | None = None  # Multi-asset inspection


class InspectionUpdate(BaseModel):
    inspection_type: str | None = None
    inspection_date: date | None = None
    inspector_id: uuid.UUID | None = None
    status: str | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    findings: str | None = None
    defects: dict | None = None
    recommendations: str | None = None
    repairs_made: str | None = None
    retroreflectivity_value: float | None = None
    passes_minimum_retro: bool | None = None
    follow_up_required: bool | None = None
    custom_fields: dict | None = None
    assets_to_add: list[InspectionAssetCreate] | None = None
    assets_to_remove: list[uuid.UUID] | None = None  # inspection_asset_id list


class InspectionOut(BaseModel):
    inspection_id: uuid.UUID
    tenant_id: uuid.UUID
    inspection_number: str | None = None
    asset_type: str | None = None
    asset_id: uuid.UUID | None = None
    sign_id: uuid.UUID | None = None
    work_order_id: uuid.UUID | None = None
    inspection_type: str
    inspection_date: date
    inspector_id: uuid.UUID | None = None
    status: str
    condition_rating: int | None = None
    findings: str | None = None
    defects: dict | None = None
    recommendations: str | None = None
    repairs_made: str | None = None
    retroreflectivity_value: float | None = None
    passes_minimum_retro: bool | None = None
    follow_up_required: bool
    follow_up_work_order_id: uuid.UUID | None = None
    custom_fields: dict | None = None
    assets: list[InspectionAssetOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InspectionListOut(BaseModel):
    inspections: list[InspectionOut]
    total: int
    page: int
    page_size: int
