import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.work_order_asset import WorkOrderAssetCreate, WorkOrderAssetOut


class WorkOrderCreate(BaseModel):
    asset_type: str | None = None
    asset_id: uuid.UUID | None = None
    sign_id: uuid.UUID | None = None  # DEPRECATED: use assets instead
    support_id: uuid.UUID | None = None  # Create WOAs for support + all its signs
    assets: list[WorkOrderAssetCreate] | None = None  # Multi-asset work order
    description: str | None = None
    work_type: str
    priority: str = "routine"
    status: str = "open"
    category: str | None = None
    assigned_to: uuid.UUID | None = None
    supervisor_id: uuid.UUID | None = None
    requested_by: str | None = None
    due_date: date | None = None
    projected_start_date: date | None = None
    projected_finish_date: date | None = None
    address: str | None = None
    location_notes: str | None = None
    instructions: str | None = None
    notes: str | None = None
    custom_fields: dict | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class WorkOrderUpdate(BaseModel):
    description: str | None = None
    work_type: str | None = None
    priority: str | None = None
    status: str | None = None
    category: str | None = None
    resolution: str | None = None
    assigned_to: uuid.UUID | None = None
    supervisor_id: uuid.UUID | None = None
    due_date: date | None = None
    projected_start_date: date | None = None
    projected_finish_date: date | None = None
    actual_start_date: date | None = None
    actual_finish_date: date | None = None
    address: str | None = None
    location_notes: str | None = None
    instructions: str | None = None
    notes: str | None = None
    labor_hours: float | None = None
    labor_cost: float | None = None
    material_cost: float | None = None
    equipment_cost: float | None = None
    total_cost: float | None = None
    materials_used: dict | None = None
    custom_fields: dict | None = None
    assets_to_add: list[WorkOrderAssetCreate] | None = None
    assets_to_remove: list[uuid.UUID] | None = None  # work_order_asset_id list


class WorkOrderOut(BaseModel):
    work_order_id: uuid.UUID
    tenant_id: uuid.UUID
    work_order_number: str | None = None
    asset_type: str | None = None
    asset_id: uuid.UUID | None = None
    sign_id: uuid.UUID | None = None
    description: str | None = None
    work_type: str
    priority: str
    status: str
    category: str | None = None
    resolution: str | None = None
    assigned_to: uuid.UUID | None = None
    supervisor_id: uuid.UUID | None = None
    requested_by: str | None = None
    due_date: date | None = None
    projected_start_date: date | None = None
    projected_finish_date: date | None = None
    actual_start_date: date | None = None
    actual_finish_date: date | None = None
    completed_date: datetime | None = None
    closed_date: datetime | None = None
    address: str | None = None
    location_notes: str | None = None
    labor_hours: float | None = None
    labor_cost: float | None = None
    material_cost: float | None = None
    equipment_cost: float | None = None
    total_cost: float | None = None
    instructions: str | None = None
    notes: str | None = None
    materials_used: dict | None = None
    custom_fields: dict | None = None
    assets: list[WorkOrderAssetOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkOrderListOut(BaseModel):
    work_orders: list[WorkOrderOut]
    total: int
    page: int
    page_size: int
