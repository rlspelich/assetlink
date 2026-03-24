#!/usr/bin/env python3
"""Seed MUTCD sign types into the database. Used by CI and initial deployment."""

import asyncio
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from app.config import settings
from app.db.seed import seed_sign_types


async def main():
    engine = create_async_engine(settings.database_url)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with factory() as session:
        count = await seed_sign_types(session)
        await session.commit()
        print(f"Seeded {count} MUTCD sign types.")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
