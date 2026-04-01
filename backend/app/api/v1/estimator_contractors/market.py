"""Market analysis — players ranked by market share."""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.bid import Bid
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.schemas.contractor_intelligence import (
    MarketAnalysisOut,
    MarketPlayerEntry,
)

router = APIRouter()


@router.get("/market-analysis", response_model=MarketAnalysisOut)
async def get_market_analysis(
    db: AsyncSession = Depends(get_db),
    county: str | None = None,
    district: str | None = None,
    project_type: str | None = None,
    min_date: str | None = None,
    max_date: str | None = None,
    min_project_size: float | None = None,
    max_project_size: float | None = None,
    limit: int = Query(50, ge=1, le=200),
) -> MarketAnalysisOut:
    """
    Market analysis: who are the players in a given geography/time range?

    Shows all contractors ranked by market share ($ won as low bidder).
    Includes jobs bid, jobs won, win rate, $ capture rate, $ left on table.
    """
    # Base filters on contract
    contract_filters = []
    if county:
        contract_filters.append(Contract.county.ilike(f"%{county}%"))
    if district:
        contract_filters.append(Contract.district == district)
    if min_date:
        contract_filters.append(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        contract_filters.append(Contract.letting_date <= date.fromisoformat(max_date))
    if project_type:
        contract_filters.append(Contract.project_type == project_type)

    # Subquery: low bid total per contract (for $ on table calculation)
    low_bid_sq = (
        select(
            Bid.contract_id,
            func.min(Bid.total).filter(Bid.is_bad == False).label("low_total"),
        )
        .group_by(Bid.contract_id)
        .subquery()
    )

    # Main query: per-contractor stats
    query = (
        select(
            Contractor.contractor_pk,
            Contractor.name,
            Contractor.contractor_id_code,
            func.count(distinct(Bid.contract_id)).label("jobs_bid"),
            func.count(distinct(Bid.contract_id)).filter(Bid.is_low == True).label("jobs_won"),
            func.sum(Bid.total).filter(Bid.is_bad == False).label("total_bid"),
            func.sum(Bid.total).filter(Bid.is_low == True).label("total_low"),
            # $ on table = sum of low bids on contracts they bid on
            func.sum(low_bid_sq.c.low_total).label("on_table"),
        )
        .join(Bid, Bid.contractor_pk == Contractor.contractor_pk)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(low_bid_sq, low_bid_sq.c.contract_id == Bid.contract_id)
    )

    if contract_filters:
        query = query.where(*contract_filters)

    # Project size filter (on the low bid total)
    if min_project_size:
        query = query.where(low_bid_sq.c.low_total >= min_project_size)
    if max_project_size:
        query = query.where(low_bid_sq.c.low_total <= max_project_size)

    query = (
        query
        .group_by(Contractor.contractor_pk, Contractor.name, Contractor.contractor_id_code)
        .order_by(func.sum(Bid.total).filter(Bid.is_low == True).desc().nullslast())
        .limit(limit)
    )

    result = await db.execute(query)
    rows = result.all()

    # Total market stats
    market_q = (
        select(
            func.sum(low_bid_sq.c.low_total).label("total_market"),
            func.count(distinct(Contract.contract_id)).label("total_contracts"),
            func.count(distinct(Bid.contractor_pk)).label("total_bidders"),
        )
        .select_from(Contract)
        .join(Bid, Bid.contract_id == Contract.contract_id)
        .join(low_bid_sq, low_bid_sq.c.contract_id == Contract.contract_id)
    )
    if contract_filters:
        market_q = market_q.where(*contract_filters)
    if min_project_size:
        market_q = market_q.where(low_bid_sq.c.low_total >= min_project_size)
    if max_project_size:
        market_q = market_q.where(low_bid_sq.c.low_total <= max_project_size)

    market_row = (await db.execute(market_q)).one()

    players = []
    for i, r in enumerate(rows):
        jobs_bid = r.jobs_bid or 0
        jobs_won = r.jobs_won or 0
        total_low = Decimal(str(r.total_low or 0))
        total_bid = Decimal(str(r.total_bid or 0))
        on_table = Decimal(str(r.on_table or 0))
        capture = float(total_low / on_table * 100) if on_table > 0 else 0

        players.append(MarketPlayerEntry(
            rank=i + 1,
            contractor_pk=r.contractor_pk,
            contractor_name=r.name,
            contractor_id_code=r.contractor_id_code,
            jobs_bid=jobs_bid,
            jobs_won=jobs_won,
            win_rate=round(jobs_won / jobs_bid, 4) if jobs_bid > 0 else 0,
            total_low=round(total_low, 2),
            total_bid=round(total_bid, 2),
            pct_won_of_bids=round(jobs_won / jobs_bid * 100, 2) if jobs_bid > 0 else 0,
            dollar_capture_pct=round(capture, 2),
            pct_left_on_table=round(100 - capture, 2),
        ))

    return MarketAnalysisOut(
        total_market_value=round(Decimal(str(market_row.total_market or 0)), 2),
        total_contracts=market_row.total_contracts or 0,
        total_bidders=market_row.total_bidders or 0,
        filters_applied={
            k: v for k, v in {
                "county": county, "district": district,
                "min_date": min_date, "max_date": max_date,
                "min_project_size": min_project_size, "max_project_size": max_project_size,
            }.items() if v is not None
        },
        players=players,
    )
