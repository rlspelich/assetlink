"""Contract listing, filtering, and detail endpoints."""
import uuid
from datetime import date as dt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.bid import Bid
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.schemas.contract import (
    BidOut,
    ContractDetailOut,
    ContractListOut,
    ContractOut,
)

router = APIRouter()


@router.get("/contracts/filter-options")
async def get_contract_filter_options(db: AsyncSession = Depends(get_db)) -> dict:
    """Get distinct counties, districts, county-district mappings, and date range."""

    # County-district pairs (for dependent dropdowns)
    pairs_q = await db.execute(
        select(Contract.county, Contract.district)
        .where(Contract.county != "", Contract.district != "")
        .distinct()
        .order_by(Contract.county, Contract.district)
    )
    pairs = pairs_q.all()

    # Build mappings
    counties = sorted(set(r[0] for r in pairs))
    districts = sorted(set(r[1] for r in pairs))

    # county → [districts] and district → [counties]
    county_to_districts: dict[str, list[str]] = {}
    district_to_counties: dict[str, list[str]] = {}
    for county, district in pairs:
        county_to_districts.setdefault(county, []).append(district)
        district_to_counties.setdefault(district, []).append(county)
    # Dedupe and sort
    for k in county_to_districts:
        county_to_districts[k] = sorted(set(county_to_districts[k]))
    for k in district_to_counties:
        district_to_counties[k] = sorted(set(district_to_counties[k]))

    date_range = await db.execute(
        select(func.min(Contract.letting_date), func.max(Contract.letting_date))
    )
    dr = date_range.one()

    return {
        "counties": counties,
        "districts": districts,
        "county_to_districts": county_to_districts,
        "district_to_counties": district_to_counties,
        "min_date": str(dr[0]) if dr[0] else None,
        "max_date": str(dr[1]) if dr[1] else None,
    }


@router.get("/contracts", response_model=ContractListOut)
async def list_contracts(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    agency: str | None = None,
    county: str | None = None,
    district: str | None = None,
    search: str | None = None,
    min_date: str | None = None,
    max_date: str | None = None,
    municipality: str | None = None,
) -> ContractListOut:
    """List contracts with optional filters. Reference data — no tenant filter."""
    query = select(Contract)

    if agency:
        query = query.where(Contract.agency == agency)
    if county:
        query = query.where(Contract.county.ilike(f"%{county}%"))
    if district:
        query = query.where(Contract.district == district)
    if search:
        query = query.where(
            Contract.number.ilike(f"%{search}%")
            | Contract.municipality.ilike(f"%{search}%")
            | Contract.county.ilike(f"%{search}%")
        )
    if min_date:
        query = query.where(Contract.letting_date >= dt.fromisoformat(min_date))
    if max_date:
        query = query.where(Contract.letting_date <= dt.fromisoformat(max_date))
    if municipality:
        query = query.where(Contract.municipality.ilike(f"%{municipality}%"))

    # Count
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch page
    query = query.order_by(desc(Contract.letting_date))
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    contracts = result.scalars().all()

    # Enrich with bid counts
    contract_ids = [c.contract_id for c in contracts]
    bid_counts: dict[uuid.UUID, int] = {}
    low_bid_totals: dict[uuid.UUID, float] = {}

    if contract_ids:
        # Bid counts (all bids)
        count_result = await db.execute(
            select(Bid.contract_id, func.count(Bid.bid_id))
            .where(Bid.contract_id.in_(contract_ids))
            .group_by(Bid.contract_id)
        )
        for row in count_result:
            bid_counts[row[0]] = row[1]

        # Low bid totals (exclude bad bids)
        low_result = await db.execute(
            select(Bid.contract_id, func.min(Bid.total))
            .where(Bid.contract_id.in_(contract_ids), Bid.is_bad == False)
            .group_by(Bid.contract_id)
        )
        for row in low_result:
            low_bid_totals[row[0]] = row[1]

    return ContractListOut(
        contracts=[
            ContractOut(
                **{c: getattr(contract, c) for c in ContractOut.model_fields
                   if c not in ("bid_count", "low_bid_total")
                   and hasattr(contract, c)},
                bid_count=bid_counts.get(contract.contract_id, 0),
                low_bid_total=low_bid_totals.get(contract.contract_id),
            )
            for contract in contracts
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/contracts/{contract_id}", response_model=ContractDetailOut)
async def get_contract(
    contract_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ContractDetailOut:
    """Get contract detail with all bids. Reference data — no tenant filter."""
    result = await db.execute(
        select(Contract)
        .where(Contract.contract_id == contract_id)
    )
    contract = result.scalar_one_or_none()
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")

    # Get bids with contractor info
    bid_result = await db.execute(
        select(Bid)
        .options(selectinload(Bid.contractor), selectinload(Bid.items))
        .where(Bid.contract_id == contract_id)
        .order_by(Bid.rank)
    )
    bids = bid_result.scalars().all()

    bid_outs = []
    for bid in bids:
        bid_outs.append(BidOut(
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
            item_count=len(bid.items),
            created_at=bid.created_at,
            updated_at=bid.updated_at,
        ))

    return ContractDetailOut(
        contract_id=contract.contract_id,
        number=contract.number,
        letting_date=contract.letting_date,
        letting_type=contract.letting_type,
        agency=contract.agency,
        county=contract.county,
        district=contract.district,
        municipality=contract.municipality,
        section_no=contract.section_no,
        job_no=contract.job_no,
        project_no=contract.project_no,
        letting_no=contract.letting_no,
        item_count=contract.item_count,
        source_file=contract.source_file,
        bid_count=len(bids),
        low_bid_total=min((b.total for b in bids if not b.is_bad), default=None),
        created_at=contract.created_at,
        updated_at=contract.updated_at,
        bids=bid_outs,
    )
