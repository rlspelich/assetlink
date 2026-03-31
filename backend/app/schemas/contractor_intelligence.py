"""
Pydantic schemas for Contractor Intelligence endpoints.

Covers: contractor profiles, bidding history, price tendencies,
geographic footprint, activity trends, head-to-head comparison,
and bid tab / job analysis.
"""
import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Contractor Profile
# ---------------------------------------------------------------------------


class ContractorProfileOut(BaseModel):
    contractor_pk: uuid.UUID
    contractor_id_code: str
    name: str
    total_bids: int
    total_wins: int
    win_rate: float  # 0.0-1.0
    avg_bid_total: Decimal | None = None
    total_bid_volume: Decimal = Decimal("0")
    total_won: Decimal = Decimal("0")  # $ won as low bidder
    on_table: Decimal = Decimal("0")  # $ available in contracts they bid on
    dollar_capture_pct: float = 0  # % of available $ captured
    first_bid_date: date | None = None
    last_bid_date: date | None = None
    active_years: int = 0
    counties: list[str] = []
    districts: list[str] = []


# ---------------------------------------------------------------------------
# Bidding History
# ---------------------------------------------------------------------------


class BiddingHistoryEntry(BaseModel):
    bid_id: uuid.UUID
    contract_id: uuid.UUID
    contract_number: str
    letting_date: date
    county: str
    district: str
    rank: int
    total: Decimal
    is_low: bool
    is_bad: bool
    num_bidders: int


class BiddingHistoryOut(BaseModel):
    entries: list[BiddingHistoryEntry]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Price Tendencies
# ---------------------------------------------------------------------------


class PriceTendencyItem(BaseModel):
    division: str
    contractor_avg_price: Decimal
    market_avg_price: Decimal
    variance_pct: float  # (contractor - market) / market * 100
    contractor_sample_count: int
    market_sample_count: int


class PriceTendencyOut(BaseModel):
    contractor_pk: uuid.UUID
    contractor_name: str
    tendencies: list[PriceTendencyItem]


# ---------------------------------------------------------------------------
# Geographic Footprint
# ---------------------------------------------------------------------------


class GeoFootprintEntry(BaseModel):
    name: str  # county or district name
    bid_count: int
    win_count: int
    win_rate: float
    total_volume: Decimal = Decimal("0")


class GeoFootprintOut(BaseModel):
    contractor_pk: uuid.UUID
    by_county: list[GeoFootprintEntry]
    by_district: list[GeoFootprintEntry]


# ---------------------------------------------------------------------------
# Activity Trend
# ---------------------------------------------------------------------------


class ActivityTrendPoint(BaseModel):
    year: int
    bid_count: int
    win_count: int
    total_bid_volume: Decimal = Decimal("0")


class ActivityTrendOut(BaseModel):
    contractor_pk: uuid.UUID
    trend: list[ActivityTrendPoint]


# ---------------------------------------------------------------------------
# Head-to-Head Comparison
# ---------------------------------------------------------------------------


class HeadToHeadContract(BaseModel):
    contract_id: uuid.UUID
    contract_number: str
    letting_date: date
    county: str
    contractor_a_rank: int
    contractor_a_total: Decimal
    contractor_b_rank: int
    contractor_b_total: Decimal
    winner: str  # "a", "b", or "other"


class HeadToHeadSummary(BaseModel):
    contractor_a_pk: uuid.UUID
    contractor_a_name: str
    contractor_b_pk: uuid.UUID
    contractor_b_name: str
    shared_contracts: int
    a_wins_vs_b: int
    b_wins_vs_a: int
    a_total_wins: int
    b_total_wins: int
    contracts: list[HeadToHeadContract]


class HeadToHeadItemComparison(BaseModel):
    pay_item_code: str
    description: str
    unit: str
    contractor_a_avg_price: Decimal
    contractor_b_avg_price: Decimal
    variance_pct: float  # (a - b) / b * 100 — positive means A is more expensive
    sample_count: int  # number of shared contracts with this item


class HeadToHeadItemsOut(BaseModel):
    contractor_a_name: str
    contractor_b_name: str
    items: list[HeadToHeadItemComparison]
    total: int
    page: int
    page_size: int


