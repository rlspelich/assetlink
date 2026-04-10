"""
Inflation adjustment service using FHWA NHCCI and BLS PPI indices.

Normalizes historical construction prices to a target year's dollars.
Uses the cost_index_mapping table to determine which index source
applies to each pay item division (via the categorization system).

Adjustment formula:
    adjusted_price = nominal_price × (target_index / source_index)
"""
from __future__ import annotations

import csv
import logging
from datetime import date
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select, delete, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.cost_index import CostIndex, CostIndexMapping
from app.services.estimator.categories import categorize_pay_item

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"

# Default index source when no mapping exists for a division
DEFAULT_INDEX_SOURCE = "nhcci"


async def seed_cost_indices(db: AsyncSession) -> dict:
    """Load cost index data from bundled CSV files into the cost_index table."""
    created = 0

    for csv_file in DATA_DIR.glob("*.csv"):
        if csv_file.name == "regional_factors.csv":
            continue

        with open(csv_file, "r") as f:
            reader = csv.DictReader(f)
            for row in reader:
                source = row["source"]
                year = int(row["year"])
                quarter = int(row["quarter"]) if row.get("quarter") else None
                value = Decimal(row["value"])
                base_year = int(row["base_year"])

                # Check if exists
                result = await db.execute(
                    select(CostIndex).where(
                        CostIndex.source == source,
                        CostIndex.year == year,
                        CostIndex.quarter == quarter,
                    )
                )
                existing = result.scalar_one_or_none()
                if existing:
                    existing.value = value
                    existing.base_year = base_year
                else:
                    db.add(CostIndex(
                        source=source,
                        year=year,
                        quarter=quarter,
                        value=value,
                        base_year=base_year,
                    ))
                    created += 1

    await db.flush()
    logger.info(f"Seeded {created} cost index records")
    return {"created": created}


async def seed_index_mappings(db: AsyncSession) -> dict:
    """Seed the cost_index_mapping table with division-to-index-source mappings."""
    # Normalize any legacy NULL categories to '' so the unique constraint on
    # (division, category) actually prevents duplicates. Postgres treats NULL as
    # distinct, which previously allowed both a NULL and '' row per division.
    await db.execute(
        update(CostIndexMapping)
        .where(CostIndexMapping.pay_item_category.is_(None))
        .values(pay_item_category="")
    )
    # Drop any duplicate rows that now collide on (division, '') — keep the first.
    await db.execute(
        delete(CostIndexMapping).where(
            CostIndexMapping.cost_index_mapping_id.notin_(
                select(CostIndexMapping.cost_index_mapping_id)
                .distinct(CostIndexMapping.pay_item_division, CostIndexMapping.pay_item_category)
                .order_by(CostIndexMapping.pay_item_division, CostIndexMapping.pay_item_category, CostIndexMapping.cost_index_mapping_id)
            )
        )
    )
    await db.flush()

    mappings = [
        ("BITUMINOUS SURFACES AND HOT-MIX ASPHALT PAVEMENTS", "", "nhcci"),
        ("PORTLAND CEMENT CONCRETE PAVEMENTS AND SIDEWALKS", "", "nhcci"),
        ("BRIDGES", "", "nhcci"),
        ("EARTHWORK", "", "nhcci"),
        ("BASE COURSE", "", "nhcci"),
        ("SUBBASE", "", "nhcci"),
        ("SUBGRADE", "", "nhcci"),
        ("EROSION CONTROL", "", "nhcci"),
        ("SHOULDERS", "", "nhcci"),
        ("CULVERTS", "", "nhcci"),
        ("SEWERS", "", "nhcci"),
        ("UTILITIES", "", "nhcci"),
        ("STRUCTURES MISCELLANEOUS", "", "nhcci"),
        ("PAVEMENT REHABILITATION", "", "nhcci"),
        ("INCIDENTAL CONSTRUCTION DRAINAGE RELATED ITEMS", "", "nhcci"),
        ("INCIDENTAL CONSTRUCTION SAFETY RELATED ITEMS", "", "nhcci"),
        ("INCIDENTAL CONSTRUCTION OTHER ITEMS", "", "nhcci"),
        ("WORK ZONE TRAFFIC CONTROL AND PROTECTION", "", "nhcci"),
        ("SIGNING", "", "nhcci"),
        ("PAVEMENT MARKING", "", "nhcci"),
        ("GENERAL ELECTRICAL REQUIREMENTS", "", "nhcci"),
        ("LANDSCAPING", "", "nhcci"),
        ("GENERAL REQUIREMENTS AND COVENANTS", "", "nhcci"),
    ]

    created = 0
    for division, category, source in mappings:
        result = await db.execute(
            select(CostIndexMapping).where(
                CostIndexMapping.pay_item_division == division,
                CostIndexMapping.pay_item_category == category,
            )
        )
        if not result.scalar_one_or_none():
            db.add(CostIndexMapping(
                pay_item_division=division,
                pay_item_category=category,
                index_source=source,
            ))
            created += 1

    await db.flush()
    logger.info(f"Seeded {created} index mappings")
    return {"created": created}


