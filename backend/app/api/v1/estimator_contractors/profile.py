"""Contractor profile, bidding history, geographic footprint, activity trend, and price tendencies."""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, case, distinct, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.models.pay_item import PayItem
from app.schemas.contractor_intelligence import (
    ActivityTrendOut,
    ActivityTrendPoint,
    BiddingHistoryEntry,
    BiddingHistoryOut,
    ContractorProfileOut,
    GeoFootprintEntry,
    GeoFootprintOut,
    PriceTendencyItem,
    PriceTendencyOut,
)

from .helpers import _get_contractor

router = APIRouter()


@router.get("/contractors/{contractor_pk}/profile", response_model=ContractorProfileOut)
async def get_contractor_profile(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    max_date: str | None = None,
) -> ContractorProfileOut:
    """Full contractor profile with aggregated statistics. Optional date range filter."""
    contractor = await _get_contractor(db, contractor_pk)

    date_filters = []
    if min_date:
        date_filters.append(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        date_filters.append(Contract.letting_date <= date.fromisoformat(max_date))

    # Aggregate bid stats
    stats = await db.execute(
        select(
            func.count(Bid.bid_id).label("total_bids"),
            func.count(Bid.bid_id).filter(Bid.is_low == True).label("total_wins"),
            func.avg(Bid.total).filter(Bid.is_bad == False).label("avg_bid_total"),
            func.sum(Bid.total).filter(Bid.is_bad == False).label("total_bid_volume"),
            func.min(Contract.letting_date).label("first_bid_date"),
            func.max(Contract.letting_date).label("last_bid_date"),
        )
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .where(Bid.contractor_pk == contractor_pk, *date_filters)
    )
    row = stats.one()

    # $ on table: sum of low bids on contracts this contractor bid on
    low_bid_sq = (
        select(
            Bid.contract_id,
            func.min(Bid.total).filter(Bid.is_bad == False).label("low_total"),
        )
        .group_by(Bid.contract_id)
        .subquery()
    )
    on_table_q = (
        select(
            func.sum(low_bid_sq.c.low_total).label("on_table"),
            func.sum(Bid.total).filter(Bid.is_low == True).label("total_won"),
        )
        .join(low_bid_sq, low_bid_sq.c.contract_id == Bid.contract_id)
        .where(Bid.contractor_pk == contractor_pk)
    )
    if date_filters:
        on_table_q = on_table_q.join(Contract, Bid.contract_id == Contract.contract_id).where(*date_filters)
    on_table_result = await db.execute(on_table_q)
    ot_row = on_table_result.one()
    on_table = Decimal(str(ot_row.on_table or 0))
    total_won = Decimal(str(ot_row.total_won or 0))
    dollar_capture = float(total_won / on_table * 100) if on_table > 0 else 0

    # Counties and districts
    geo = await db.execute(
        select(
            func.array_agg(distinct(Contract.county)).label("counties"),
            func.array_agg(distinct(Contract.district)).label("districts"),
        )
        .join(Bid, Bid.contract_id == Contract.contract_id)
        .where(Bid.contractor_pk == contractor_pk, *date_filters)
    )
    geo_row = geo.one()

    total_bids = row.total_bids or 0
    total_wins = row.total_wins or 0
    first = row.first_bid_date
    last = row.last_bid_date
    active_years = (last.year - first.year + 1) if first and last else 0

    counties = sorted([c for c in (geo_row.counties or []) if c and c.strip()])
    districts = sorted([d for d in (geo_row.districts or []) if d and d.strip()])

    return ContractorProfileOut(
        contractor_pk=contractor.contractor_pk,
        contractor_id_code=contractor.contractor_id_code,
        name=contractor.name,
        total_bids=total_bids,
        total_wins=total_wins,
        win_rate=round(total_wins / total_bids, 4) if total_bids > 0 else 0,
        avg_bid_total=round(row.avg_bid_total, 2) if row.avg_bid_total else None,
        total_bid_volume=round(row.total_bid_volume, 2) if row.total_bid_volume else Decimal("0"),
        total_won=round(total_won, 2),
        on_table=round(on_table, 2),
        dollar_capture_pct=round(dollar_capture, 2),
        first_bid_date=first,
        last_bid_date=last,
        active_years=active_years,
        counties=counties,
        districts=districts,
    )


@router.get("/contractors/{contractor_pk}/bidding-history", response_model=BiddingHistoryOut)
async def get_bidding_history(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    county: str | None = None,
    district: str | None = None,
    wins_only: bool = False,
) -> BiddingHistoryOut:
    """Paginated bidding history for a contractor."""
    await _get_contractor(db, contractor_pk)

    # Subquery: bidder count per contract
    bidder_count_sq = (
        select(
            Bid.contract_id,
            func.count(Bid.bid_id).label("num_bidders"),
        )
        .group_by(Bid.contract_id)
        .subquery()
    )

    # Main query
    query = (
        select(
            Bid.bid_id,
            Bid.contract_id,
            Contract.number.label("contract_number"),
            Contract.letting_date,
            Contract.county,
            Contract.district,
            Bid.rank,
            Bid.total,
            Bid.is_low,
            Bid.is_bad,
            bidder_count_sq.c.num_bidders,
        )
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(bidder_count_sq, bidder_count_sq.c.contract_id == Bid.contract_id)
        .where(Bid.contractor_pk == contractor_pk)
    )

    if county:
        query = query.where(Contract.county.ilike(f"%{county}%"))
    if district:
        query = query.where(Contract.district == district)
    if wins_only:
        query = query.where(Bid.is_low == True)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch page
    query = query.order_by(Contract.letting_date.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return BiddingHistoryOut(
        entries=[
            BiddingHistoryEntry(
                bid_id=r.bid_id,
                contract_id=r.contract_id,
                contract_number=r.contract_number,
                letting_date=r.letting_date,
                county=r.county,
                district=r.district,
                rank=r.rank,
                total=r.total,
                is_low=r.is_low,
                is_bad=r.is_bad,
                num_bidders=r.num_bidders,
            )
            for r in result.all()
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/contractors/{contractor_pk}/geographic-footprint", response_model=GeoFootprintOut)
async def get_geographic_footprint(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    max_date: str | None = None,
) -> GeoFootprintOut:
    """Bid and win counts by county and district."""
    await _get_contractor(db, contractor_pk)

    date_filters = []
    if min_date:
        date_filters.append(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        date_filters.append(Contract.letting_date <= date.fromisoformat(max_date))

    async def _geo_query(group_col):
        result = await db.execute(
            select(
                group_col.label("name"),
                func.count(Bid.bid_id).label("bid_count"),
                func.count(Bid.bid_id).filter(Bid.is_low == True).label("win_count"),
                func.sum(Bid.total).filter(Bid.is_bad == False).label("total_volume"),
            )
            .join(Contract, Bid.contract_id == Contract.contract_id)
            .where(Bid.contractor_pk == contractor_pk, *date_filters)
            .where(group_col != "")
            .group_by(group_col)
            .order_by(func.count(Bid.bid_id).desc())
        )
        return [
            GeoFootprintEntry(
                name=r.name,
                bid_count=r.bid_count,
                win_count=r.win_count,
                win_rate=round(r.win_count / r.bid_count, 4) if r.bid_count > 0 else 0,
                total_volume=round(r.total_volume, 2) if r.total_volume else Decimal("0"),
            )
            for r in result.all()
        ]

    return GeoFootprintOut(
        contractor_pk=contractor_pk,
        by_county=await _geo_query(Contract.county),
        by_district=await _geo_query(Contract.district),
    )


@router.get("/contractors/{contractor_pk}/activity-trend", response_model=ActivityTrendOut)
async def get_activity_trend(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    max_date: str | None = None,
) -> ActivityTrendOut:
    """Bidding volume by year."""
    await _get_contractor(db, contractor_pk)

    date_filters = []
    if min_date:
        date_filters.append(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        date_filters.append(Contract.letting_date <= date.fromisoformat(max_date))

    year_col = extract("year", Contract.letting_date)
    result = await db.execute(
        select(
            year_col.label("year"),
            func.count(Bid.bid_id).label("bid_count"),
            func.count(Bid.bid_id).filter(Bid.is_low == True).label("win_count"),
            func.sum(Bid.total).filter(Bid.is_bad == False).label("total_bid_volume"),
        )
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .where(Bid.contractor_pk == contractor_pk, *date_filters)
        .group_by(year_col)
        .order_by(year_col)
    )

    return ActivityTrendOut(
        contractor_pk=contractor_pk,
        trend=[
            ActivityTrendPoint(
                year=int(r.year),
                bid_count=r.bid_count,
                win_count=r.win_count,
                total_bid_volume=round(r.total_bid_volume, 2) if r.total_bid_volume else Decimal("0"),
            )
            for r in result.all()
        ],
    )


@router.get("/contractors/{contractor_pk}/price-tendencies", response_model=PriceTendencyOut)
async def get_price_tendencies(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    limit: int = Query(30, ge=1, le=100),
) -> PriceTendencyOut:
    """Average prices by division compared to overall market average."""
    contractor = await _get_contractor(db, contractor_pk)

    date_filter = []
    if min_date:
        date_filter.append(Contract.letting_date >= date.fromisoformat(min_date))

    # Contractor's average prices by division
    contractor_q = (
        select(
            PayItem.division.label("division"),
            func.avg(BidItem.unit_price).label("avg_price"),
            func.count(BidItem.bid_item_id).label("sample_count"),
        )
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(PayItem, and_(PayItem.code == BidItem.pay_item_code, PayItem.agency == "IDOT"))
        .where(
            Bid.contractor_pk == contractor_pk,
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
            PayItem.division != "",
            *date_filter,
        )
        .group_by(PayItem.division)
        .having(func.count(BidItem.bid_item_id) >= 5)  # minimum samples
    )
    contractor_result = await db.execute(contractor_q)
    contractor_divs = {r.division: (r.avg_price, r.sample_count) for r in contractor_result.all()}

    if not contractor_divs:
        return PriceTendencyOut(
            contractor_pk=contractor_pk,
            contractor_name=contractor.name,
            tendencies=[],
        )

    # Market-wide averages for the same divisions
    market_q = (
        select(
            PayItem.division.label("division"),
            func.avg(BidItem.unit_price).label("avg_price"),
            func.count(BidItem.bid_item_id).label("sample_count"),
        )
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(PayItem, and_(PayItem.code == BidItem.pay_item_code, PayItem.agency == "IDOT"))
        .where(
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
            PayItem.division.in_(list(contractor_divs.keys())),
            *date_filter,
        )
        .group_by(PayItem.division)
    )
    market_result = await db.execute(market_q)
    market_divs = {r.division: (r.avg_price, r.sample_count) for r in market_result.all()}

    tendencies = []
    for div, (c_avg, c_count) in contractor_divs.items():
        m_avg, m_count = market_divs.get(div, (None, 0))
        if m_avg and m_avg > 0:
            variance = float((c_avg - m_avg) / m_avg * 100)
            tendencies.append(PriceTendencyItem(
                division=div,
                contractor_avg_price=round(c_avg, 4),
                market_avg_price=round(m_avg, 4),
                variance_pct=round(variance, 2),
                contractor_sample_count=c_count,
                market_sample_count=m_count,
            ))

    # Sort by absolute variance (most interesting first)
    tendencies.sort(key=lambda t: abs(t.variance_pct), reverse=True)

    return PriceTendencyOut(
        contractor_pk=contractor_pk,
        contractor_name=contractor.name,
        tendencies=tendencies[:limit],
    )
