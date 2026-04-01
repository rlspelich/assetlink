"""
Reports API — KPI reports for government supervisors.

All reports use efficient SQL aggregation (COUNT, AVG, GROUP BY, FILTER).
No fetching all records into Python.
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import (
    case,
    distinct,
    extract,
    func,
    literal,
    select,
    text as sa_text,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.inspection_asset import InspectionAsset
from app.models.sign import Sign, SignSupport
from app.models.user import AppUser
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.dashboard import (
    AgeBucket,
    CategoryBucket,
    ConditionBucket,
    SheetingBucket,
)
from app.schemas.reports import (
    AssigneeBucket,
    ConditionRatingBucket,
    CrewMemberStats,
    CrewProductivityReportOut,
    InspectionMonthBucket,
    InspectionReportOut,
    InspectorBucket,
    InventoryReportOut,
    MonthBucket,
    PriorityBucket,
    StatusBucket,
    TypeBucket,
    WorkOrderReportOut,
    WorkTypeBucket,
)

router = APIRouter()

# Condition rating labels (reused from dashboard)
CONDITION_LABELS = {
    1: "Critical",
    2: "Poor",
    3: "Fair",
    4: "Good",
    5: "Excellent",
    None: "Unrated",
}

# Age bucket definitions (in years)
AGE_BUCKETS = [
    ("0-2 years", 0, 2),
    ("2-5 years", 2, 5),
    ("5-10 years", 5, 10),
    ("10-15 years", 10, 15),
    ("15+ years", 15, None),
]


# ---------------------------------------------------------------
# Work Order Report
# ---------------------------------------------------------------


@router.get("/work-orders", response_model=WorkOrderReportOut)
async def get_work_order_report(
    start_date: date | None = Query(default=None, description="Start of date range (default: 30 days ago)"),
    end_date: date | None = Query(default=None, description="End of date range (default: today)"),
    assigned_to: uuid.UUID | None = Query(default=None, description="Filter by assigned user"),
    priority: str | None = Query(default=None, description="Filter by priority (emergency, urgent, routine, planned)"),
    work_type: str | None = Query(default=None, description="Filter by work type"),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> WorkOrderReportOut:
    """Work order KPI report with breakdowns by priority, type, status, month, and assignee."""
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    # Base filter conditions
    base_filters = [
        WorkOrder.tenant_id == tenant_id,
        func.date(WorkOrder.created_at) >= start_date,
        func.date(WorkOrder.created_at) <= end_date,
    ]
    if assigned_to is not None:
        base_filters.append(WorkOrder.assigned_to == assigned_to)
    if priority is not None:
        base_filters.append(WorkOrder.priority == priority)
    if work_type is not None:
        base_filters.append(WorkOrder.work_type == work_type)

    # ---------------------------------------------------------------
    # 1. Main KPI stats — single pass with FILTER aggregates
    # ---------------------------------------------------------------
    stats_q = select(
        func.count().label("total_created"),
        func.count().filter(WorkOrder.status == "completed").label("total_completed"),
        func.count().filter(WorkOrder.status.in_(["open", "assigned", "in_progress", "on_hold"])).label("total_open"),
        func.count().filter(WorkOrder.status == "cancelled").label("total_cancelled"),
        # Avg days to complete (completed_date - created_at) for completed WOs
        func.avg(
            extract("epoch", WorkOrder.completed_date - WorkOrder.created_at) / 86400.0
        ).filter(
            WorkOrder.status == "completed",
            WorkOrder.completed_date.isnot(None),
        ).label("avg_days_to_complete"),
        # Avg emergency response days
        func.avg(
            extract("epoch", WorkOrder.completed_date - WorkOrder.created_at) / 86400.0
        ).filter(
            WorkOrder.status == "completed",
            WorkOrder.completed_date.isnot(None),
            WorkOrder.priority == "emergency",
        ).label("avg_emergency_response_days"),
    ).where(*base_filters)

    stats = (await db.execute(stats_q)).one()

    # ---------------------------------------------------------------
    # 2. By priority
    # ---------------------------------------------------------------
    priority_q = (
        select(
            WorkOrder.priority,
            func.count().label("created"),
            func.count().filter(WorkOrder.status == "completed").label("completed"),
            func.count().filter(WorkOrder.status.in_(["open", "assigned", "in_progress", "on_hold"])).label("open"),
        )
        .where(*base_filters)
        .group_by(WorkOrder.priority)
        .order_by(WorkOrder.priority)
    )
    priority_rows = (await db.execute(priority_q)).all()
    by_priority = [
        PriorityBucket(priority=r.priority, created=r.created, completed=r.completed, open=r.open)
        for r in priority_rows
    ]

    # ---------------------------------------------------------------
    # 3. By work type
    # ---------------------------------------------------------------
    work_type_q = (
        select(
            WorkOrder.work_type,
            func.count().label("cnt"),
        )
        .where(*base_filters)
        .group_by(WorkOrder.work_type)
        .order_by(func.count().desc())
    )
    work_type_rows = (await db.execute(work_type_q)).all()
    by_work_type = [
        WorkTypeBucket(work_type=r.work_type, count=r.cnt) for r in work_type_rows
    ]

    # ---------------------------------------------------------------
    # 4. By status
    # ---------------------------------------------------------------
    status_q = (
        select(
            WorkOrder.status,
            func.count().label("cnt"),
        )
        .where(*base_filters)
        .group_by(WorkOrder.status)
        .order_by(func.count().desc())
    )
    status_rows = (await db.execute(status_q)).all()
    by_status = [StatusBucket(status=r.status, count=r.cnt) for r in status_rows]

    # ---------------------------------------------------------------
    # 5. By month (trend)
    # ---------------------------------------------------------------
    month_trunc = func.date_trunc("month", WorkOrder.created_at)
    month_q = (
        select(
            month_trunc.label("month"),
            func.count().label("created"),
            func.count().filter(WorkOrder.status == "completed").label("completed"),
        )
        .where(*base_filters)
        .group_by(month_trunc)
        .order_by(month_trunc)
    )
    month_rows = (await db.execute(month_q)).all()
    by_month = [
        MonthBucket(
            month=r.month.strftime("%Y-%m") if r.month else "Unknown",
            created=r.created,
            completed=r.completed,
        )
        for r in month_rows
    ]

    # ---------------------------------------------------------------
    # 6. By assignee
    # ---------------------------------------------------------------
    assignee_q = (
        select(
            WorkOrder.assigned_to,
            func.coalesce(
                func.concat(AppUser.first_name, " ", AppUser.last_name),
                literal("Unassigned"),
            ).label("user_name"),
            func.count().filter(WorkOrder.status == "completed").label("completed"),
            func.count().filter(WorkOrder.status.in_(["open", "assigned", "in_progress", "on_hold"])).label("open"),
        )
        .outerjoin(AppUser, WorkOrder.assigned_to == AppUser.user_id)
        .where(*base_filters)
        .group_by(WorkOrder.assigned_to, AppUser.first_name, AppUser.last_name)
        .order_by(func.count().desc())
    )
    assignee_rows = (await db.execute(assignee_q)).all()
    by_assignee = [
        AssigneeBucket(
            user_id=r.assigned_to,
            user_name=r.user_name if r.assigned_to else "Unassigned",
            completed=r.completed,
            open=r.open,
        )
        for r in assignee_rows
    ]

    # ---------------------------------------------------------------
    # 7. Assets affected (via work_order_asset junction)
    # ---------------------------------------------------------------
    # Subquery: work order IDs in date range
    wo_ids_subq = (
        select(WorkOrder.work_order_id)
        .where(*base_filters)
        .subquery()
    )
    assets_q = select(
        func.count(distinct(WorkOrderAsset.asset_id)).label("total"),
        func.count(distinct(WorkOrderAsset.asset_id)).filter(
            WorkOrderAsset.asset_type == "sign"
        ).label("signs"),
        func.count(distinct(WorkOrderAsset.asset_id)).filter(
            WorkOrderAsset.asset_type == "sign_support"
        ).label("supports"),
    ).where(
        WorkOrderAsset.work_order_id.in_(select(wo_ids_subq)),
        WorkOrderAsset.tenant_id == tenant_id,
    )
    assets_result = (await db.execute(assets_q)).one()

    return WorkOrderReportOut(
        start_date=start_date,
        end_date=end_date,
        total_created=stats.total_created,
        total_completed=stats.total_completed,
        total_open=stats.total_open,
        total_cancelled=stats.total_cancelled,
        avg_days_to_complete=(
            round(float(stats.avg_days_to_complete), 1)
            if stats.avg_days_to_complete is not None
            else None
        ),
        avg_emergency_response_days=(
            round(float(stats.avg_emergency_response_days), 1)
            if stats.avg_emergency_response_days is not None
            else None
        ),
        by_priority=by_priority,
        by_work_type=by_work_type,
        by_status=by_status,
        by_month=by_month,
        by_assignee=by_assignee,
        total_assets_affected=assets_result.total,
        signs_affected=assets_result.signs,
        supports_affected=assets_result.supports,
    )


# ---------------------------------------------------------------
# Inspection Report
# ---------------------------------------------------------------


@router.get("/inspections", response_model=InspectionReportOut)
async def get_inspection_report(
    start_date: date | None = Query(default=None, description="Start of date range (default: 30 days ago)"),
    end_date: date | None = Query(default=None, description="End of date range (default: today)"),
    inspector_id: uuid.UUID | None = Query(default=None, description="Filter by inspector"),
    inspection_type: str | None = Query(default=None, description="Filter by inspection type"),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InspectionReportOut:
    """Inspection KPI report with condition findings, retro results, and inspector productivity."""
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    base_filters = [
        Inspection.tenant_id == tenant_id,
        Inspection.inspection_date >= start_date,
        Inspection.inspection_date <= end_date,
    ]
    if inspector_id is not None:
        base_filters.append(Inspection.inspector_id == inspector_id)
    if inspection_type is not None:
        base_filters.append(Inspection.inspection_type == inspection_type)

    # ---------------------------------------------------------------
    # 1. Main KPIs
    # ---------------------------------------------------------------
    stats_q = select(
        func.count().filter(Inspection.status == "completed").label("total_completed"),
        func.count().filter(Inspection.status.in_(["open", "in_progress"])).label("total_open"),
        func.count(distinct(Inspection.sign_id)).filter(
            Inspection.sign_id.isnot(None),
            Inspection.status == "completed",
        ).label("signs_inspected"),
        # Follow-up
        func.count().filter(Inspection.follow_up_required.is_(True)).label("follow_ups_required"),
        func.count().filter(
            Inspection.follow_up_required.is_(True),
            Inspection.follow_up_work_order_id.isnot(None),
        ).label("follow_ups_with_wo"),
        # Condition
        func.avg(Inspection.condition_rating).filter(
            Inspection.condition_rating.isnot(None),
        ).label("avg_condition_rating"),
    ).where(*base_filters)

    stats = (await db.execute(stats_q)).one()

    # Retro stats from inspection_asset (where multi-asset retro data lives)
    insp_ids_subq = (
        select(Inspection.inspection_id)
        .where(*base_filters)
        .subquery()
    )
    retro_q = select(
        func.count().filter(InspectionAsset.retroreflectivity_value.isnot(None)).label("retro_readings_taken"),
        func.count().filter(InspectionAsset.passes_minimum_retro.is_(True)).label("retro_pass_count"),
        func.count().filter(InspectionAsset.passes_minimum_retro.is_(False)).label("retro_fail_count"),
    ).where(
        InspectionAsset.inspection_id.in_(select(insp_ids_subq)),
        InspectionAsset.tenant_id == tenant_id,
    )
    retro_stats = (await db.execute(retro_q)).one()

    # Total signs in tenant (for coverage rate)
    total_signs_q = select(func.count()).where(Sign.tenant_id == tenant_id)
    total_signs = (await db.execute(total_signs_q)).scalar_one()

    total_completed = stats.total_completed
    signs_inspected = stats.signs_inspected
    follow_ups_required = stats.follow_ups_required
    retro_pass = retro_stats.retro_pass_count
    retro_fail = retro_stats.retro_fail_count
    retro_total = retro_pass + retro_fail

    coverage_rate = round((signs_inspected / total_signs) * 100, 1) if total_signs > 0 else None
    follow_up_rate = round((follow_ups_required / total_completed) * 100, 1) if total_completed > 0 else None
    retro_pass_rate = round((retro_pass / retro_total) * 100, 1) if retro_total > 0 else None

    # ---------------------------------------------------------------
    # 2. Condition distribution
    # ---------------------------------------------------------------
    cond_q = (
        select(
            Inspection.condition_rating,
            func.count().label("cnt"),
        )
        .where(*base_filters, Inspection.condition_rating.isnot(None))
        .group_by(Inspection.condition_rating)
        .order_by(Inspection.condition_rating)
    )
    cond_rows = (await db.execute(cond_q)).all()
    condition_distribution = [
        ConditionRatingBucket(rating=r.condition_rating, count=r.cnt)
        for r in cond_rows
    ]

    # ---------------------------------------------------------------
    # 3. By type
    # ---------------------------------------------------------------
    type_q = (
        select(
            Inspection.inspection_type,
            func.count().label("cnt"),
        )
        .where(*base_filters)
        .group_by(Inspection.inspection_type)
        .order_by(func.count().desc())
    )
    type_rows = (await db.execute(type_q)).all()
    by_type = [TypeBucket(inspection_type=r.inspection_type, count=r.cnt) for r in type_rows]

    # ---------------------------------------------------------------
    # 4. By month
    # ---------------------------------------------------------------
    month_trunc = func.date_trunc("month", Inspection.inspection_date)
    month_q = (
        select(
            month_trunc.label("month"),
            func.count().filter(Inspection.status == "completed").label("completed"),
        )
        .where(*base_filters)
        .group_by(month_trunc)
        .order_by(month_trunc)
    )
    month_rows = (await db.execute(month_q)).all()
    by_month = [
        InspectionMonthBucket(
            month=r.month.strftime("%Y-%m") if r.month else "Unknown",
            completed=r.completed,
        )
        for r in month_rows
    ]

    # ---------------------------------------------------------------
    # 5. By inspector
    # ---------------------------------------------------------------
    inspector_q = (
        select(
            Inspection.inspector_id,
            func.coalesce(
                func.concat(AppUser.first_name, " ", AppUser.last_name),
                literal("Unknown"),
            ).label("user_name"),
            func.count().filter(Inspection.status == "completed").label("completed"),
        )
        .outerjoin(AppUser, Inspection.inspector_id == AppUser.user_id)
        .where(*base_filters)
        .group_by(Inspection.inspector_id, AppUser.first_name, AppUser.last_name)
        .order_by(func.count().desc())
    )
    inspector_rows = (await db.execute(inspector_q)).all()
    by_inspector = [
        InspectorBucket(
            user_id=r.inspector_id,
            user_name=r.user_name if r.inspector_id else "Unknown",
            completed=r.completed,
        )
        for r in inspector_rows
    ]

    return InspectionReportOut(
        start_date=start_date,
        end_date=end_date,
        total_completed=total_completed,
        total_open=stats.total_open,
        signs_inspected=signs_inspected,
        coverage_rate=coverage_rate,
        follow_ups_required=follow_ups_required,
        follow_ups_with_wo=stats.follow_ups_with_wo,
        follow_up_rate=follow_up_rate,
        avg_condition_rating=(
            round(float(stats.avg_condition_rating), 1)
            if stats.avg_condition_rating is not None
            else None
        ),
        condition_distribution=condition_distribution,
        retro_readings_taken=retro_stats.retro_readings_taken,
        retro_pass_count=retro_pass,
        retro_fail_count=retro_fail,
        retro_pass_rate=retro_pass_rate,
        by_type=by_type,
        by_month=by_month,
        by_inspector=by_inspector,
    )


# ---------------------------------------------------------------
# Inventory Report
# ---------------------------------------------------------------


@router.get("/inventory", response_model=InventoryReportOut)
async def get_inventory_report(
    as_of_date: date | None = Query(default=None, description="Snapshot date (default: today)"),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> InventoryReportOut:
    """Inventory snapshot report with condition, compliance, and replacement forecast."""
    today = date.today()
    if as_of_date is None:
        as_of_date = today

    thirty_days_ago = as_of_date - timedelta(days=30)
    ninety_days_ahead = as_of_date + timedelta(days=90)
    one_year_ahead = as_of_date + timedelta(days=365)

    # ---------------------------------------------------------------
    # 1. Main stats — single pass
    # ---------------------------------------------------------------
    stats_q = select(
        func.count().label("total_signs"),
        # Retro compliance
        func.count().filter(
            (Sign.passes_minimum.is_(True)) | (Sign.passes_minimum.is_(False))
        ).label("signs_with_retro_data"),
        func.count().filter(Sign.passes_minimum.is_(True)).label("signs_passing_retro"),
        func.count().filter(Sign.passes_minimum.is_(False)).label("signs_failing_retro"),
        # Replacement forecast
        func.count().filter(
            Sign.expected_replacement_date < as_of_date
        ).label("overdue_for_replacement"),
        func.count().filter(
            Sign.expected_replacement_date >= as_of_date,
            Sign.expected_replacement_date <= ninety_days_ahead,
        ).label("due_within_90_days"),
        func.count().filter(
            Sign.expected_replacement_date >= as_of_date,
            Sign.expected_replacement_date <= one_year_ahead,
        ).label("due_within_1_year"),
        # Estimated replacement cost for overdue + due within 1 year
        func.coalesce(
            func.sum(Sign.replacement_cost_estimate).filter(
                Sign.expected_replacement_date <= one_year_ahead,
            ),
            0,
        ).label("estimated_replacement_cost"),
        # Activity last 30 days
        func.count().filter(
            func.date(Sign.created_at) >= thirty_days_ago,
            func.date(Sign.created_at) <= as_of_date,
        ).label("signs_added_last_30"),
        func.count().filter(
            Sign.status == "removed",
            Sign.updated_at.isnot(None),
            func.date(Sign.updated_at) >= thirty_days_ago,
            func.date(Sign.updated_at) <= as_of_date,
        ).label("signs_removed_last_30"),
    ).where(Sign.tenant_id == tenant_id)

    stats = (await db.execute(stats_q)).one()

    # Support count
    support_q = select(func.count()).where(SignSupport.tenant_id == tenant_id)
    total_supports = (await db.execute(support_q)).scalar_one()

    # Compliance rate
    retro_measured = stats.signs_passing_retro + stats.signs_failing_retro
    compliance_rate = (
        round((stats.signs_passing_retro / retro_measured) * 100, 1)
        if retro_measured > 0
        else None
    )

    # ---------------------------------------------------------------
    # 2. Condition distribution
    # ---------------------------------------------------------------
    cond_q = (
        select(
            Sign.condition_rating,
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(Sign.condition_rating)
        .order_by(Sign.condition_rating)
    )
    cond_rows = (await db.execute(cond_q)).all()
    condition_distribution = [
        ConditionBucket(
            rating=r.condition_rating,
            label=CONDITION_LABELS.get(r.condition_rating, "Unknown"),
            count=r.cnt,
        )
        for r in cond_rows
    ]

    # ---------------------------------------------------------------
    # 3. Status distribution
    # ---------------------------------------------------------------
    status_q = (
        select(
            Sign.status,
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(Sign.status)
        .order_by(func.count().desc())
    )
    status_rows = (await db.execute(status_q)).all()
    status_distribution = [StatusBucket(status=r.status, count=r.cnt) for r in status_rows]

    # ---------------------------------------------------------------
    # 4. Category distribution
    # ---------------------------------------------------------------
    cat_col = func.coalesce(Sign.sign_category, "uncategorized")
    cat_q = (
        select(
            cat_col.label("cat"),
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(cat_col)
        .order_by(func.count().desc())
    )
    cat_rows = (await db.execute(cat_q)).all()
    category_distribution = [CategoryBucket(category=r.cat, count=r.cnt) for r in cat_rows]

    # ---------------------------------------------------------------
    # 5. Age distribution
    # ---------------------------------------------------------------
    age_case = case(
        (Sign.install_date.is_(None), literal("Unknown")),
        *[
            (
                (
                    func.age(func.current_date(), Sign.install_date)
                    < sa_text(f"interval '{upper} years'")
                )
                & (
                    func.age(func.current_date(), Sign.install_date)
                    >= sa_text(f"interval '{lower} years'")
                ),
                literal(label),
            )
            for label, lower, upper in AGE_BUCKETS
            if upper is not None
        ],
        else_=literal("15+ years"),
    )
    age_q = (
        select(
            age_case.label("age_range"),
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(age_case)
    )
    age_rows = (await db.execute(age_q)).all()
    age_counts = {r.age_range: r.cnt for r in age_rows}
    bucket_order = [b[0] for b in AGE_BUCKETS] + ["Unknown"]
    age_distribution = [
        AgeBucket(range=label, count=age_counts.get(label, 0))
        for label in bucket_order
    ]

    # ---------------------------------------------------------------
    # 6. Sheeting distribution
    # ---------------------------------------------------------------
    sheeting_col = func.coalesce(Sign.sheeting_type, "Unknown")
    sheeting_q = (
        select(
            sheeting_col.label("st"),
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(sheeting_col)
        .order_by(func.count().desc())
    )
    sheeting_rows = (await db.execute(sheeting_q)).all()
    sheeting_distribution = [
        SheetingBucket(sheeting_type=r.st, count=r.cnt) for r in sheeting_rows
    ]

    return InventoryReportOut(
        as_of_date=as_of_date,
        total_signs=stats.total_signs,
        total_supports=total_supports,
        condition_distribution=condition_distribution,
        status_distribution=status_distribution,
        category_distribution=category_distribution,
        age_distribution=age_distribution,
        sheeting_distribution=sheeting_distribution,
        signs_with_retro_data=stats.signs_with_retro_data,
        signs_passing_retro=stats.signs_passing_retro,
        signs_failing_retro=stats.signs_failing_retro,
        compliance_rate=compliance_rate,
        overdue_for_replacement=stats.overdue_for_replacement,
        due_within_90_days=stats.due_within_90_days,
        due_within_1_year=stats.due_within_1_year,
        estimated_replacement_cost=float(stats.estimated_replacement_cost),
        signs_added_last_30=stats.signs_added_last_30,
        signs_removed_last_30=stats.signs_removed_last_30,
    )


# ---------------------------------------------------------------
# Crew Productivity Report
# ---------------------------------------------------------------


@router.get("/crew-productivity", response_model=CrewProductivityReportOut)
async def get_crew_productivity_report(
    start_date: date | None = Query(default=None, description="Start of date range (default: 30 days ago)"),
    end_date: date | None = Query(default=None, description="End of date range (default: today)"),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> CrewProductivityReportOut:
    """Crew productivity report — per-member work order and inspection stats."""
    today = date.today()
    if end_date is None:
        end_date = today
    if start_date is None:
        start_date = end_date - timedelta(days=30)

    # ---------------------------------------------------------------
    # Get all active users for the tenant
    # ---------------------------------------------------------------
    users_q = (
        select(AppUser.user_id, AppUser.first_name, AppUser.last_name, AppUser.role)
        .where(AppUser.tenant_id == tenant_id, AppUser.is_active.is_(True))
        .order_by(AppUser.last_name, AppUser.first_name)
    )
    user_rows = (await db.execute(users_q)).all()

    if not user_rows:
        return CrewProductivityReportOut(
            start_date=start_date,
            end_date=end_date,
            crew_stats=[],
        )

    user_ids = [r.user_id for r in user_rows]
    user_map = {
        r.user_id: {
            "name": f"{r.first_name} {r.last_name}",
            "role": r.role,
        }
        for r in user_rows
    }

    # ---------------------------------------------------------------
    # Work order stats per user
    # ---------------------------------------------------------------
    wo_date_filters = [
        WorkOrder.tenant_id == tenant_id,
        func.date(WorkOrder.created_at) >= start_date,
        func.date(WorkOrder.created_at) <= end_date,
    ]
    wo_q = (
        select(
            WorkOrder.assigned_to,
            func.count().label("wos_assigned"),
            func.count().filter(WorkOrder.status == "completed").label("wos_completed"),
            func.avg(
                extract("epoch", WorkOrder.completed_date - WorkOrder.created_at) / 86400.0
            ).filter(
                WorkOrder.status == "completed",
                WorkOrder.completed_date.isnot(None),
            ).label("avg_days"),
        )
        .where(
            *wo_date_filters,
            WorkOrder.assigned_to.in_(user_ids),
        )
        .group_by(WorkOrder.assigned_to)
    )
    wo_rows = (await db.execute(wo_q)).all()
    wo_stats = {
        r.assigned_to: {
            "wos_assigned": r.wos_assigned,
            "wos_completed": r.wos_completed,
            "avg_days": round(float(r.avg_days), 1) if r.avg_days is not None else None,
        }
        for r in wo_rows
    }

    # ---------------------------------------------------------------
    # Inspection stats per user
    # ---------------------------------------------------------------
    insp_q = (
        select(
            Inspection.inspector_id,
            func.count().filter(Inspection.status == "completed").label("inspections_completed"),
            func.count(distinct(Inspection.sign_id)).filter(
                Inspection.sign_id.isnot(None),
                Inspection.status == "completed",
            ).label("signs_inspected"),
        )
        .where(
            Inspection.tenant_id == tenant_id,
            Inspection.inspection_date >= start_date,
            Inspection.inspection_date <= end_date,
            Inspection.inspector_id.in_(user_ids),
        )
        .group_by(Inspection.inspector_id)
    )
    insp_rows = (await db.execute(insp_q)).all()
    insp_stats = {
        r.inspector_id: {
            "inspections_completed": r.inspections_completed,
            "signs_inspected": r.signs_inspected,
        }
        for r in insp_rows
    }

    # ---------------------------------------------------------------
    # Assemble per-user stats
    # ---------------------------------------------------------------
    crew_stats = []
    for uid in user_ids:
        wo = wo_stats.get(uid, {})
        insp = insp_stats.get(uid, {})
        info = user_map[uid]
        crew_stats.append(
            CrewMemberStats(
                user_id=uid,
                user_name=info["name"],
                role=info["role"],
                wos_assigned=wo.get("wos_assigned", 0),
                wos_completed=wo.get("wos_completed", 0),
                avg_days_to_complete=wo.get("avg_days"),
                inspections_completed=insp.get("inspections_completed", 0),
                signs_inspected=insp.get("signs_inspected", 0),
            )
        )

    return CrewProductivityReportOut(
        start_date=start_date,
        end_date=end_date,
        crew_stats=crew_stats,
    )