async def get_index_source_for_pay_item(
    db: AsyncSession, pay_item_code: str
) -> str:
    """Determine which cost index source to use for a pay item code."""
    division, _ = categorize_pay_item(pay_item_code)
    if not division:
        return DEFAULT_INDEX_SOURCE

    result = await db.execute(
        select(CostIndexMapping.index_source)
        .where(CostIndexMapping.pay_item_division == division)
        .limit(1)
    )
    source = result.scalars().first()
    return source or DEFAULT_INDEX_SOURCE


async def get_index_value(
    db: AsyncSession, source: str, year: int, quarter: int | None = None
) -> Decimal | None:
    """Look up a cost index value. Falls back to nearest quarter if exact not found."""
    if quarter:
        result = await db.execute(
            select(CostIndex.value).where(
                CostIndex.source == source,
                CostIndex.year == year,
                CostIndex.quarter == quarter,
            )
        )
        val = result.scalar_one_or_none()
        if val:
            return val

    # Fallback: get the latest quarter for that year
    result = await db.execute(
        select(CostIndex.value)
        .where(CostIndex.source == source, CostIndex.year == year)
        .order_by(CostIndex.quarter.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_latest_index_value(db: AsyncSession, source: str) -> tuple[Decimal, int, int] | None:
    """Get the most recent index value for a source. Returns (value, year, quarter)."""
    result = await db.execute(
        select(CostIndex.value, CostIndex.year, CostIndex.quarter)
        .where(CostIndex.source == source)
        .order_by(CostIndex.year.desc(), CostIndex.quarter.desc())
        .limit(1)
    )
    row = result.first()
    if row:
        return row[0], row[1], row[2]
    return None


def date_to_quarter(d: date) -> int:
    """Convert a date to its quarter number (1-4)."""
    return (d.month - 1) // 3 + 1


async def compute_adjustment_factor(
    db: AsyncSession,
    pay_item_code: str,
    from_date: date,
    target_year: int,
    target_quarter: int | None = None,
) -> Decimal:
    """
    Compute the inflation adjustment factor for a pay item.

    Returns the multiplier to convert a price from from_date dollars
    to target_year dollars.

    adjusted_price = nominal_price * factor
    """
    source = await get_index_source_for_pay_item(db, pay_item_code)

    from_year = from_date.year
    from_quarter = date_to_quarter(from_date)

    from_index = await get_index_value(db, source, from_year, from_quarter)
    if not from_index:
        return Decimal("1")  # No data, return no adjustment

    if target_quarter is None:
        target_quarter = 4  # Use Q4 as default for year-end

    to_index = await get_index_value(db, source, target_year, target_quarter)
    if not to_index:
        # Try latest available
        latest = await get_latest_index_value(db, source)
        if latest:
            to_index = latest[0]
        else:
            return Decimal("1")

    if from_index == 0:
        return Decimal("1")

    return to_index / from_index
