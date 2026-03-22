import os
import sys
from logging.config import fileConfig
from pathlib import Path

# Ensure the backend directory (parent of alembic/) is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.models import Base  # noqa: F401 — imports all models so Alembic sees them

config = context.config

# Override sqlalchemy.url from environment variable if set
db_url = os.environ.get("DATABASE_URL_SYNC")
if db_url:
    config.set_main_option("sqlalchemy.url", db_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Exclude PostGIS system tables and Tiger geocoder tables from autogenerate
EXCLUDE_TABLES = {
    "spatial_ref_sys", "geometry_columns", "geography_columns", "raster_columns",
    "raster_overviews", "topology", "layer",
    # Tiger geocoder tables
    "geocode_settings", "geocode_settings_default", "loader_lookuptables",
    "loader_platform", "loader_variables", "pagc_gaz", "pagc_lex", "pagc_rules",
    "zip_lookup", "zip_lookup_all", "zip_lookup_base", "zip_state", "zip_state_loc",
    "county_lookup", "countysub_lookup", "place_lookup", "state_lookup",
    "street_type_lookup", "direction_lookup", "secondary_unit_lookup",
    "state", "county", "cousub", "place", "zcta5", "tabblock", "tabblock20",
    "bg", "tract", "faces", "featnames", "edges", "addr", "addrfeat",
}


def include_object(object, name, type_, reflected, compare_to):
    if type_ == "table" and name in EXCLUDE_TABLES:
        return False
    return True


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, include_object=include_object)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
