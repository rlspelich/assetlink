"""
Estimator module API endpoints.

Provides:
- Contract CRUD + listing with filters
- Contractor listing + search
- Bid detail with line items
- Pay item catalog search + price history
- File upload for bid tab import (IDOT, ISTHA)
- Award CSV import
"""
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.award_item import AwardItem
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.models.pay_item import PayItem
from app.schemas.contract import (
    AwardItemListOut,
    AwardItemOut,
    BidDetailOut,
    BidItemOut,
    BidOut,
    BidTabImportOut,
    ContractDetailOut,
    ContractListOut,
    ContractOut,
    ContractorListOut,
    ContractorOut,
    PayItemListOut,
    PayItemOut,
    PriceHistoryOut,
    PriceHistoryPoint,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Contracts
# ---------------------------------------------------------------------------


@router.get("/contracts/filter-options")
async def get_contract_filter_options(db: AsyncSession = Depends(get_db)):
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
):
    """List contracts with optional filters. Reference data — no tenant filter."""
    from datetime import date as dt

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
        bid_stats = await db.execute(
            select(
                Bid.contract_id,
                func.count(Bid.bid_id),
                func.min(Bid.total).filter(Bid.is_bad == False),
            )
            .where(Bid.contract_id.in_(contract_ids))
            .group_by(Bid.contract_id)
        )
        for row in bid_stats:
            bid_counts[row[0]] = row[1]
            low_bid_totals[row[0]] = row[2]

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
):
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


# ---------------------------------------------------------------------------
# Bids
# ---------------------------------------------------------------------------


