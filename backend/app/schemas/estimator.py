"""Pydantic schemas for the Estimator module — estimates, pricing, confidence, regional factors."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Regional Factor
# ---------------------------------------------------------------------------

class RegionalFactorOut(BaseModel):
    regional_factor_id: uuid.UUID
    state_code: str
    state_name: str
    factor: Decimal
    source: str
    year: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Price Stats (from pricing engine)
# ---------------------------------------------------------------------------

class PriceStatsOut(BaseModel):
    pay_item_code: str
    data_points: int
    weighted_avg: Decimal
    median: Decimal
    p10: Decimal
    p25: Decimal
    p50: Decimal
    p75: Decimal
    p90: Decimal
    min_price: Decimal
    max_price: Decimal
    nominal_avg: Decimal
    earliest_date: date | None = None
    latest_date: date | None = None
    unit: str = ""
    description: str = ""


# ---------------------------------------------------------------------------
# Confidence Scoring
# ---------------------------------------------------------------------------

class ConfidenceOut(BaseModel):
    percentile: int | None = None
    label: str  # very_low, low, fair, high, very_high, no_data
    color: str  # green, blue, yellow, red, gray
    data_points: int = 0
    p25: Decimal | None = None
    p50: Decimal | None = None
    p75: Decimal | None = None
    weighted_avg: Decimal | None = None


# ---------------------------------------------------------------------------
# Award Item Price History (from award_item reference table)
# ---------------------------------------------------------------------------

class AwardPricePoint(BaseModel):
    letting_date: date
    unit_price: Decimal
    adjusted_unit_price: Decimal | None = None
    quantity: Decimal
    contract_number: str
    county: str = ""
    district: str = ""


class AwardPriceHistoryOut(BaseModel):
    pay_item_code: str
    description: str
    unit: str
    data_points: list[AwardPricePoint]
    total_records: int
    avg_unit_price: Decimal | None = None
    median_unit_price: Decimal | None = None
    min_unit_price: Decimal | None = None
    max_unit_price: Decimal | None = None
    avg_adjusted_price: Decimal | None = None


# ---------------------------------------------------------------------------
# Estimate
# ---------------------------------------------------------------------------

class EstimateCreate(BaseModel):
    name: str = Field(..., max_length=150)
    description: str = ""
    target_state: str = Field("IL", max_length=2)
    target_district: str = ""
    use_inflation_adjustment: bool = True
    target_year: int | None = None


class EstimateUpdate(BaseModel):
    name: str | None = Field(None, max_length=150)
    description: str | None = None
    status: str | None = None  # draft, final, archived
    target_state: str | None = Field(None, max_length=2)
    target_district: str | None = None
    use_inflation_adjustment: bool | None = None
    target_year: int | None = None


class EstimateItemOut(BaseModel):
    estimate_item_id: uuid.UUID
    estimate_id: uuid.UUID
    pay_item_code: str
    description: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    unit_price_source: str
    adjusted_unit_price: Decimal | None = None
    regional_unit_price: Decimal | None = None
    extension: Decimal
    confidence_pct: int | None = None
    confidence_label: str | None = None
    price_p25: Decimal | None = None
    price_p50: Decimal | None = None
    price_p75: Decimal | None = None
    price_count: int = 0
    sort_order: int = 0

    model_config = {"from_attributes": True}


class EstimateOut(BaseModel):
    estimate_id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    description: str
    status: str
    target_state: str
    target_district: str
    use_inflation_adjustment: bool
    target_year: int | None = None
    total_nominal: Decimal
    total_adjusted: Decimal
    total_with_regional: Decimal
    confidence_low: Decimal | None = None
    confidence_high: Decimal | None = None
    item_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class EstimateDetailOut(EstimateOut):
    items: list[EstimateItemOut] = []


class EstimateListOut(BaseModel):
    estimates: list[EstimateOut]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Estimate Item Create/Update
# ---------------------------------------------------------------------------

class EstimateItemCreate(BaseModel):
    pay_item_code: str = Field(..., max_length=20)
    quantity: Decimal
    description: str = ""
    unit: str = ""


class EstimateItemUpdate(BaseModel):
    quantity: Decimal | None = None
    unit_price: Decimal | None = None
    unit_price_source: str | None = None  # "manual" when user overrides
    description: str | None = None
    sort_order: int | None = None


# ---------------------------------------------------------------------------
# Seed results
# ---------------------------------------------------------------------------

class SeedResultOut(BaseModel):
    created: int = 0
    updated: int = 0
    message: str = ""
