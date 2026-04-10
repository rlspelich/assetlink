import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


# --- Contract ---


class ContractCreate(BaseModel):
    number: str = Field(..., max_length=20)
    letting_date: date
    letting_type: str = ""
    agency: str = "IDOT"
    county: str = ""
    district: str = ""
    municipality: str = ""
    section_no: str = ""
    job_no: str = ""
    project_no: str = ""
    letting_no: str = ""
    item_count: int = 0
    source_file: str = ""


class ContractUpdate(BaseModel):
    number: str | None = Field(None, max_length=20)
    letting_date: date | None = None
    letting_type: str | None = None
    agency: str | None = None
    county: str | None = None
    district: str | None = None
    municipality: str | None = None
    section_no: str | None = None
    job_no: str | None = None
    project_no: str | None = None
    letting_no: str | None = None
    item_count: int | None = None
    source_file: str | None = None


class ContractOut(BaseModel):
    contract_id: uuid.UUID
    number: str
    letting_date: date
    letting_type: str
    agency: str
    county: str
    district: str
    municipality: str
    section_no: str
    job_no: str
    project_no: str
    letting_no: str
    item_count: int
    project_type: str = ""
    source_file: str
    bid_count: int = 0
    low_bid_total: Decimal | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContractListOut(BaseModel):
    contracts: list[ContractOut]
    total: int
    page: int
    page_size: int


class ContractDetailOut(ContractOut):
    """Contract with nested bids."""
    bids: list["BidOut"] = []


# --- Contractor ---


class ContractorCreate(BaseModel):
    contractor_id_code: str = Field("", max_length=10)
    name: str = Field(..., max_length=150)


class ContractorUpdate(BaseModel):
    contractor_id_code: str | None = Field(None, max_length=10)
    name: str | None = Field(None, max_length=150)


class ContractorOut(BaseModel):
    contractor_pk: uuid.UUID
    contractor_id_code: str
    name: str
    status: str = "unknown"
    first_bid_date: date | None = None
    last_bid_date: date | None = None
    total_bids: int = 0
    bid_count: int = 0
    win_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContractorListOut(BaseModel):
    contractors: list[ContractorOut]
    total: int
    page: int
    page_size: int


# --- Bid ---


class BidCreate(BaseModel):
    contract_id: uuid.UUID
    contractor_pk: uuid.UUID
    rank: int = 0
    total: Decimal = Decimal("0")
    doc_total: Decimal = Decimal("0")
    is_low: bool = False
    is_bad: bool = False
    has_alt: bool = False
    no_omitted: int | None = None


class BidOut(BaseModel):
    bid_id: uuid.UUID
    contract_id: uuid.UUID
    contractor_pk: uuid.UUID
    contractor_name: str = ""
    contractor_id_code: str = ""
    rank: int
    total: Decimal
    doc_total: Decimal
    is_low: bool
    is_bad: bool
    has_alt: bool
    no_omitted: int | None = None
    item_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BidDetailOut(BidOut):
    """Bid with nested line items."""
    items: list["BidItemOut"] = []


# --- BidItem ---


class BidItemCreate(BaseModel):
    bid_id: uuid.UUID
    pay_item_code: str = Field(..., max_length=20)
    abbreviation: str = ""
    unit: str = ""
    quantity: Decimal
    unit_price: Decimal = Decimal("0")
    was_omitted: bool = False


class BidItemOut(BaseModel):
    bid_item_id: uuid.UUID
    bid_id: uuid.UUID
    pay_item_code: str
    abbreviation: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    was_omitted: bool
    extension: Decimal = Decimal("0")  # quantity * unit_price, computed

    model_config = {"from_attributes": True}


# --- AwardItem ---


class AwardItemCreate(BaseModel):
    letting_date: date
    pay_item_code: str = Field(..., max_length=20)
    abbreviation: str = ""
    item_number: str = ""
    unit: str = ""
    quantity: Decimal
    unit_price: Decimal = Decimal("0")
    contract_number: str = Field(..., max_length=20)
    county: str = ""
    district: str = ""
    source_file: str = ""


class AwardItemOut(BaseModel):
    award_item_id: uuid.UUID
    letting_date: date
    pay_item_code: str
    abbreviation: str
    item_number: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    contract_number: str
    county: str
    district: str
    source_file: str

    model_config = {"from_attributes": True}


class AwardItemListOut(BaseModel):
    award_items: list[AwardItemOut]
    total: int
    page: int
    page_size: int


# --- PayItem (reference table) ---


class PayItemOut(BaseModel):
    agency: str
    code: str
    description: str
    abbreviation: str
    unit: str
    division: str
    category: str
    subcategory: str
    is_metric: bool
    is_temporary: bool
    is_special: bool

    model_config = {"from_attributes": True}

    @field_validator("abbreviation", "unit", "division", "category", "subcategory", mode="before")
    @classmethod
    def _none_to_empty_string(cls, v: str | None) -> str:
        # PayItem columns allow NULL in the DB (no nullable=False), but the API contract is str.
        return v if v is not None else ""


class PayItemListOut(BaseModel):
    pay_items: list[PayItemOut]
    total: int
    page: int
    page_size: int


# --- Price History (computed, not a direct model) ---


class PriceHistoryPoint(BaseModel):
    """One data point in a pay item's price history."""
    letting_date: date
    unit_price: Decimal
    adjusted_unit_price: Decimal | None = None  # inflation-adjusted
    quantity: Decimal
    contract_number: str
    contractor_name: str = ""
    county: str = ""
    district: str = ""
    agency: str = "IDOT"


class PriceHistoryOut(BaseModel):
    pay_item_code: str
    description: str
    unit: str
    data_points: list[PriceHistoryPoint]
    total_records: int
    avg_unit_price: Decimal | None = None
    median_unit_price: Decimal | None = None
    min_unit_price: Decimal | None = None
    max_unit_price: Decimal | None = None
    avg_adjusted_price: Decimal | None = None  # inflation-adjusted average


# --- CostIndex ---


class CostIndexOut(BaseModel):
    cost_index_id: uuid.UUID
    source: str
    year: int
    quarter: int | None = None
    value: Decimal
    base_year: int
    fetched_at: datetime

    model_config = {"from_attributes": True}


# --- Import results ---


class BidTabImportOut(BaseModel):
    """Result of parsing and importing a bid tabulation file."""
    contracts_created: int = 0
    contracts_updated: int = 0
    contractors_created: int = 0
    bids_created: int = 0
    bid_items_created: int = 0
    files_processed: int = 0
    files_skipped: int = 0
    warnings: list[str] = []
    errors: list[str] = []
    duration_seconds: float | None = None


# Rebuild forward refs for nested models
ContractDetailOut.model_rebuild()
BidDetailOut.model_rebuild()
