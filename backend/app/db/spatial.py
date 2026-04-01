"""Spatial helper functions for PostGIS geometry operations.

Provides reusable SQLAlchemy column expressions for extracting coordinates
from geometry columns and creating point geometries. Eliminates the
repetitive func.ST_X/ST_Y/ST_SetSRID/ST_MakePoint patterns across routes.
"""
from sqlalchemy import func
from sqlalchemy.orm import InstrumentedAttribute


def lon_lat_columns(geometry_col: InstrumentedAttribute):
    """Return (lon, lat) column expressions for a geometry column.

    Usage in select():
        select(Model, *lon_lat_columns(Model.geometry))
    """
    return (
        func.ST_X(geometry_col).label("lon"),
        func.ST_Y(geometry_col).label("lat"),
    )


def make_point(longitude: float, latitude: float, srid: int = 4326):
    """Create a PostGIS point geometry from lon/lat coordinates.

    Usage:
        model.geometry = make_point(lon, lat)
    """
    return func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), srid)
