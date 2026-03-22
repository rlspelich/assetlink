import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, extract, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.sign import Sign, SignSupport
from app.schemas.dashboard import (
    AgeBucket,
    CategoryBucket,
    ComplianceDashboardOut,
    ConditionBucket,
    PrioritySign,
    SheetingBucket,
)

router = APIRouter()

# Condition rating labels
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


@router.get("/compliance", response_model=ComplianceDashboardOut)
async def get_compliance_dashboard(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """
    Return pre-computed compliance dashboard statistics for the current tenant.

    All data is computed in SQL — no bulk Python-side processing.
    """
    today = date.today()
    ninety_days = today + timedelta(days=90)
    two_years_ago = today - timedelta(days=730)
    six_months_ago = today - timedelta(days=183)
    current_year = today.year

    # ---------------------------------------------------------------
    # 1. Main stats query — single pass with FILTER aggregates
    # ---------------------------------------------------------------
    stats_query = select(
        func.count().label("total"),
        # Compliance
        func.count().filter(Sign.passes_minimum.is_(True)).label("passing"),
        func.count().filter(Sign.passes_minimum.is_(False)).label("failing"),
        func.count().filter(Sign.passes_minimum.is_(None)).label("retro_unknown"),
        # Overdue
        func.count()
        .filter(Sign.expected_replacement_date < today)
        .label("overdue"),
        func.count()
        .filter(
            Sign.expected_replacement_date >= today,
            Sign.expected_replacement_date <= ninety_days,
        )
        .label("due_soon"),
        # Status
        func.count().filter(Sign.status == "missing").label("missing"),
        func.count().filter(Sign.status == "damaged").label("damaged"),
        func.count().filter(Sign.status == "faded").label("faded"),
        # Inspection coverage
        func.count()
        .filter(Sign.last_inspected_date.is_(None))
        .label("never_inspected"),
        func.count()
        .filter(Sign.last_inspected_date < two_years_ago)
        .label("inspection_overdue"),
        func.count()
        .filter(Sign.last_inspected_date >= six_months_ago)
        .label("inspected_recently"),
        # Replacement cost estimate for critical/poor condition or overdue signs
        func.coalesce(
            func.sum(Sign.replacement_cost_estimate).filter(
                (Sign.condition_rating <= 2) | (Sign.expected_replacement_date < today)
            ),
            0,
        ).label("est_cost"),
    ).where(Sign.tenant_id == tenant_id)

    stats_result = (await db.execute(stats_query)).one()

    total_signs = stats_result.total
    passing = stats_result.passing
    failing = stats_result.failing

    # Compliance rate: percentage of measured signs that pass
    measured = passing + failing
    compliance_rate = round((passing / measured) * 100, 1) if measured > 0 else None

    # ---------------------------------------------------------------
    # 2. Support count
    # ---------------------------------------------------------------
    support_count_query = select(func.count()).where(
        SignSupport.tenant_id == tenant_id
    )
    total_supports = (await db.execute(support_count_query)).scalar_one()

    # ---------------------------------------------------------------
    # 3. Condition distribution
    # ---------------------------------------------------------------
    condition_query = (
        select(
            Sign.condition_rating,
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(Sign.condition_rating)
        .order_by(Sign.condition_rating)
    )
    condition_rows = (await db.execute(condition_query)).all()
    condition_distribution = [
        ConditionBucket(
            rating=row.condition_rating,
            label=CONDITION_LABELS.get(row.condition_rating, "Unknown"),
            count=row.cnt,
        )
        for row in condition_rows
    ]

    # ---------------------------------------------------------------
    # 4. Age distribution
    # ---------------------------------------------------------------
    from sqlalchemy import text as sa_text

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

    age_query = (
        select(
            age_case.label("age_range"),
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(age_case)
    )
    age_rows = (await db.execute(age_query)).all()

    # Build a dict so we can return buckets in consistent order
    age_counts = {row.age_range: row.cnt for row in age_rows}
    bucket_order = [b[0] for b in AGE_BUCKETS] + ["Unknown"]
    age_distribution = [
        AgeBucket(range=label, count=age_counts.get(label, 0))
        for label in bucket_order
    ]

    # ---------------------------------------------------------------
    # 5. Sheeting distribution
    # ---------------------------------------------------------------
    sheeting_col = func.coalesce(Sign.sheeting_type, "Unknown")
    sheeting_query = (
        select(
            sheeting_col.label("st"),
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(sheeting_col)
        .order_by(func.count().desc())
    )
    sheeting_rows = (await db.execute(sheeting_query)).all()
    sheeting_distribution = [
        SheetingBucket(sheeting_type=row.st, count=row.cnt) for row in sheeting_rows
    ]

    # ---------------------------------------------------------------
    # 6. Category distribution
    # ---------------------------------------------------------------
    cat_col = func.coalesce(Sign.sign_category, "uncategorized")
    category_query = (
        select(
            cat_col.label("cat"),
            func.count().label("cnt"),
        )
        .where(Sign.tenant_id == tenant_id)
        .group_by(cat_col)
        .order_by(func.count().desc())
    )
    category_rows = (await db.execute(category_query)).all()
    category_distribution = [
        CategoryBucket(category=row.cat, count=row.cnt) for row in category_rows
    ]

    # ---------------------------------------------------------------
    # 7. Replacement planning by year
    # ---------------------------------------------------------------
    replacement_query = select(
        func.count()
        .filter(extract("year", Sign.expected_replacement_date) == current_year)
        .label("this_year"),
        func.count()
        .filter(extract("year", Sign.expected_replacement_date) == current_year + 1)
        .label("next_year"),
        func.count()
        .filter(extract("year", Sign.expected_replacement_date) == current_year + 2)
        .label("year_after"),
    ).where(Sign.tenant_id == tenant_id)
    replacement_result = (await db.execute(replacement_query)).one()

    # ---------------------------------------------------------------
    # 8. Priority signs — top 20 needing attention
    # ---------------------------------------------------------------
    # Compute a priority score in SQL. Higher = more urgent.
    priority_score = (
        # Failing retro
        case((Sign.passes_minimum.is_(False), 100), else_=0)
        # Status: missing
        + case((Sign.status == "missing", 90), else_=0)
        # Condition 1 (critical)
        + case((Sign.condition_rating == 1, 80), else_=0)
        # Status: damaged
        + case((Sign.status == "damaged", 70), else_=0)
        # Condition 2 (poor)
        + case((Sign.condition_rating == 2, 60), else_=0)
        # Status: faded
        + case((Sign.status == "faded", 50), else_=0)
        # Overdue for replacement
        + case((Sign.expected_replacement_date < today, 40), else_=0)
        # Due soon (within 90 days)
        + case(
            (
                (Sign.expected_replacement_date >= today)
                & (Sign.expected_replacement_date <= ninety_days),
                30,
            ),
            else_=0,
        )
        # Never inspected
        + case((Sign.last_inspected_date.is_(None), 20), else_=0)
        # Inspection overdue (> 2 years)
        + case((Sign.last_inspected_date < two_years_ago, 10), else_=0)
    )

    # Only include signs that have at least one issue (priority_score > 0).
    # Use a subquery so we can filter on the computed priority_score column.
    inner = (
        select(
            Sign.sign_id,
            Sign.asset_tag,
            Sign.mutcd_code,
            Sign.description,
            Sign.road_name,
            Sign.intersection_with,
            Sign.condition_rating,
            Sign.status,
            Sign.install_date,
            Sign.expected_replacement_date,
            Sign.measured_value,
            Sign.passes_minimum,
            Sign.sheeting_type,
            Sign.last_inspected_date,
            Sign.replacement_cost_estimate,
            func.ST_X(Sign.geometry).label("longitude"),
            func.ST_Y(Sign.geometry).label("latitude"),
            priority_score.label("priority_score"),
        )
        .where(Sign.tenant_id == tenant_id)
    ).subquery()

    priority_query = (
        select(inner)
        .where(inner.c.priority_score > 0)
        .order_by(
            inner.c.priority_score.desc(),
            inner.c.expected_replacement_date.asc().nulls_last(),
        )
        .limit(20)
    )

    priority_rows = (await db.execute(priority_query)).all()

    priority_signs = [
        PrioritySign(
            sign_id=row.sign_id,
            asset_tag=row.asset_tag,
            mutcd_code=row.mutcd_code,
            description=row.description,
            road_name=row.road_name,
            intersection_with=row.intersection_with,
            condition_rating=row.condition_rating,
            status=row.status,
            install_date=row.install_date,
            expected_replacement_date=row.expected_replacement_date,
            days_overdue=(
                (today - row.expected_replacement_date).days
                if row.expected_replacement_date
                else None
            ),
            measured_value=float(row.measured_value) if row.measured_value is not None else None,
            passes_minimum=row.passes_minimum,
            sheeting_type=row.sheeting_type,
            last_inspected_date=row.last_inspected_date,
            replacement_cost_estimate=(
                float(row.replacement_cost_estimate)
                if row.replacement_cost_estimate is not None
                else None
            ),
            longitude=row.longitude,
            latitude=row.latitude,
            priority_score=row.priority_score,
        )
        for row in priority_rows
    ]

    # ---------------------------------------------------------------
    # Assemble response
    # ---------------------------------------------------------------
    return ComplianceDashboardOut(
        total_signs=total_signs,
        total_supports=total_supports,
        # Compliance
        signs_passing_retro=passing,
        signs_failing_retro=failing,
        signs_retro_unknown=stats_result.retro_unknown,
        compliance_rate=compliance_rate,
        # Overdue
        signs_overdue_replacement=stats_result.overdue,
        signs_due_soon=stats_result.due_soon,
        # Status
        signs_missing=stats_result.missing,
        signs_damaged=stats_result.damaged,
        signs_faded=stats_result.faded,
        # Inspection coverage
        signs_never_inspected=stats_result.never_inspected,
        signs_inspection_overdue=stats_result.inspection_overdue,
        signs_inspected_recently=stats_result.inspected_recently,
        # Distributions
        condition_distribution=condition_distribution,
        age_distribution=age_distribution,
        sheeting_distribution=sheeting_distribution,
        # Replacement planning
        estimated_replacement_cost=float(stats_result.est_cost) if stats_result.est_cost else 0.0,
        replacements_this_year=replacement_result.this_year,
        replacements_next_year=replacement_result.next_year,
        replacements_year_after=replacement_result.year_after,
        # Priority signs
        priority_signs=priority_signs,
        # Category breakdown
        category_distribution=category_distribution,
    )
