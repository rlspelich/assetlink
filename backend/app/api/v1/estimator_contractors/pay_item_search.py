"""Enhanced pay item search across all bids."""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.schemas.contractor_intelligence import (
    PayItemSearchOut,
    PayItemSearchResult,
    PayItemSearchStats,
)

router = APIRouter()


@router.get("/pay-item-search", response_model=PayItemSearchOut)
async def search_pay_item_occurrences(
    db: AsyncSession = Depends(get_db),
    pay_item_code: str | None = None,
    description: str | None = None,
    county: str | None = None,
    district: str | None = None,
    contractor: str | None = None,
    min_date: str | None = None,
    max_date: str | None = None,
    min_quantity: float | None = None,
    max_quantity: float | None = None,
    low_bids_only: bool = False,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> PayItemSearchOut:
    """
    Search every occurrence of a pay item across all bids.

    Returns individual bid-level prices with contractor, contract, and job context.
    Includes summary stats (weighted avg, straight avg, median, high, low).
    """
    if not pay_item_code and not description:
        raise HTTPException(status_code=400, detail="Provide pay_item_code or description")

    query = (
        select(
            BidItem.bid_item_id,
            BidItem.pay_item_code,
            BidItem.abbreviation,
            BidItem.unit,
            BidItem.quantity,
            BidItem.unit_price,
            (BidItem.quantity * BidItem.unit_price).label("extension"),
            Contractor.name.label("contractor_name"),
            Contractor.contractor_id_code,
            Contractor.contractor_pk,
            Contract.number.label("contract_number"),
            Contract.contract_id,
            Contract.letting_date,
            Contract.county,
            Contract.district,
            Bid.rank,
            Bid.is_low,
        )
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(Contractor, Bid.contractor_pk == Contractor.contractor_pk)
        .where(BidItem.was_omitted == False, BidItem.unit_price > 0)
    )

    if pay_item_code:
        if '%' in pay_item_code or '_' in pay_item_code:
            query = query.where(BidItem.pay_item_code.ilike(pay_item_code))
        else:
            query = query.where(BidItem.pay_item_code == pay_item_code)
    if description:
        query = query.where(BidItem.abbreviation.ilike(f"%{description}%"))
    if county:
        query = query.where(Contract.county.ilike(f"%{county}%"))
    if district:
        query = query.where(Contract.district == district)
    if contractor:
        query = query.where(Contractor.name.ilike(f"%{contractor}%"))
    if min_date:
        query = query.where(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        query = query.where(Contract.letting_date <= date.fromisoformat(max_date))
    if min_quantity:
        query = query.where(BidItem.quantity >= min_quantity)
    if max_quantity:
        query = query.where(BidItem.quantity <= max_quantity)
    if low_bids_only:
        query = query.where(Bid.is_low == True)

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Stats (on full filtered set, not just current page)
    stats_q = (
        select(
            func.count(BidItem.bid_item_id).label("count"),
            func.sum(BidItem.quantity * BidItem.unit_price).label("weighted_total"),
            func.sum(BidItem.quantity).label("total_qty"),
            func.avg(BidItem.unit_price).label("straight_avg"),
            func.min(BidItem.unit_price).label("low"),
            func.max(BidItem.unit_price).label("high"),
        )
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(Contractor, Bid.contractor_pk == Contractor.contractor_pk)
        .where(BidItem.was_omitted == False, BidItem.unit_price > 0)
    )
    # Apply same filters
    if pay_item_code:
        if '%' in pay_item_code or '_' in pay_item_code:
            stats_q = stats_q.where(BidItem.pay_item_code.ilike(pay_item_code))
        else:
            stats_q = stats_q.where(BidItem.pay_item_code == pay_item_code)
    if description:
        stats_q = stats_q.where(BidItem.abbreviation.ilike(f"%{description}%"))
    if county:
        stats_q = stats_q.where(Contract.county.ilike(f"%{county}%"))
    if district:
        stats_q = stats_q.where(Contract.district == district)
    if contractor:
        stats_q = stats_q.where(Contractor.name.ilike(f"%{contractor}%"))
    if min_date:
        stats_q = stats_q.where(Contract.letting_date >= date.fromisoformat(min_date))
    if max_date:
        stats_q = stats_q.where(Contract.letting_date <= date.fromisoformat(max_date))
    if min_quantity:
        stats_q = stats_q.where(BidItem.quantity >= min_quantity)
    if max_quantity:
        stats_q = stats_q.where(BidItem.quantity <= max_quantity)
    if low_bids_only:
        stats_q = stats_q.where(Bid.is_low == True)

    stats_row = (await db.execute(stats_q)).one()
    weighted_avg = None
    if stats_row.total_qty and stats_row.total_qty > 0:
        weighted_avg = round(Decimal(str(stats_row.weighted_total)) / Decimal(str(stats_row.total_qty)), 4)

    stats = PayItemSearchStats(
        count=stats_row.count or 0,
        weighted_avg=weighted_avg,
        straight_avg=round(stats_row.straight_avg, 4) if stats_row.straight_avg else None,
        median=None,  # Would need a window function; skip for now
        high=stats_row.high,
        low=stats_row.low,
        total_quantity=round(stats_row.total_qty, 3) if stats_row.total_qty else None,
    )

    # Fetch page
    query = query.order_by(Contract.letting_date.desc(), Contract.number, Bid.rank)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)

    return PayItemSearchOut(
        results=[
            PayItemSearchResult(
                bid_item_id=r.bid_item_id,
                pay_item_code=r.pay_item_code,
                abbreviation=r.abbreviation,
                unit=r.unit,
                quantity=r.quantity,
                unit_price=r.unit_price,
                extension=round(r.extension, 2) if r.extension else Decimal("0"),
                contractor_name=r.contractor_name,
                contractor_id_code=r.contractor_id_code,
                contractor_pk=r.contractor_pk,
                contract_number=r.contract_number,
                contract_id=r.contract_id,
                letting_date=r.letting_date,
                county=r.county,
                district=r.district,
                rank=r.rank,
                is_low=r.is_low,
            )
            for r in result.all()
        ],
        total=total,
        page=page,
        page_size=page_size,
        stats=stats,
    )