# ---------------------------------------------------------------------------
# Bid Tab / Job Analysis
# ---------------------------------------------------------------------------


class BidTabBidder(BaseModel):
    contractor_pk: uuid.UUID
    contractor_name: str
    contractor_id_code: str
    rank: int
    total: Decimal
    is_low: bool
    is_bad: bool


class BidTabLineItem(BaseModel):
    pay_item_code: str
    abbreviation: str
    unit: str
    quantity: Decimal
    prices: dict[str, Decimal | None]  # keyed by contractor_pk as string
    low_price: Decimal | None = None
    high_price: Decimal | None = None
    spread_pct: float | None = None  # (high - low) / low * 100


class BidTabOut(BaseModel):
    contract_id: uuid.UUID
    contract_number: str
    letting_date: date
    county: str
    district: str
    bidders: list[BidTabBidder]
    items: list[BidTabLineItem]
    total_items: int


class CategoryBreakdownEntry(BaseModel):
    division: str
    total: Decimal
    pct_of_contract: float
    item_count: int


class CategoryBreakdownOut(BaseModel):
    contract_id: uuid.UUID
    bid_id: uuid.UUID
    contractor_name: str
    breakdown: list[CategoryBreakdownEntry]
    grand_total: Decimal


# ---------------------------------------------------------------------------
# Market Analysis
# ---------------------------------------------------------------------------


class MarketPlayerEntry(BaseModel):
    rank: int
    contractor_pk: uuid.UUID
    contractor_name: str
    contractor_id_code: str
    jobs_bid: int
    jobs_won: int
    win_rate: float
    total_low: Decimal  # $ won as low bidder
    total_bid: Decimal  # $ total of all bids
    pct_won_of_bids: float  # % of jobs won out of jobs bid
    dollar_capture_pct: float  # % of available $ captured ($ won / $ on table)
    pct_left_on_table: float  # 100 - dollar_capture_pct


class MarketAnalysisOut(BaseModel):
    total_market_value: Decimal  # sum of all low bids in the filtered set
    total_contracts: int
    total_bidders: int
    filters_applied: dict  # echo back what was filtered
    players: list[MarketPlayerEntry]


# ---------------------------------------------------------------------------
# Letting Report
# ---------------------------------------------------------------------------


class LettingBidderEntry(BaseModel):
    contractor_name: str
    contractor_id_code: str
    contractor_pk: str | None = None
    rank: int
    total: Decimal
    is_low: bool
    variance_from_low: Decimal | None  # $ over low bid
    variance_pct: float | None  # % over low bid


class LettingContractEntry(BaseModel):
    contract_id: uuid.UUID
    contract_number: str
    county: str
    district: str
    item_count: int
    low_bidder_name: str
    low_bid_total: Decimal | None
    num_bidders: int
    bidders: list[LettingBidderEntry]


class LettingReportOut(BaseModel):
    letting_date: date
    total_contracts: int
    total_value: Decimal  # sum of low bids
    contracts: list[LettingContractEntry]


# ---------------------------------------------------------------------------
# Enhanced Pay Item Search
# ---------------------------------------------------------------------------


class PayItemSearchResult(BaseModel):
    """One occurrence of a pay item in a bid."""
    bid_item_id: uuid.UUID
    pay_item_code: str
    abbreviation: str
    unit: str
    quantity: Decimal
    unit_price: Decimal
    extension: Decimal
    contractor_name: str
    contractor_id_code: str
    contractor_pk: uuid.UUID
    contract_number: str
    contract_id: uuid.UUID
    letting_date: date
    county: str
    district: str
    rank: int
    is_low: bool


class PayItemSearchStats(BaseModel):
    count: int
    weighted_avg: Decimal | None
    straight_avg: Decimal | None
    median: Decimal | None
    high: Decimal | None
    low: Decimal | None
    total_quantity: Decimal | None


class PayItemSearchOut(BaseModel):
    results: list[PayItemSearchResult]
    total: int
    page: int
    page_size: int
    stats: PayItemSearchStats | None = None
