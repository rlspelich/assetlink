"""
Pricing engine — the core computation service for the Estimator module.

Queries the 1.4M-row award_item table to compute weighted average prices
for pay items, with optional inflation adjustment and regional factors.

Key design decisions:
- Recency weighting: recent data weighted more heavily (exponential decay)
- Inflation adjustment: historical prices normalized to target year dollars
- Regional adjustment: state-level multiplier for cross-state estimates
- Percentile computation: for confidence scoring and price distribution
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.award_item import AwardItem
from app.services.estimator.regional_service import get_regional_factor

logger = logging.getLogger(__name__)


@dataclass
class PriceStats:
    """Computed price statistics for a pay item."""
    pay_item_code: str
    data_points: int = 0
    # Weighted statistics (recency + inflation adjusted)
    weighted_avg: Decimal = Decimal("0")
    median: Decimal = Decimal("0")
    p10: Decimal = Decimal("0")
    p25: Decimal = Decimal("0")
    p50: Decimal = Decimal("0")
    p75: Decimal = Decimal("0")
    p90: Decimal = Decimal("0")
    min_price: Decimal = Decimal("0")
    max_price: Decimal = Decimal("0")
    # Raw (nominal) statistics
    nominal_avg: Decimal = Decimal("0")
    # Metadata
    earliest_date: date | None = None
    latest_date: date | None = None
    unit: str = ""
    description: str = ""


def _recency_weight(letting_date: date, reference_date: date) -> float:
    """
    Exponential decay weight based on age of data.

    0-2 years: weight 1.0 (most relevant)
    2-5 years: weight 0.5
    5-10 years: weight 0.25
    10+ years: weight 0.1
    """
    days_old = (reference_date - letting_date).days
    years_old = days_old / 365.25

    if years_old <= 2:
        return 1.0
    elif years_old <= 5:
        return 0.5
    elif years_old <= 10:
        return 0.25
    else:
        return 0.1


def _percentile(sorted_values: list[Decimal], pct: float) -> Decimal:
    """Compute the p-th percentile from a sorted list."""
    if not sorted_values:
        return Decimal("0")
    n = len(sorted_values)
    k = (n - 1) * (pct / 100)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    d0 = sorted_values[int(f)] * Decimal(str(c - k))
    d1 = sorted_values[int(c)] * Decimal(str(k - f))
    return d0 + d1


async def compute_price_stats(
    db: AsyncSession,
    pay_item_code: str,
    district: str | None = None,
    years_back: int = 10,
    adjust_inflation: bool = True,
    target_year: int | None = None,
    target_state: str = "IL",
) -> PriceStats:
    """
    Compute weighted price statistics for a pay item from the award_item table.

    Args:
        db: Database session
        pay_item_code: IDOT pay item code
        district: Optional IDOT district filter (1-9)
        years_back: How many years of history to include
        adjust_inflation: Whether to inflation-adjust prices
        target_year: Year to adjust prices to (default: current year)
        target_state: State for regional adjustment (default: IL = 1.0)

    Returns:
        PriceStats with weighted averages, percentiles, and distribution info.
    """
    if target_year is None:
        target_year = date.today().year

    reference_date = date.today()
    min_date = date(reference_date.year - years_back, 1, 1)

    # Query award items
    query = (
        select(
            AwardItem.unit_price,
            AwardItem.quantity,
            AwardItem.letting_date,
            AwardItem.unit,
            AwardItem.abbreviation,
            AwardItem.district,
        )
        .where(
            AwardItem.pay_item_code == pay_item_code,
            AwardItem.letting_date >= min_date,
            AwardItem.unit_price > 0,
        )
    )

    if district:
        query = query.where(AwardItem.district == district)

    result = await db.execute(query)
    rows = result.all()

    stats = PriceStats(pay_item_code=pay_item_code)

    if not rows:
        return stats

    # Get regional factor
    regional = await get_regional_factor(db, target_state) if target_state != "IL" else Decimal("1")

    # Pre-fetch all needed inflation factors in one batch
    inflation_factors: dict[int, Decimal] = {}
    if adjust_inflation:
        # Get the index source for this pay item (one query)
        from app.services.estimator.inflation_service import (
            get_index_source_for_pay_item, get_index_value, get_latest_index_value,
        )
        source = await get_index_source_for_pay_item(db, pay_item_code)

        # Get target index (one query)
        to_index = await get_index_value(db, source, target_year, 4)
        if not to_index:
            latest = await get_latest_index_value(db, source)
            to_index = latest[0] if latest else None

        if to_index:
            # Get all unique years from the data
            unique_years = {r[2].year for r in rows}  # letting_date is index 2
            # Batch fetch all year indices (one query per year, but far fewer than per-row)
            for yr in unique_years:
                from_index = await get_index_value(db, source, yr)
                if from_index and from_index != 0:
                    inflation_factors[yr] = to_index / from_index
                else:
                    inflation_factors[yr] = Decimal("1")
        # If no target index found, all factors are 1.0

    # Process each data point (no more per-row DB queries)
    adjusted_prices: list[Decimal] = []
    nominal_prices: list[Decimal] = []
    weights: list[float] = []
    dates: list[date] = []

    for unit_price, quantity, letting_date, unit, description, dist in rows:
        nominal_prices.append(unit_price)
        dates.append(letting_date)

        # Inflation adjustment using pre-fetched factors
        if adjust_inflation and inflation_factors:
            factor = inflation_factors.get(letting_date.year, Decimal("1"))
            adj_price = round(unit_price * factor * regional, 4)
        else:
            adj_price = round(unit_price * regional, 4)

        adjusted_prices.append(adj_price)
        weights.append(_recency_weight(letting_date, reference_date))

        # Capture metadata from first row
        if not stats.unit:
            stats.unit = unit or ""
        if not stats.description:
            stats.description = description or ""

    stats.data_points = len(adjusted_prices)
    stats.earliest_date = min(dates)
    stats.latest_date = max(dates)

    # Weighted average
    total_weight = sum(weights)
    if total_weight > 0:
        weighted_sum = sum(
            p * Decimal(str(w)) for p, w in zip(adjusted_prices, weights)
        )
        stats.weighted_avg = round(weighted_sum / Decimal(str(total_weight)), 4)

    # Nominal average
    stats.nominal_avg = round(
        sum(nominal_prices) / len(nominal_prices), 4
    )

    # Percentiles (from adjusted prices)
    sorted_prices = sorted(adjusted_prices)
    stats.min_price = sorted_prices[0]
    stats.max_price = sorted_prices[-1]
    stats.p10 = _percentile(sorted_prices, 10)
    stats.p25 = _percentile(sorted_prices, 25)
    stats.p50 = _percentile(sorted_prices, 50)
    stats.median = stats.p50
    stats.p75 = _percentile(sorted_prices, 75)
    stats.p90 = _percentile(sorted_prices, 90)

    return stats


async def compute_confidence(
    db: AsyncSession,
    pay_item_code: str,
    proposed_price: Decimal,
    district: str | None = None,
    years_back: int = 10,
    adjust_inflation: bool = True,
    target_year: int | None = None,
) -> dict:
    """
    Score a proposed unit price against historical distribution.

    Returns:
        dict with percentile (0-100), label, color, and distribution summary.
    """
    stats = await compute_price_stats(
        db, pay_item_code, district=district, years_back=years_back,
        adjust_inflation=adjust_inflation, target_year=target_year,
    )

    if stats.data_points == 0:
        return {
            "percentile": None,
            "label": "no_data",
            "color": "gray",
            "data_points": 0,
            "stats": stats,
        }

    # Compute percentile rank using the same date-filtered dataset
    # Query with the same filters as compute_price_stats
    reference_date = date.today()
    min_date = date(reference_date.year - years_back, 1, 1)

    query = (
        select(func.count())
        .select_from(AwardItem)
        .where(
            AwardItem.pay_item_code == pay_item_code,
            AwardItem.unit_price > 0,
            AwardItem.unit_price <= proposed_price,
            AwardItem.letting_date >= min_date,
        )
    )
    if district:
        query = query.where(AwardItem.district == district)

    result = await db.execute(query)
    below_count = result.scalar() or 0

    percentile = min(round((below_count / stats.data_points) * 100), 100)

    # Assign label and color
    if percentile <= 15:
        label, color = "very_low", "green"
    elif percentile <= 40:
        label, color = "low", "green"
    elif percentile <= 60:
        label, color = "fair", "blue"
    elif percentile <= 85:
        label, color = "high", "yellow"
    else:
        label, color = "very_high", "red"

    return {
        "percentile": percentile,
        "label": label,
        "color": color,
        "data_points": stats.data_points,
        "p25": stats.p25,
        "p50": stats.p50,
        "p75": stats.p75,
        "weighted_avg": stats.weighted_avg,
    }
