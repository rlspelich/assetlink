"""Letting report — contracts and bidders for a specific letting date."""
import uuid
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.bid import Bid
from app.models.contract import Contract
from app.schemas.contractor_intelligence import (
    LettingBidderEntry,
    LettingContractEntry,
    LettingReportOut,
)

router = APIRouter()


@router.get("/letting-dates")
async def get_letting_dates(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(100, ge=1, le=500),
) -> list[dict]:
    """Get distinct letting dates for the letting report picker."""
    result = await db.execute(
        select(
            Contract.letting_date,
            func.count(Contract.contract_id).label("contract_count"),
        )
        .group_by(Contract.letting_date)
        .order_by(Contract.letting_date.desc())
        .limit(limit)
    )
    return [
        {"letting_date": str(r.letting_date), "contract_count": r.contract_count}
        for r in result.all()
    ]


@router.get("/letting-report", response_model=LettingReportOut)
async def get_letting_report(
    letting_date: str = Query(..., description="Letting date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    county: str | None = None,
    district: str | None = None,
) -> LettingReportOut:
    """
    Letting report: all contracts and bidders for a specific letting date.

    Shows each contract with all bidders ranked, including variance from low.
    """
    ld = date.fromisoformat(letting_date)

    # Get contracts for this letting
    query = select(Contract).where(Contract.letting_date == ld)
    if county:
        query = query.where(Contract.county.ilike(f"%{county}%"))
    if district:
        query = query.where(Contract.district == district)
    query = query.order_by(Contract.county, Contract.number)

    contracts_result = await db.execute(query)
    contracts = contracts_result.scalars().all()

    if not contracts:
        return LettingReportOut(
            letting_date=ld, total_contracts=0,
            total_value=Decimal("0"), contracts=[],
        )

    # Get all bids for these contracts
    contract_ids = [c.contract_id for c in contracts]
    bids_result = await db.execute(
        select(Bid)
        .options(selectinload(Bid.contractor))
        .where(Bid.contract_id.in_(contract_ids))
        .order_by(Bid.contract_id, Bid.rank)
    )
    all_bids = bids_result.scalars().all()

    # Group bids by contract
    bids_by_contract: dict[uuid.UUID, list] = {}
    for b in all_bids:
        bids_by_contract.setdefault(b.contract_id, []).append(b)

    total_value = Decimal("0")
    contract_entries = []

    for contract in contracts:
        bids = bids_by_contract.get(contract.contract_id, [])
        low_bid = next((b for b in bids if b.is_low and not b.is_bad), None)
        low_total = low_bid.total if low_bid else None
        if low_total:
            total_value += low_total

        bidder_entries = []
        for b in bids:
            variance = None
            variance_pct = None
            if low_total and not b.is_low and not b.is_bad and low_total > 0:
                variance = b.total - low_total
                variance_pct = float(variance / low_total * 100)

            bidder_entries.append(LettingBidderEntry(
                contractor_name=b.contractor.name if b.contractor else "",
                contractor_id_code=b.contractor.contractor_id_code if b.contractor else "",
                contractor_pk=str(b.contractor.contractor_pk) if b.contractor else None,
                rank=b.rank,
                total=b.total,
                is_low=b.is_low,
                variance_from_low=round(variance, 2) if variance is not None else None,
                variance_pct=round(variance_pct, 2) if variance_pct is not None else None,
            ))

        contract_entries.append(LettingContractEntry(
            contract_id=contract.contract_id,
            contract_number=contract.number,
            county=contract.county,
            district=contract.district,
            item_count=contract.item_count,
            low_bidder_name=low_bid.contractor.name if low_bid and low_bid.contractor else "",
            low_bid_total=low_total,
            num_bidders=len(bids),
            bidders=bidder_entries,
        ))

    return LettingReportOut(
        letting_date=ld,
        total_contracts=len(contract_entries),
        total_value=round(total_value, 2),
        contracts=contract_entries,
    )
