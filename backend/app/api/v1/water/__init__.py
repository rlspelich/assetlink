"""
Water distribution system API routes.

Assets: water mains (LineString), water valves (Point), fire hydrants (Point),
pressure zones (Polygon).

Lookup tables: water_material_type, water_valve_type.
"""

from fastapi import APIRouter

from .hydrants import router as hydrants_router
from .lookups import router as lookups_router
from .mains import router as mains_router
from .pressure_zones import router as pressure_zones_router
from .valves import router as valves_router

router = APIRouter()

router.include_router(mains_router)
router.include_router(valves_router)
router.include_router(hydrants_router)
router.include_router(pressure_zones_router)
router.include_router(lookups_router)
