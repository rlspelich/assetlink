"""Contractor Intelligence API routes.

Provides contractor profiles, bidding history, price tendencies,
geographic footprint, activity trends, head-to-head comparisons,
bid tab / job analysis, market analysis, letting reports, and pay item search.

All data is reference (public DOT data) — no tenant filtering required.
"""

from fastapi import APIRouter

from .bid_tabs import router as bid_tabs_router
from .comparisons import router as comparisons_router
from .letting import router as letting_router
from .market import router as market_router
from .pay_item_search import router as pay_item_search_router
from .profile import router as profile_router

router = APIRouter()

router.include_router(profile_router)
router.include_router(comparisons_router)
router.include_router(bid_tabs_router)
router.include_router(market_router)
router.include_router(letting_router)
router.include_router(pay_item_search_router)
