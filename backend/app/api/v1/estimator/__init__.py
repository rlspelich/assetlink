"""Estimator module API routes.

Provides contracts, bids, contractors, pay items, file imports,
estimates CRUD, pricing stats, and seed/initialization endpoints.
"""

from fastapi import APIRouter

from .bids import router as bids_router
from .contractors import router as contractors_router
from .contracts import router as contracts_router
from .estimates import router as estimates_router
from .imports import router as imports_router
from .pay_items import router as pay_items_router
from .seeds import router as seeds_router

router = APIRouter()

router.include_router(contracts_router)
router.include_router(bids_router)
router.include_router(contractors_router)
router.include_router(pay_items_router)
router.include_router(imports_router)
router.include_router(estimates_router)
router.include_router(seeds_router)
