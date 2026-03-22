import uuid
from datetime import datetime

from pydantic import BaseModel


class WorkOrderAssetCreate(BaseModel):
    asset_type: str  # "sign", "sign_support"
    asset_id: uuid.UUID
    damage_notes: str | None = None
    action_required: str | None = None  # replace, reinstall, repair, remove, inspect


class WorkOrderAssetUpdate(BaseModel):
    damage_notes: str | None = None
    action_required: str | None = None
    resolution: str | None = None
    status: str | None = None  # pending, in_progress, completed, skipped


class WorkOrderAssetOut(BaseModel):
    work_order_asset_id: uuid.UUID
    work_order_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_type: str
    asset_id: uuid.UUID
    damage_notes: str | None = None
    action_required: str | None = None
    resolution: str | None = None
    status: str
    asset_label: str | None = None  # Denormalized display name, e.g. "R1-1 — Stop Sign"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
