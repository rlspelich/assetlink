"""Bid tabulation and category breakdown for contracts."""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.pay_item import PayItem
from app.schemas.contractor_intelligence import (
    BidTabBidder,
    BidTabLineItem,
    BidTabOut,
    CategoryBreakdownEntry,
    CategoryBreakdownOut,
)

router = APIRouter()


@router.get("/contracts/{contract_id}/bid-tab", response_model=BidTabOut)
async def get_bid_tab(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BidTabOut:
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
) -> CategoryBreakdownOut:
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
    div_col = func.coalesce(PayItem.division, "UNCATEGORIZED")
    result = await db.execute(
        select(
            div_col.label("division"),
            func.sum(BidItem.quantity * BidItem.unit_price).label("total"),
            func.count(BidItem.bid_item_id).label("item_count"),
        )
        .outerjoin(PayItem, and_(PayItem.code == BidItem.pay_item_code, PayItem.agency == "IDOT"))
        .where(
            BidItem.bid_id == bid.bid_id,
            BidItem.was_omitted == False,
        )
        .group_by(div_col)
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
