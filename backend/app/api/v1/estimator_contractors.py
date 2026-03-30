"""
Contractor Intelligence API endpoints.

Provides contractor profiles, bidding history, price tendencies,
geographic footprint, activity trends, head-to-head comparisons,
and full bid tab / job analysis.

All data is reference (public DOT data) — no tenant filtering required.
"""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, distinct, extract, func, select, text, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.models.pay_item import PayItem
from app.schemas.contractor_intelligence import (
    ActivityTrendOut,
    ActivityTrendPoint,
    BidTabBidder,
    BidTabLineItem,
    BidTabOut,
    BiddingHistoryEntry,
    BiddingHistoryOut,
    CategoryBreakdownEntry,
    CategoryBreakdownOut,
    ContractorProfileOut,
    GeoFootprintEntry,
    GeoFootprintOut,
    HeadToHeadContract,
    HeadToHeadItemComparison,
    HeadToHeadItemsOut,
    HeadToHeadSummary,
    PriceTendencyItem,
    PriceTendencyOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Helper: get contractor or 404
# ---------------------------------------------------------------------------

async def _get_contractor(db: AsyncSession, contractor_pk: uuid.UUID) -> Contractor:
    result = await db.execute(
        select(Contractor).where(Contractor.contractor_pk == contractor_pk)
    )
    contractor = result.scalar_one_or_none()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor


# ---------------------------------------------------------------------------
# Contractor Profile
# ---------------------------------------------------------------------------


@router.get("/contractors/{contractor_pk}/profile", response_model=ContractorProfileOut)
async def get_contractor_profile(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Full contractor profile with aggregated statistics."""
    contractor = await _get_contractor(db, contractor_pk)

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
        .where(Bid.contractor_pk == contractor_pk)
    )
    row = stats.one()

    # Counties and districts
    geo = await db.execute(
        select(
            func.array_agg(distinct(Contract.county)).label("counties"),
            func.array_agg(distinct(Contract.district)).label("districts"),
        )
        .join(Bid, Bid.contract_id == Contract.contract_id)
        .where(Bid.contractor_pk == contractor_pk)
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
        first_bid_date=first,
        last_bid_date=last,
        active_years=active_years,
        counties=counties,
        districts=districts,
    )


# ---------------------------------------------------------------------------
# Bidding History
# ---------------------------------------------------------------------------


@router.get("/contractors/{contractor_pk}/bidding-history", response_model=BiddingHistoryOut)
async def get_bidding_history(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    county: str | None = None,
    district: str | None = None,
    wins_only: bool = False,
):
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


# ---------------------------------------------------------------------------
# Geographic Footprint
# ---------------------------------------------------------------------------


@router.get("/contractors/{contractor_pk}/geographic-footprint", response_model=GeoFootprintOut)
async def get_geographic_footprint(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Bid and win counts by county and district."""
    await _get_contractor(db, contractor_pk)

    async def _geo_query(group_col):
        result = await db.execute(
            select(
                group_col.label("name"),
                func.count(Bid.bid_id).label("bid_count"),
                func.count(Bid.bid_id).filter(Bid.is_low == True).label("win_count"),
                func.sum(Bid.total).filter(Bid.is_bad == False).label("total_volume"),
            )
            .join(Contract, Bid.contract_id == Contract.contract_id)
            .where(Bid.contractor_pk == contractor_pk)
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


# ---------------------------------------------------------------------------
# Activity Trend
# ---------------------------------------------------------------------------


@router.get("/contractors/{contractor_pk}/activity-trend", response_model=ActivityTrendOut)
async def get_activity_trend(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Bidding volume by year."""
    await _get_contractor(db, contractor_pk)

    year_col = extract("year", Contract.letting_date)
    result = await db.execute(
        select(
            year_col.label("year"),
            func.count(Bid.bid_id).label("bid_count"),
            func.count(Bid.bid_id).filter(Bid.is_low == True).label("win_count"),
            func.sum(Bid.total).filter(Bid.is_bad == False).label("total_bid_volume"),
        )
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .where(Bid.contractor_pk == contractor_pk)
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


# ---------------------------------------------------------------------------
# Price Tendencies
# ---------------------------------------------------------------------------


@router.get("/contractors/{contractor_pk}/price-tendencies", response_model=PriceTendencyOut)
async def get_price_tendencies(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    limit: int = Query(30, ge=1, le=100),
):
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


# ---------------------------------------------------------------------------
# Head-to-Head Comparison
# ---------------------------------------------------------------------------


@router.get("/contractors/head-to-head", response_model=HeadToHeadSummary)
async def get_head_to_head(
    contractor_a: uuid.UUID = Query(..., description="First contractor UUID"),
    contractor_b: uuid.UUID = Query(..., description="Second contractor UUID"),
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    max_date: str | None = None,
    county: str | None = None,
):
    """Side-by-side comparison of two contractors on shared contracts."""
    ca = await _get_contractor(db, contractor_a)
    cb = await _get_contractor(db, contractor_b)

    # Find shared contracts
    shared_q = (
        select(Bid.contract_id)
        .where(Bid.contractor_pk.in_([contractor_a, contractor_b]))
        .group_by(Bid.contract_id)
        .having(func.count(distinct(Bid.contractor_pk)) == 2)
    )

    # Get bids on shared contracts with contract info
    query = (
        select(
            Contract.contract_id,
            Contract.number.label("contract_number"),
            Contract.letting_date,
            Contract.county,
            Bid.contractor_pk,
            Bid.rank,
            Bid.total,
            Bid.is_low,
        )
        .join(Bid, Bid.contract_id == Contract.contract_id)
        .where(
            Bid.contract_id.in_(shared_q),
            Bid.contractor_pk.in_([contractor_a, contractor_b]),
        )
    )

    if min_date:
        query = query.where(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        query = query.where(Contract.letting_date <= date.fromisoformat(max_date))
    if county:
        query = query.where(Contract.county.ilike(f"%{county}%"))

    query = query.order_by(Contract.letting_date.desc())
    result = await db.execute(query)
    rows = result.all()

    # Pivot into per-contract pairs
    contract_map: dict[uuid.UUID, dict] = {}
    for r in rows:
        if r.contract_id not in contract_map:
            contract_map[r.contract_id] = {
                "contract_id": r.contract_id,
                "contract_number": r.contract_number,
                "letting_date": r.letting_date,
                "county": r.county,
            }
        key = "a" if r.contractor_pk == contractor_a else "b"
        contract_map[r.contract_id][f"{key}_rank"] = r.rank
        contract_map[r.contract_id][f"{key}_total"] = r.total
        contract_map[r.contract_id][f"{key}_is_low"] = r.is_low

    contracts = []
    a_wins_vs_b = 0
    b_wins_vs_a = 0
    a_total_wins = 0
    b_total_wins = 0

    for c in contract_map.values():
        a_rank = c.get("a_rank", 0)
        b_rank = c.get("b_rank", 0)

        if a_rank > 0 and b_rank > 0:
            if a_rank < b_rank:
                a_wins_vs_b += 1
                winner = "a"
            elif b_rank < a_rank:
                b_wins_vs_a += 1
                winner = "b"
            else:
                winner = "tie"
        else:
            winner = "other"

        if c.get("a_is_low"):
            a_total_wins += 1
        if c.get("b_is_low"):
            b_total_wins += 1

        contracts.append(HeadToHeadContract(
            contract_id=c["contract_id"],
            contract_number=c["contract_number"],
            letting_date=c["letting_date"],
            county=c["county"],
            contractor_a_rank=a_rank,
            contractor_a_total=c.get("a_total", Decimal("0")),
            contractor_b_rank=b_rank,
            contractor_b_total=c.get("b_total", Decimal("0")),
            winner=winner,
        ))

    return HeadToHeadSummary(
        contractor_a_pk=contractor_a,
        contractor_a_name=ca.name,
        contractor_b_pk=contractor_b,
        contractor_b_name=cb.name,
        shared_contracts=len(contracts),
        a_wins_vs_b=a_wins_vs_b,
        b_wins_vs_a=b_wins_vs_a,
        a_total_wins=a_total_wins,
        b_total_wins=b_total_wins,
        contracts=contracts,
    )


@router.get("/contractors/head-to-head/items", response_model=HeadToHeadItemsOut)
async def get_head_to_head_items(
    contractor_a: uuid.UUID = Query(...),
    contractor_b: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    min_date: str | None = None,
    division: str | None = None,
):
    """Item-level price comparison across shared contracts."""
    ca = await _get_contractor(db, contractor_a)
    cb = await _get_contractor(db, contractor_b)

    # Shared contracts subquery
    shared_q = (
        select(Bid.contract_id)
        .where(Bid.contractor_pk.in_([contractor_a, contractor_b]))
        .group_by(Bid.contract_id)
        .having(func.count(distinct(Bid.contractor_pk)) == 2)
    )

    if min_date:
        shared_q = shared_q.join(Contract, Bid.contract_id == Contract.contract_id).where(
            Contract.letting_date >= date.fromisoformat(min_date)
        )

    shared_contracts = shared_q.subquery()

    # Get bids for contractor A on shared contracts
    bid_a = (
        select(Bid.bid_id)
        .where(Bid.contractor_pk == contractor_a, Bid.contract_id.in_(select(shared_contracts.c.contract_id)))
        .subquery()
    )
    bid_b = (
        select(Bid.bid_id)
        .where(Bid.contractor_pk == contractor_b, Bid.contract_id.in_(select(shared_contracts.c.contract_id)))
        .subquery()
    )

    # Aggregate by pay_item_code for contractor A
    agg_a = (
        select(
            BidItem.pay_item_code,
            func.avg(BidItem.unit_price).label("avg_price"),
            func.count(BidItem.bid_item_id).label("sample_count"),
        )
        .where(
            BidItem.bid_id.in_(select(bid_a.c.bid_id)),
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
        )
        .group_by(BidItem.pay_item_code)
        .subquery()
    )

    agg_b = (
        select(
            BidItem.pay_item_code,
            func.avg(BidItem.unit_price).label("avg_price"),
            func.count(BidItem.bid_item_id).label("sample_count"),
        )
        .where(
            BidItem.bid_id.in_(select(bid_b.c.bid_id)),
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
        )
        .group_by(BidItem.pay_item_code)
        .subquery()
    )

    # Join A and B on pay_item_code, with pay_item for description
    query = (
        select(
            agg_a.c.pay_item_code,
            PayItem.description.label("description"),
            PayItem.unit.label("unit"),
            agg_a.c.avg_price.label("a_avg"),
            agg_b.c.avg_price.label("b_avg"),
            func.least(agg_a.c.sample_count, agg_b.c.sample_count).label("sample_count"),
        )
        .join(agg_b, agg_a.c.pay_item_code == agg_b.c.pay_item_code)
        .outerjoin(PayItem, and_(PayItem.code == agg_a.c.pay_item_code, PayItem.agency == "IDOT"))
    )

    if division:
        query = query.where(PayItem.division.ilike(f"%{division}%"))

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Page
    query = query.order_by(agg_a.c.pay_item_code)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    items = []
    for r in result.all():
        a_avg = Decimal(str(r.a_avg)) if r.a_avg else Decimal("0")
        b_avg = Decimal(str(r.b_avg)) if r.b_avg else Decimal("0")
        variance = float((a_avg - b_avg) / b_avg * 100) if b_avg > 0 else 0

        items.append(HeadToHeadItemComparison(
            pay_item_code=r.pay_item_code,
            description=r.description or "",
            unit=r.unit or "",
            contractor_a_avg_price=round(a_avg, 4),
            contractor_b_avg_price=round(b_avg, 4),
            variance_pct=round(variance, 2),
            sample_count=r.sample_count or 0,
        ))

    return HeadToHeadItemsOut(
        contractor_a_name=ca.name,
        contractor_b_name=cb.name,
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Bid Tab / Job Analysis
# ---------------------------------------------------------------------------


@router.get("/contracts/{contract_id}/bid-tab", response_model=BidTabOut)
async def get_bid_tab(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    """Full bid tabulation: every bidder, every line item."""
    # Get contract
    result = await db.execute(
        select(Contract).where(Contract.contract_id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Get all bids with contractor info
    bid_result = await db.execute(
        select(Bid)
        .options(selectinload(Bid.contractor))
        .where(Bid.contract_id == contract_id)
        .order_by(Bid.rank)
    )
    bids = bid_result.scalars().all()

    if not bids:
        return BidTabOut(
            contract_id=contract.contract_id,
            contract_number=contract.number,
            letting_date=contract.letting_date,
            county=contract.county,
            district=contract.district,
            bidders=[],
            items=[],
            total_items=0,
        )

    bidders = [
        BidTabBidder(
            contractor_pk=b.contractor_pk,
            contractor_name=b.contractor.name if b.contractor else "",
            contractor_id_code=b.contractor.contractor_id_code if b.contractor else "",
            rank=b.rank,
            total=b.total,
            is_low=b.is_low,
            is_bad=b.is_bad,
        )
        for b in bids
    ]

    # Get all bid items for all bids on this contract
    bid_ids = [b.bid_id for b in bids]
    bid_pk_map = {b.bid_id: b.contractor_pk for b in bids}

    items_result = await db.execute(
        select(BidItem)
        .where(BidItem.bid_id.in_(bid_ids))
        .order_by(BidItem.pay_item_code)
    )
    all_items = items_result.scalars().all()

    # Pivot: group by pay_item_code, map contractor prices
    item_map: dict[str, dict] = {}
    for bi in all_items:
        if bi.pay_item_code not in item_map:
            item_map[bi.pay_item_code] = {
                "abbreviation": bi.abbreviation,
                "unit": bi.unit,
                "quantity": bi.quantity,
                "prices": {},
            }
        cpk = str(bid_pk_map[bi.bid_id])
        price = bi.unit_price if not bi.was_omitted else None
        item_map[bi.pay_item_code]["prices"][cpk] = price

    items = []
    for code, data in item_map.items():
        valid_prices = [p for p in data["prices"].values() if p is not None and p > 0]
        low = min(valid_prices) if valid_prices else None
        high = max(valid_prices) if valid_prices else None
        spread = float((high - low) / low * 100) if low and high and low > 0 else None

        items.append(BidTabLineItem(
            pay_item_code=code,
            abbreviation=data["abbreviation"],
            unit=data["unit"],
            quantity=data["quantity"],
            prices=data["prices"],
            low_price=low,
            high_price=high,
            spread_pct=round(spread, 2) if spread is not None else None,
        ))

    return BidTabOut(
        contract_id=contract.contract_id,
        contract_number=contract.number,
        letting_date=contract.letting_date,
        county=contract.county,
        district=contract.district,
        bidders=bidders,
        items=items,
        total_items=len(items),
    )


@router.get("/contracts/{contract_id}/category-breakdown", response_model=CategoryBreakdownOut)
async def get_category_breakdown(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    bid_id: uuid.UUID | None = None,
):
    """Category breakdown of a bid by pay item division. Defaults to low bid."""
    # Get contract
    result = await db.execute(
        select(Contract).where(Contract.contract_id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Get the target bid
    if bid_id:
        bid_result = await db.execute(
            select(Bid).options(selectinload(Bid.contractor))
            .where(Bid.bid_id == bid_id, Bid.contract_id == contract_id)
        )
    else:
        # Default to low bid
        bid_result = await db.execute(
            select(Bid).options(selectinload(Bid.contractor))
            .where(Bid.contract_id == contract_id, Bid.is_low == True)
        )

    bid = bid_result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    # Aggregate bid items by division
    result = await db.execute(
        select(
            func.coalesce(PayItem.division, "UNCATEGORIZED").label("division"),
            func.sum(BidItem.quantity * BidItem.unit_price).label("total"),
            func.count(BidItem.bid_item_id).label("item_count"),
        )
        .outerjoin(PayItem, and_(PayItem.code == BidItem.pay_item_code, PayItem.agency == "IDOT"))
        .where(
            BidItem.bid_id == bid.bid_id,
            BidItem.was_omitted == False,
        )
        .group_by(func.coalesce(PayItem.division, "UNCATEGORIZED"))
        .order_by(func.sum(BidItem.quantity * BidItem.unit_price).desc())
    )
    rows = result.all()

    grand_total = sum(r.total for r in rows if r.total) or Decimal("1")

    return CategoryBreakdownOut(
        contract_id=contract.contract_id,
        bid_id=bid.bid_id,
        contractor_name=bid.contractor.name if bid.contractor else "",
        breakdown=[
            CategoryBreakdownEntry(
                division=r.division,
                total=round(r.total, 2) if r.total else Decimal("0"),
                pct_of_contract=round(float(r.total / grand_total * 100), 2) if r.total else 0,
                item_count=r.item_count,
            )
            for r in rows
        ],
        grand_total=round(grand_total, 2),
    )
