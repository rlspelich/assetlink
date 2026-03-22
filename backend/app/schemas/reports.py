"""Pydantic schemas for the Reports API."""

import uuid
from datetime import date

from pydantic import BaseModel

from app.schemas.dashboard import (
    AgeBucket,
    CategoryBucket,
    ConditionBucket,
    SheetingBucket,
)


# ---------------------------------------------------------------
# Shared bucket types for reports
# ---------------------------------------------------------------


class PriorityBucket(BaseModel):
    priority: str
    created: int
    completed: int
    open: int


class WorkTypeBucket(BaseModel):
    work_type: str
    count: int


class StatusBucket(BaseModel):
    status: str
    count: int


class MonthBucket(BaseModel):
    month: str  # "2026-01"
    created: int
    completed: int


class AssigneeBucket(BaseModel):
    user_id: uuid.UUID | None
    user_name: str
    completed: int
    open: int


class TypeBucket(BaseModel):
    inspection_type: str
    count: int


class InspectionMonthBucket(BaseModel):
    month: str
    completed: int


class InspectorBucket(BaseModel):
    user_id: uuid.UUID | None
    user_name: str
    completed: int


class ConditionRatingBucket(BaseModel):
    """Condition rating distribution for inspections (1-5)."""
    rating: int | None
    count: int


# ---------------------------------------------------------------
# Work Order Report
# ---------------------------------------------------------------


class WorkOrderReportOut(BaseModel):
    # Time period
    start_date: date
    end_date: date

    # KPI cards
    total_created: int
    total_completed: int
    total_open: int
    total_cancelled: int

    # Response times (in days)
    avg_days_to_complete: float | None
    avg_emergency_response_days: float | None

    # By priority
    by_priority: list[PriorityBucket]

    # By work type
    by_work_type: list[WorkTypeBucket]

    # By status
    by_status: list[StatusBucket]

    # By month (for trend charts)
    by_month: list[MonthBucket]

    # By assigned user
    by_assignee: list[AssigneeBucket]

    # Assets affected
    total_assets_affected: int
    signs_affected: int
    supports_affected: int


# ---------------------------------------------------------------
# Inspection Report
# ---------------------------------------------------------------


class InspectionReportOut(BaseModel):
    start_date: date
    end_date: date

    # KPIs
    total_completed: int
    total_open: int
    signs_inspected: int  # unique signs inspected in period
    coverage_rate: float | None  # signs_inspected / total_signs * 100

    # Follow-up
    follow_ups_required: int
    follow_ups_with_wo: int  # inspections that generated work orders
    follow_up_rate: float | None  # follow_ups_required / total_completed * 100

    # Condition findings
    avg_condition_rating: float | None
    condition_distribution: list[ConditionRatingBucket]

    # Retro results
    retro_readings_taken: int
    retro_pass_count: int
    retro_fail_count: int
    retro_pass_rate: float | None

    # By type
    by_type: list[TypeBucket]

    # By month
    by_month: list[InspectionMonthBucket]

    # By inspector
    by_inspector: list[InspectorBucket]


# ---------------------------------------------------------------
# Inventory Report
# ---------------------------------------------------------------


class InventoryReportOut(BaseModel):
    as_of_date: date

    # Totals
    total_signs: int
    total_supports: int

    # By condition
    condition_distribution: list[ConditionBucket]

    # By status
    status_distribution: list[StatusBucket]

    # By category
    category_distribution: list[CategoryBucket]

    # By age
    age_distribution: list[AgeBucket]

    # By sheeting type
    sheeting_distribution: list[SheetingBucket]

    # Compliance
    signs_with_retro_data: int
    signs_passing_retro: int
    signs_failing_retro: int
    compliance_rate: float | None

    # Replacement forecast
    overdue_for_replacement: int
    due_within_90_days: int
    due_within_1_year: int
    estimated_replacement_cost: float

    # Activity in period (last 30 days)
    signs_added_last_30: int
    signs_removed_last_30: int


# ---------------------------------------------------------------
# Crew Productivity Report
# ---------------------------------------------------------------


class CrewMemberStats(BaseModel):
    user_id: uuid.UUID
    user_name: str
    role: str
    # Work orders
    wos_assigned: int
    wos_completed: int
    avg_days_to_complete: float | None
    # Inspections
    inspections_completed: int
    signs_inspected: int


class CrewProductivityReportOut(BaseModel):
    start_date: date
    end_date: date

    # Per crew member
    crew_stats: list[CrewMemberStats]
