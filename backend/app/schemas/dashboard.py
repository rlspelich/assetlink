import uuid
from datetime import date

from pydantic import BaseModel


class ConditionBucket(BaseModel):
    rating: int | None  # 1-5 or None for unrated
    label: str
    count: int


class AgeBucket(BaseModel):
    range: str  # "0-2 years", "2-5 years", "5-10 years", "10-15 years", "15+ years", "Unknown"
    count: int


class SheetingBucket(BaseModel):
    sheeting_type: str  # "Type I", "Type III", "Type XI", "Unknown", etc.
    count: int


class CategoryBucket(BaseModel):
    category: str
    count: int


class PrioritySign(BaseModel):
    sign_id: uuid.UUID
    asset_tag: str | None
    mutcd_code: str | None
    description: str | None
    road_name: str | None
    intersection_with: str | None
    condition_rating: int | None
    status: str
    install_date: date | None
    expected_replacement_date: date | None
    days_overdue: int | None  # days past expected_replacement_date (negative = not yet due)
    measured_value: float | None  # retro reading
    passes_minimum: bool | None
    sheeting_type: str | None
    last_inspected_date: date | None
    replacement_cost_estimate: float | None
    longitude: float
    latitude: float
    # Priority score (computed): higher = more urgent
    priority_score: int


class ComplianceDashboardOut(BaseModel):
    # --- KPI Cards ---
    total_signs: int
    total_supports: int

    # Compliance
    signs_passing_retro: int  # passes_minimum == True
    signs_failing_retro: int  # passes_minimum == False
    signs_retro_unknown: int  # passes_minimum is None (never measured)
    compliance_rate: float | None  # percentage of measured signs that pass (null if none measured)

    # Overdue
    signs_overdue_replacement: int  # expected_replacement_date < today
    signs_due_soon: int  # expected_replacement_date within next 90 days

    # Status issues
    signs_missing: int  # status = 'missing'
    signs_damaged: int  # status = 'damaged'
    signs_faded: int  # status = 'faded'

    # Inspection coverage
    signs_never_inspected: int  # last_inspected_date is None
    signs_inspection_overdue: int  # last_inspected_date > 2 years ago
    signs_inspected_recently: int  # last_inspected_date within last 6 months

    # --- Condition Distribution ---
    condition_distribution: list[ConditionBucket]

    # --- Age Distribution ---
    age_distribution: list[AgeBucket]

    # --- Sheeting Type Distribution ---
    sheeting_distribution: list[SheetingBucket]

    # --- Replacement Planning ---
    estimated_replacement_cost: float  # sum of replacement_cost_estimate for signs condition <= 2 or overdue
    replacements_this_year: int  # expected_replacement_date in current year
    replacements_next_year: int
    replacements_year_after: int

    # --- Priority Signs (Top 20 needing attention) ---
    priority_signs: list[PrioritySign]

    # --- Category Breakdown ---
    category_distribution: list[CategoryBucket]
