"""
Regional cost factor service.

Provides state-level construction cost multipliers relative to Illinois (1.0).
Used to adjust IDOT-based prices for use in other states.
"""
from __future__ import annotations

import csv
import logging
from decimal import Decimal
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.regional_factor import RegionalFactor

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"


async def seed_regional_factors(db: AsyncSession) -> dict:
    """Load regional factors from bundled CSV into the database."""
    csv_path = DATA_DIR / "regional_factors.csv"
    created = 0
    updated = 0

    with open(csv_path, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            result = await db.execute(
                select(RegionalFactor).where(
                    RegionalFactor.state_code == row["state_code"]
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                existing.factor = Decimal(row["factor"])
                existing.year = int(row["year"])
                existing.source = row["source"]
                updated += 1
            else:
                db.add(RegionalFactor(
                    state_code=row["state_code"],
                    state_name=row["state_name"],
                    factor=Decimal(row["factor"]),
                    source=row["source"],
                    year=int(row["year"]),
                ))
                created += 1

    await db.flush()
    logger.info(f"Regional factors: {created} created, {updated} updated")
    return {"created": created, "updated": updated}


async def get_regional_factor(
    db: AsyncSession, state_code: str
) -> Decimal:
    """Get the cost multiplier for a state. Returns 1.0 if not found."""
    result = await db.execute(
        select(RegionalFactor.factor).where(
            RegionalFactor.state_code == state_code.upper()
        )
    )
    factor = result.scalar_one_or_none()
    return factor if factor is not None else Decimal("1")


async def get_all_regional_factors(db: AsyncSession) -> list[RegionalFactor]:
    """Get all regional factors, ordered by state name."""
    result = await db.execute(
        select(RegionalFactor).order_by(RegionalFactor.state_name)
    )
    return list(result.scalars().all())
