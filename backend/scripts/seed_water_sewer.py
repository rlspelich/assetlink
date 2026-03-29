#!/usr/bin/env python3
"""Seed water and sewer reference tables. Used by CI and initial deployment."""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings
from app.db.seed_water_sewer import seed_all_water_sewer


async def main():
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        counts = await seed_all_water_sewer(session)
        total = sum(counts.values())
        print(f"Seeded {total} water/sewer reference records:")
        for table, count in counts.items():
            print(f"  {table}: {count}")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
