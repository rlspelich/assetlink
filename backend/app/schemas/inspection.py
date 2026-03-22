import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field


class InspectionCreate(BaseModel):
    asset_type: str | None = None
    asset_id: uuid.UUID | None = None
    sign_id: uuid.UUID | None = None
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


class InspectionOut(BaseModel):
    inspection_id: uuid.UUID
    tenant_id: uuid.UUID
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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InspectionListOut(BaseModel):
    inspections: list[InspectionOut]
    total: int
    page: int
    page_size: int
