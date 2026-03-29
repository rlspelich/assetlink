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

# Tables with test data (NOT reference/seed tables like sign_type, water_material_type,
# contract, contractor, bid, bid_item, etc.)
_DATA_TABLES = (
    "estimate_item, estimate, "
    "inspection_asset, work_order_asset, inspection, work_order, "
    "sign, sign_support, comment, attachment, "
    "water_valve_main, water_service, water_fitting, fire_hydrant, water_valve, water_main, pressure_zone, "
    "manhole_pipe, sewer_lateral, sewer_fitting, force_main, sewer_main, manhole, lift_station, "
    "app_user, tenant"
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
        f"('{TENANT_A_ID}', 'Village of Alpha', 'alpha', 'municipality', 'shared', "
        f"'[\"signs\", \"water\", \"sewer\"]', 'basic', true), "
        f"('{TENANT_B_ID}', 'City of Beta', 'beta', 'municipality', 'shared', "
        f"'[\"signs\", \"water\", \"sewer\"]', 'basic', true)"
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


@pytest_asyncio.fixture
async def estimator_seeded_client():
    """HTTP client with tenants + estimator reference data (pay items, award items, regional factors)."""
    _sync_sql(
        f"INSERT INTO tenant (tenant_id, name, subdomain, tenant_type, isolation_model, "
        f"modules_enabled, subscription_tier, is_active) VALUES "
        f"('{TENANT_A_ID}', 'Village of Alpha', 'alpha', 'contractor', 'shared', '[\"estimator\"]', 'basic', true), "
        f"('{TENANT_B_ID}', 'City of Beta', 'beta', 'contractor', 'shared', '[\"estimator\"]', 'basic', true)"
    )

    # Seed pay items (ON CONFLICT for idempotency — reference tables survive TRUNCATE)
    _sync_sql("""
        INSERT INTO pay_item (agency, code, description, unit, division, category, subcategory) VALUES
        ('IDOT', '20200100', 'EARTH EXCAVATION', 'CU YD', 'EARTHWORK', 'EXCAVATION', 'EARTH EXCAVATION'),
        ('IDOT', '20201100', 'TRENCH EXCAVATION', 'CU YD', 'EARTHWORK', 'EXCAVATION', 'TRENCH EXCAVATION'),
        ('IDOT', '20300100', 'SUBGRADE EXCAVATION', 'CU YD', 'EARTHWORK', 'EXCAVATION', 'SUBGRADE'),
        ('IDOT', '40600100', 'HOT-MIX ASPHALT SURFACE COURSE', 'TON', 'BITUMINOUS SURFACES', 'HMA', 'SURFACE'),
        ('IDOT', '40601100', 'HOT-MIX ASPHALT BINDER COURSE', 'TON', 'BITUMINOUS SURFACES', 'HMA', 'BINDER'),
        ('IDOT', '01100100', 'MOBILIZATION', 'L SUM', 'GENERAL CONDITIONS', 'MOBILIZATION', 'MOBILIZATION'),
        ('IDOT', '01100200', 'MOBILIZATION (SPECIAL)', 'L SUM', 'GENERAL CONDITIONS', 'MOBILIZATION', 'MOBILIZATION SPECIAL'),
        ('IDOT', '67000100', 'TOPSOIL FURNISH AND PLACE', 'CU YD', 'LANDSCAPING', 'TOPSOIL', 'FURNISH AND PLACE')
        ON CONFLICT (agency, code) DO NOTHING
    """)

    # Seed award items (historical price data for pricing engine)
    _sync_sql("""
        INSERT INTO award_item (award_item_id, letting_date, pay_item_code, abbreviation, unit, quantity, unit_price, contract_number, county, district) VALUES
        (gen_random_uuid(), '2024-01-15', '20200100', 'EARTH EXCAV', 'CU YD', 5000, 18.50, '12345', 'COOK', '1'),
        (gen_random_uuid(), '2024-03-20', '20200100', 'EARTH EXCAV', 'CU YD', 8000, 21.00, '12346', 'DUPAGE', '1'),
        (gen_random_uuid(), '2024-06-10', '20200100', 'EARTH EXCAV', 'CU YD', 3000, 19.75, '12347', 'WILL', '1'),
        (gen_random_uuid(), '2023-09-05', '20200100', 'EARTH EXCAV', 'CU YD', 12000, 16.25, '12348', 'KANE', '2'),
        (gen_random_uuid(), '2023-04-15', '20200100', 'EARTH EXCAV', 'CU YD', 6500, 17.80, '12349', 'LAKE', '1'),
        (gen_random_uuid(), '2025-01-10', '20200100', 'EARTH EXCAV', 'CU YD', 4200, 22.50, '12350', 'COOK', '1'),
        (gen_random_uuid(), '2024-08-15', '01100100', 'MOBILIZATION', 'L SUM', 1, 125000.00, '12351', 'COOK', '1'),
        (gen_random_uuid(), '2024-02-20', '01100100', 'MOBILIZATION', 'L SUM', 1, 95000.00, '12352', 'WILL', '1'),
        (gen_random_uuid(), '2023-11-10', '01100100', 'MOBILIZATION', 'L SUM', 1, 110000.00, '12353', 'DUPAGE', '1'),
        (gen_random_uuid(), '2024-05-05', '40600100', 'HMA SURFACE', 'TON', 2500, 98.50, '12354', 'COOK', '1'),
        (gen_random_uuid(), '2024-07-20', '40600100', 'HMA SURFACE', 'TON', 1800, 105.25, '12355', 'KANE', '2')
    """)

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
        # Seed regional factors and cost indices via API
        await ac.post("/api/v1/estimator/regional-factors/seed")
        await ac.post("/api/v1/estimator/cost-indices/seed")
        yield ac
    app.dependency_overrides.clear()
    await engine.dispose()


def tenant_a_headers() -> dict[str, str]:
    return {"X-Tenant-ID": str(TENANT_A_ID)}


def tenant_b_headers() -> dict[str, str]:
    return {"X-Tenant-ID": str(TENANT_B_ID)}
