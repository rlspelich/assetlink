import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.schemas.sign import SignOut


# --- Sign Support ---


class SignSupportCreate(BaseModel):
    asset_tag: str | None = None
    support_type: str
    support_material: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    height_inches: float | None = None
    status: str = "active"
    notes: str | None = None
    # Geometry — required
    longitude: float = Field(..., ge=-180, le=180)
    latitude: float = Field(..., ge=-90, le=90)


class SignSupportUpdate(BaseModel):
    asset_tag: str | None = None
    support_type: str | None = None
    support_material: str | None = None
    install_date: date | None = None
    condition_rating: int | None = Field(None, ge=1, le=5)
    height_inches: float | None = None
    status: str | None = None
    notes: str | None = None
    longitude: float | None = Field(None, ge=-180, le=180)
    latitude: float | None = Field(None, ge=-90, le=90)


class SignSupportOut(BaseModel):
    support_id: uuid.UUID
    tenant_id: uuid.UUID
    asset_tag: str | None = None
    support_type: str
    support_material: str | None = None
    install_date: date | None = None
    condition_rating: int | None = None
    height_inches: float | None = None
    status: str
    notes: str | None = None
    # Geometry as lon/lat for easy consumption
    longitude: float
    latitude: float
    # Count of signs attached to this support
    sign_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SignSupportListOut(BaseModel):
    supports: list[SignSupportOut]
    total: int
    page: int
    page_size: int


class SignSupportDetailOut(SignSupportOut):
    """Extended response that includes the list of signs on this support."""

    signs: list[SignOut] = []
