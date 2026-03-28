"""
Test fixtures for AssetLink API tests.

Uses the real PostGIS database (Docker) — NOT mocks.
Each test gets a clean slate via TRUNCATE.
"""

import uuid

import pytest
import pytest_asyncio
import psycopg2
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.db.session import get_db
from app.main import app

# Two tenants for isolation testing
TENANT_A_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
TENANT_B_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

# Tables with test data (NOT sign_type, pay_item, cost_index, regional_factor — those are seed/reference data)
_DATA_TABLES = (
    "estimate_item, estimate, "
    "bid_item, bid, contractor, contract, "
    "inspection_asset, work_order_asset, inspection, work_order, "
    "sign, sign_support, comment, attachment, app_user, tenant"
)


def _sync_sql(sql: str):
    """Execute SQL via psycopg2 to avoid asyncpg state issues."""
    conn = psycopg2.connect(settings.database_url_sync)
    conn.autocommit = True
    with conn.cursor() as cur:
        cur.execute(sql)
    conn.close()


@pytest.fixture(autouse=True)
def clean_db():
    """Truncate all data tables before each test. sign_type (MUTCD) is preserved."""
    _sync_sql(f"TRUNCATE {_DATA_TABLES} CASCADE")
    yield


def _make_engine_and_factory():
    """Create a fresh engine and session factory for the current event loop."""
    engine = create_async_engine(
        settings.database_url,
        echo=False,
        pool_size=5,
        max_overflow=0,
        pool_pre_ping=True,
    )
    factory = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False,
    )
    return engine, factory


@pytest_asyncio.fixture
async def client():
    """HTTP client for tests that don't need seeded data."""
    engine, factory = _make_engine_and_factory()

    async def _get_db():
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def seeded_client():
    """HTTP client with two test tenants pre-seeded."""
    _sync_sql(
        f"INSERT INTO tenant (tenant_id, name, subdomain, tenant_type, isolation_model, "
        f"modules_enabled, subscription_tier, is_active) VALUES "
        f"('{TENANT_A_ID}', 'Village of Alpha', 'alpha', 'municipality', 'shared', '[\"signs\"]', 'basic', true), "
        f"('{TENANT_B_ID}', 'City of Beta', 'beta', 'municipality', 'shared', '[\"signs\"]', 'basic', true)"
    )

    engine, factory = _make_engine_and_factory()

    async def _get_db():
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_db] = _get_db
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()


def tenant_a_headers() -> dict[str, str]:
    return {"X-Tenant-ID": str(TENANT_A_ID)}


def tenant_b_headers() -> dict[str, str]:
    return {"X-Tenant-ID": str(TENANT_B_ID)}
