"""Bid detail endpoint."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.bid import Bid
from app.schemas.contract import BidDetailOut, BidItemOut

router = APIRouter()


@router.get("/bids/{bid_id}", response_model=BidDetailOut)
async def get_bid(
    bid_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> BidDetailOut:
    """Get bid detail with all line items. Reference data — no tenant filter."""
    result = await db.execute(
        select(Bid)
        .options(selectinload(Bid.contractor), selectinload(Bid.items))
        .where(Bid.bid_id == bid_id)
    )
    bid = result.scalar_one_or_none()
    if not bid:
        raise HTTPException(status_code=404, detail="Bid not found")

    items = [
        BidItemOut(
            bid_item_id=item.bid_item_id,
            bid_id=item.bid_id,
            pay_item_code=item.pay_item_code,
            abbreviation=item.abbreviation,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            was_omitted=item.was_omitted,
            extension=item.quantity * item.unit_price,
        )
        for item in bid.items
    ]

    return BidDetailOut(
        bid_id=bid.bid_id,
        contract_id=bid.contract_id,
        contractor_pk=bid.contractor_pk,
        contractor_name=bid.contractor.name if bid.contractor else "",
        contractor_id_code=bid.contractor.contractor_id_code if bid.contractor else "",
        rank=bid.rank,
        total=bid.total,
        doc_total=bid.doc_total,
        is_low=bid.is_low,
        is_bad=bid.is_bad,
        has_alt=bid.has_alt,
        no_omitted=bid.no_omitted,
        item_count=len(items),
        created_at=bid.created_at,
        updated_at=bid.updated_at,
        items=items,
    )
