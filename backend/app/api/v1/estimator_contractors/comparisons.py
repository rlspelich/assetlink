"""Head-to-head comparisons, competitors, and contractor vs market analysis."""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.models.pay_item import PayItem
from app.schemas.contractor_intelligence import (
    HeadToHeadContract,
    HeadToHeadItemComparison,
    HeadToHeadItemsOut,
    HeadToHeadSummary,
)

from .helpers import _get_contractor

router = APIRouter()


@router.get("/contractors/{contractor_pk}/competitors")
async def get_competitors(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict]:
    """Get contractors who have competed against this contractor, ranked by frequency."""
    await _get_contractor(db, contractor_pk)

    # Find all contractors who bid on the same contracts, ranked by shared contract count
    result = await db.execute(
        select(
            Contractor.contractor_pk,
            Contractor.name,
            Contractor.contractor_id_code,
            func.count(distinct(Bid.contract_id)).label("shared_contracts"),
        )
        .join(Bid, Bid.contractor_pk == Contractor.contractor_pk)
        .where(
            Bid.contract_id.in_(
                select(Bid.contract_id).where(Bid.contractor_pk == contractor_pk)
            ),
            Contractor.contractor_pk != contractor_pk,
        )
        .group_by(Contractor.contractor_pk, Contractor.name, Contractor.contractor_id_code)
        .order_by(func.count(distinct(Bid.contract_id)).desc())
        .limit(limit)
    )

    return [
        {
            "contractor_pk": str(r.contractor_pk),
            "name": r.name,
            "contractor_id_code": r.contractor_id_code,
            "shared_contracts": r.shared_contracts,
        }
        for r in result.all()
    ]


@router.get("/contractors/head-to-head", response_model=HeadToHeadSummary)
async def get_head_to_head(
    contractor_a: uuid.UUID = Query(..., description="First contractor UUID"),
    contractor_b: uuid.UUID = Query(..., description="Second contractor UUID"),
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    max_date: str | None = None,
    county: str | None = None,
) -> HeadToHeadSummary:
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
) -> HeadToHeadItemsOut:
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


@router.get("/contractors/{contractor_pk}/vs-market")
async def get_contractor_vs_market(
    contractor_pk: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    min_date: str | None = None,
    county: str | None = None,
    district: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    """
    Compare a contractor's average prices to the market average (all other bidders).

    Like head-to-head but contractor B is 'the market'.
    """
    contractor = await _get_contractor(db, contractor_pk)

    date_filter = []
    if min_date:
        date_filter.append(Contract.letting_date >= date.fromisoformat(min_date))
    if county:
        date_filter.append(Contract.county.ilike(f"%{county}%"))
    if district:
        date_filter.append(Contract.district == district)

    # Contractor's averages by pay item
    contractor_q = (
        select(
            BidItem.pay_item_code,
            func.avg(BidItem.unit_price).label("avg_price"),
            func.count(BidItem.bid_item_id).label("sample_count"),
        )
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .where(
            Bid.contractor_pk == contractor_pk,
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
            *date_filter,
        )
        .group_by(BidItem.pay_item_code)
        .having(func.count(BidItem.bid_item_id) >= 2)
        .subquery()
    )

    # Market averages for the same items (all bidders except this one)
    market_q = (
        select(
            BidItem.pay_item_code,
            func.avg(BidItem.unit_price).label("avg_price"),
            func.count(BidItem.bid_item_id).label("sample_count"),
        )
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .where(
            Bid.contractor_pk != contractor_pk,
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
            BidItem.pay_item_code.in_(select(contractor_q.c.pay_item_code)),
            *date_filter,
        )
        .group_by(BidItem.pay_item_code)
        .subquery()
    )

    # Join contractor vs market
    query = (
        select(
            contractor_q.c.pay_item_code,
            contractor_q.c.avg_price.label("contractor_avg"),
            contractor_q.c.sample_count.label("contractor_samples"),
            market_q.c.avg_price.label("market_avg"),
            market_q.c.sample_count.label("market_samples"),
            PayItem.description.label("description"),
            PayItem.unit.label("unit"),
        )
        .join(market_q, contractor_q.c.pay_item_code == market_q.c.pay_item_code)
        .outerjoin(PayItem, and_(PayItem.code == contractor_q.c.pay_item_code, PayItem.agency == "IDOT"))
    )

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Page
    query = query.order_by(contractor_q.c.pay_item_code)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    items = []
    for r in result.all():
        c_avg = Decimal(str(r.contractor_avg or 0))
        m_avg = Decimal(str(r.market_avg or 0))
        variance = float((c_avg - m_avg) / m_avg * 100) if m_avg > 0 else 0
        items.append({
            "pay_item_code": r.pay_item_code,
            "description": r.description or "",
            "unit": r.unit or "",
            "contractor_avg_price": round(c_avg, 4),
            "market_avg_price": round(m_avg, 4),
            "variance_pct": round(variance, 2),
            "contractor_samples": r.contractor_samples,
            "market_samples": r.market_samples,
        })

    return {
        "contractor_pk": str(contractor_pk),
        "contractor_name": contractor.name,
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
