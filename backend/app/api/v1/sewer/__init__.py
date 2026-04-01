"""Sewer collection system API routes.

CRUD endpoints for manholes, sewer mains, force mains, lift stations,
sewer laterals, and reference lookups (material types, pipe shapes,
manhole types).
"""

from fastapi import APIRouter

from .force_mains import router as force_mains_router
from .laterals import router as laterals_router
from .lift_stations import router as lift_stations_router
from .lookups import router as lookups_router
from .mains import router as mains_router
from .manholes import router as manholes_router

router = APIRouter()

router.include_router(manholes_router)
router.include_router(mains_router)
router.include_router(force_mains_router)
router.include_router(lift_stations_router)
router.include_router(laterals_router)
router.include_router(lookups_router)