@router.get("/bids/{bid_id}", response_model=BidDetailOut)
async def get_bid(
    bid_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
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


# ---------------------------------------------------------------------------
# Contractors
# ---------------------------------------------------------------------------


@router.get("/contractors", response_model=ContractorListOut)
async def list_contractors(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
):
    """List contractors with search. Reference data — no tenant filter."""
    query = select(Contractor)

    if search:
        query = query.where(
            Contractor.name.ilike(f"%{search}%")
            | Contractor.contractor_id_code.ilike(f"%{search}%")
        )

    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0

    query = query.order_by(Contractor.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    contractors = result.scalars().all()

    # Get bid counts and win counts
    contractor_pks = [c.contractor_pk for c in contractors]
    bid_counts: dict[uuid.UUID, int] = {}
    win_counts: dict[uuid.UUID, int] = {}

    if contractor_pks:
        stats = await db.execute(
            select(
                Bid.contractor_pk,
                func.count(Bid.bid_id),
                func.count(Bid.bid_id).filter(Bid.is_low == True),
            )
            .where(Bid.contractor_pk.in_(contractor_pks))
            .group_by(Bid.contractor_pk)
        )
        for row in stats:
            bid_counts[row[0]] = row[1]
            win_counts[row[0]] = row[2]

    return ContractorListOut(
        contractors=[
            ContractorOut(
                contractor_pk=c.contractor_pk,
                contractor_id_code=c.contractor_id_code,
                name=c.name,
                bid_count=bid_counts.get(c.contractor_pk, 0),
                win_count=win_counts.get(c.contractor_pk, 0),
                created_at=c.created_at,
                updated_at=c.updated_at,
            )
            for c in contractors
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ---------------------------------------------------------------------------
# Pay Items
# ---------------------------------------------------------------------------


@router.get("/pay-items", response_model=PayItemListOut)
async def list_pay_items(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: str | None = None,
    agency: str = "IDOT",
    division: str | None = None,
):
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
):
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


# ---------------------------------------------------------------------------
# Import endpoints
# ---------------------------------------------------------------------------


@router.post("/import/idot-bidtabs", response_model=BidTabImportOut)
async def import_idot_bidtabs(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload and import one or more IDOT bid tab text files (reference data)."""
    from app.services.estimator.parsers.idot_bidtabs import parse_idot_file
    from app.services.estimator.import_service import import_idot_bidtab

    start = time.time()
    totals = BidTabImportOut()

    for upload in files:
        try:
            content = await upload.read()
            text = content.decode("utf-8", errors="replace")
            lines = text.splitlines()

            parsed = parse_idot_file(lines, source_file=upload.filename or "")
            result = await import_idot_bidtab(db, parsed, upload.filename or "")

            if "error" in result:
                totals.errors.append(f"{upload.filename}: {result['error']}")
                totals.files_skipped += 1
            else:
                totals.files_processed += 1
                totals.contracts_created += 1 if result.get("contract_created") else 0
                totals.contracts_updated += 0 if result.get("contract_created") else 1
                totals.contractors_created += result.get("contractors_created", 0)
                totals.bids_created += result.get("bids_created", 0)
                totals.bid_items_created += result.get("bid_items_created", 0)

            totals.warnings.extend(result.get("warnings", []))

        except Exception as e:
            totals.errors.append(f"{upload.filename}: {e}")
            totals.files_skipped += 1

    totals.duration_seconds = round(time.time() - start, 2)
    return totals


@router.post("/import/idot-awards", response_model=BidTabImportOut)
async def import_idot_awards_endpoint(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload and import one or more IDOT award CSV files (reference data, no tenant)."""
    from app.services.estimator.parsers.idot_awards import parse_idot_awards_file
    from app.services.estimator.import_service import import_idot_awards

    start = time.time()
    totals = BidTabImportOut()

    for upload in files:
        try:
            content = await upload.read()
            text = content.decode("utf-8", errors="replace")

            parsed = parse_idot_awards_file(text, source_file=upload.filename or "")
            result = await import_idot_awards(db, parsed)

            if "error" in result:
                totals.errors.append(f"{upload.filename}: {result['error']}")
                totals.files_skipped += 1
            else:
                totals.files_processed += 1
                totals.bid_items_created += result.get("created", 0)

            totals.warnings.extend(result.get("warnings", []))

        except Exception as e:
            totals.errors.append(f"{upload.filename}: {e}")
            totals.files_skipped += 1

    totals.duration_seconds = round(time.time() - start, 2)
    return totals


@router.post("/import/istha-bidtabs", response_model=BidTabImportOut)
async def import_istha_bidtabs_endpoint(
    files: list[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload and import one or more ISTHA bid tab CSV files (reference data)."""
    from app.services.estimator.parsers.istha_bidtabs import parse_istha_file
    from app.services.estimator.import_service import import_istha_bidtabs

    start = time.time()
    totals = BidTabImportOut()

    for upload in files:
        try:
            content = await upload.read()
            text = content.decode("utf-8", errors="replace")

            parsed = parse_istha_file(text, source_file=upload.filename or "")
            result = await import_istha_bidtabs(db, parsed)

            if "error" in result:
                totals.errors.append(f"{upload.filename}: {result['error']}")
                totals.files_skipped += 1
            else:
                totals.files_processed += 1
                totals.contracts_created += 1 if result.get("contract_created") else 0
                totals.contracts_updated += 0 if result.get("contract_created") else 1
                totals.contractors_created += result.get("contractors_created", 0)
                totals.bids_created += result.get("bids_created", 0)
                totals.bid_items_created += result.get("bid_items_created", 0)

            totals.warnings.extend(result.get("warnings", []))

        except Exception as e:
            totals.errors.append(f"{upload.filename}: {e}")
            totals.files_skipped += 1

    totals.duration_seconds = round(time.time() - start, 2)
    return totals


# ===========================================================================
# ESTIMATOR FEATURES: Price History, Stats, Confidence, Estimates, Seed
# ===========================================================================

from app.models.award_item import AwardItem as AwardItemModel
from app.schemas.estimator import (
    AwardPriceHistoryOut, AwardPricePoint, ConfidenceOut,
    EstimateCreate, EstimateDetailOut, EstimateItemCreate, EstimateItemOut,
    EstimateItemUpdate, EstimateListOut, EstimateOut, EstimateUpdate,
    PriceStatsOut, RegionalFactorOut, SeedResultOut,
)


@router.get("/award-items/{code}/price-history", response_model=AwardPriceHistoryOut)
async def get_award_price_history(
    code: str, db: AsyncSession = Depends(get_db),
    district: str | None = None, county: str | None = None,
    min_date: str | None = None, max_date: str | None = None,
    limit: int = Query(2000, ge=1, le=10000),
):
    """Get price history for a pay item from the shared award data (1.4M rows)."""
    from datetime import date as dt
    query = select(AwardItemModel).where(
        AwardItemModel.pay_item_code == code, AwardItemModel.unit_price > 0,
    ).order_by(AwardItemModel.letting_date).limit(limit)
    if district: query = query.where(AwardItemModel.district == district)
    if county: query = query.where(AwardItemModel.county.ilike(f"%{county}%"))
    if min_date: query = query.where(AwardItemModel.letting_date >= dt.fromisoformat(min_date))
    if max_date: query = query.where(AwardItemModel.letting_date <= dt.fromisoformat(max_date))
    result = await db.execute(query)
    rows = result.scalars().all()
    prices = [r.unit_price for r in rows]
    sorted_p = sorted(prices) if prices else []
    return AwardPriceHistoryOut(
        pay_item_code=code, description=rows[0].abbreviation if rows else "",
        unit=rows[0].unit if rows else "",
        data_points=[AwardPricePoint(letting_date=r.letting_date, unit_price=r.unit_price,
            quantity=r.quantity, contract_number=r.contract_number,
            county=r.county, district=r.district) for r in rows],
        total_records=len(rows),
        avg_unit_price=sum(prices)/len(prices) if prices else None,
        median_unit_price=sorted_p[len(sorted_p)//2] if sorted_p else None,
        min_unit_price=min(prices) if prices else None,
        max_unit_price=max(prices) if prices else None,
    )


@router.get("/pay-items/{code}/price-stats", response_model=PriceStatsOut)
async def get_price_stats(
    code: str, db: AsyncSession = Depends(get_db),
    district: str | None = None, years_back: int = Query(10, ge=1, le=25),
    adjust_inflation: bool = True, target_year: int | None = None, target_state: str = "IL",
):
    """Get weighted price statistics for a pay item (powers the estimate builder)."""
    from app.services.estimator.pricing_engine import compute_price_stats
    stats = await compute_price_stats(db, code, district=district, years_back=years_back,
        adjust_inflation=adjust_inflation, target_year=target_year, target_state=target_state)
    return PriceStatsOut(**{k: getattr(stats, k) for k in PriceStatsOut.model_fields})


@router.get("/pay-items/{code}/confidence", response_model=ConfidenceOut)
async def get_confidence(
    code: str, unit_price: float = Query(..., gt=0), db: AsyncSession = Depends(get_db),
    district: str | None = None, years_back: int = Query(10, ge=1, le=25),
    adjust_inflation: bool = True, target_year: int | None = None,
):
    """Score a proposed unit price against historical distribution."""
    from decimal import Decimal as Dec
    from app.services.estimator.pricing_engine import compute_confidence
    result = await compute_confidence(db, code, Dec(str(unit_price)),
        district=district, years_back=years_back,
        adjust_inflation=adjust_inflation, target_year=target_year)
    return ConfidenceOut(**result)


@router.get("/estimates", response_model=EstimateListOut)
async def list_estimates_endpoint(
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
):
    """List all estimates for the current tenant."""
    from app.services.estimator.estimate_service import list_estimates as _list
    estimates, total = await _list(db, tenant_id, page, page_size)
    return EstimateListOut(estimates=[EstimateOut.model_validate(e) for e in estimates],
        total=total, page=page, page_size=page_size)


@router.post("/estimates", response_model=EstimateOut, status_code=201)
async def create_estimate_endpoint(
    data: EstimateCreate, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a new estimate."""
    from app.services.estimator.estimate_service import create_estimate as _create
    estimate = await _create(db, tenant_id, name=data.name, description=data.description,
        target_state=data.target_state, target_district=data.target_district,
        use_inflation_adjustment=data.use_inflation_adjustment, target_year=data.target_year)
    return EstimateOut.model_validate(estimate)


@router.get("/estimates/{estimate_id}", response_model=EstimateDetailOut)
async def get_estimate_endpoint(
    estimate_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get an estimate with all its items."""
    from app.services.estimator.estimate_service import get_estimate as _get
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    return EstimateDetailOut(
        **{k: getattr(estimate, k) for k in EstimateOut.model_fields if hasattr(estimate, k)},
        items=[EstimateItemOut.model_validate(i) for i in estimate.items])


@router.put("/estimates/{estimate_id}", response_model=EstimateOut)
async def update_estimate_endpoint(
    estimate_id: uuid.UUID, data: EstimateUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
):
    """Update estimate metadata."""
    from app.services.estimator.estimate_service import get_estimate as _get
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(estimate, k, v)
    await db.flush()
    await db.refresh(estimate)
    return EstimateOut.model_validate(estimate)


@router.delete("/estimates/{estimate_id}", status_code=204)
async def delete_estimate_endpoint(
    estimate_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete an estimate and all its items."""
    from app.services.estimator.estimate_service import get_estimate as _get
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    await db.delete(estimate); await db.flush()


@router.post("/estimates/{estimate_id}/duplicate", response_model=EstimateOut, status_code=201)
async def duplicate_estimate_endpoint(
    estimate_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate an estimate with all its items."""
    from app.services.estimator.estimate_service import get_estimate as _get, duplicate_estimate as _dup
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    return EstimateOut.model_validate(await _dup(db, tenant_id, estimate))


@router.post("/estimates/{estimate_id}/recalculate", response_model=EstimateDetailOut)
async def recalculate_estimate_endpoint(
    estimate_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Re-run the pricing engine on all items in an estimate."""
    from app.services.estimator.estimate_service import get_estimate as _get, recalculate_estimate as _recalc
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    estimate = await _recalc(db, estimate)
    return EstimateDetailOut(
        **{k: getattr(estimate, k) for k in EstimateOut.model_fields if hasattr(estimate, k)},
        items=[EstimateItemOut.model_validate(i) for i in estimate.items])


@router.post("/estimates/{estimate_id}/items", response_model=list[EstimateItemOut], status_code=201)
async def add_estimate_items(
    estimate_id: uuid.UUID, items: list[EstimateItemCreate],
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
):
    """Add items to an estimate (auto-priced from historical data)."""
    from app.services.estimator.estimate_service import get_estimate as _get, add_items_to_estimate
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    created = await add_items_to_estimate(db, tenant_id, estimate, [i.model_dump() for i in items])
    return [EstimateItemOut.model_validate(i) for i in created]


@router.put("/estimates/{estimate_id}/items/{item_id}", response_model=EstimateItemOut)
async def update_estimate_item(
    estimate_id: uuid.UUID, item_id: uuid.UUID, data: EstimateItemUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
):
    """Update an estimate item (quantity, price override, etc.)."""
    from app.models.estimate import EstimateItem
    result = await db.execute(select(EstimateItem).where(
        EstimateItem.tenant_id == tenant_id, EstimateItem.estimate_id == estimate_id,
        EstimateItem.estimate_item_id == item_id))
    item = result.scalar_one_or_none()
    if not item: raise HTTPException(status_code=404, detail="Estimate item not found")
    for k, v in data.model_dump(exclude_unset=True).items(): setattr(item, k, v)
    # Manual overrides use unit_price directly; computed uses regional/adjusted
    if item.unit_price_source == "manual":
        price = item.unit_price
        item.adjusted_unit_price = item.unit_price
        item.regional_unit_price = item.unit_price
    else:
        price = item.regional_unit_price or item.adjusted_unit_price or item.unit_price
    item.extension = round(item.quantity * price, 2)
    await db.flush()
    from app.services.estimator.estimate_service import get_estimate as _get, _update_estimate_totals
    est = await _get(db, tenant_id, estimate_id)
    if est: await _update_estimate_totals(db, est)
    return EstimateItemOut.model_validate(item)


@router.delete("/estimates/{estimate_id}/items/{item_id}", status_code=204)
async def delete_estimate_item(
    estimate_id: uuid.UUID, item_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
):
    """Remove an item from an estimate."""
    from app.models.estimate import EstimateItem
    result = await db.execute(select(EstimateItem).where(
        EstimateItem.tenant_id == tenant_id, EstimateItem.estimate_id == estimate_id,
        EstimateItem.estimate_item_id == item_id))
    item = result.scalar_one_or_none()
    if not item: raise HTTPException(status_code=404, detail="Estimate item not found")
    await db.delete(item); await db.flush()
    from app.services.estimator.estimate_service import get_estimate as _get, _update_estimate_totals
    est = await _get(db, tenant_id, estimate_id)
    if est: await _update_estimate_totals(db, est)


@router.post("/cost-indices/seed", response_model=SeedResultOut)
async def seed_cost_indices_endpoint(db: AsyncSession = Depends(get_db)):
    """Seed cost index data from bundled CSV files."""
    from app.services.estimator.inflation_service import seed_cost_indices as _si, seed_index_mappings as _sm
    idx = await _si(db); maps = await _sm(db)
    return SeedResultOut(created=idx["created"]+maps["created"],
        message=f"Indices: {idx['created']}. Mappings: {maps['created']}.")


@router.post("/regional-factors/seed", response_model=SeedResultOut)
async def seed_regional_factors_endpoint(db: AsyncSession = Depends(get_db)):
    """Seed regional cost factors from bundled CSV."""
    from app.services.estimator.regional_service import seed_regional_factors as _seed
    r = await _seed(db)
    return SeedResultOut(created=r["created"], updated=r.get("updated", 0),
        message=f"{r['created']} created, {r.get('updated', 0)} updated.")


@router.get("/regional-factors", response_model=list[RegionalFactorOut])
async def get_regional_factors(db: AsyncSession = Depends(get_db)):
    """Get all state-level regional cost factors."""
    from app.services.estimator.regional_service import get_all_regional_factors as _get
    return [RegionalFactorOut.model_validate(f) for f in await _get(db)]
