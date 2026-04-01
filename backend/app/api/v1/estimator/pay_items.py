"""Pay item catalog search and price history."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.models.pay_item import PayItem
from app.schemas.contract import (
    PayItemListOut,
    PayItemOut,
    PriceHistoryOut,
    PriceHistoryPoint,
)

router = APIRouter()


@router.get("/pay-items", response_model=PayItemListOut)
async def list_pay_items(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    agency: str = "IDOT",
    division: str | None = None,
) -> PayItemListOut:
    """Search the pay item catalog."""
    query = select(PayItem).where(PayItem.agency == agency)

    if search:
        query = query.where(
            PayItem.code.ilike(f"%{search}%")
            | PayItem.description.ilike(f"%{search}%")
        )
    if division:
        query = query.where(PayItem.division.ilike(f"%{division}%"))

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(PayItem.code)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    items = result.scalars().all()

    return PayItemListOut(
        pay_items=[PayItemOut.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/pay-items/{code}/price-history", response_model=PriceHistoryOut)
async def get_price_history(
    code: str,
    db: AsyncSession = Depends(get_db),
    agency: str = "IDOT",
) -> PriceHistoryOut:
    """Get price history for a pay item across all contracts. Reference data."""
    # Get pay item info
    pay_item = await db.execute(
        select(PayItem).where(PayItem.agency == agency, PayItem.code == code)
    )
    pi = pay_item.scalar_one_or_none()

    # Get all bid items for this code with contract and contractor info
    query = (
        select(BidItem, Bid, Contract, Contractor)
        .join(Bid, BidItem.bid_id == Bid.bid_id)
        .join(Contract, Bid.contract_id == Contract.contract_id)
        .join(Contractor, Bid.contractor_pk == Contractor.contractor_pk)
        .where(
            BidItem.pay_item_code == code,
            BidItem.was_omitted == False,
            BidItem.unit_price > 0,
        )
        .order_by(Contract.letting_date)
    )
    result = await db.execute(query)
    rows = result.all()

    data_points = []
    prices = []
    for bid_item, bid, contract, contractor in rows:
        prices.append(bid_item.unit_price)
        data_points.append(PriceHistoryPoint(
            letting_date=contract.letting_date,
            unit_price=bid_item.unit_price,
            quantity=bid_item.quantity,
            contract_number=contract.number,
            contractor_name=contractor.name,
            county=contract.county,
            district=contract.district,
            agency=contract.agency,
        ))

    avg_price = sum(prices) / len(prices) if prices else None
    sorted_prices = sorted(prices) if prices else []
    median_price = (
        sorted_prices[len(sorted_prices) // 2] if sorted_prices else None
    )

    return PriceHistoryOut(
        pay_item_code=code,
        description=pi.description if pi else "",
        unit=pi.unit if pi else "",
        data_points=data_points,
        total_records=len(data_points),
        avg_unit_price=avg_price,
        median_unit_price=median_price,
        min_unit_price=min(prices) if prices else None,
        max_unit_price=max(prices) if prices else None,
    )
