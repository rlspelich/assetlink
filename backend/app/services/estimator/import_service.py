"""
Bid data import service — saves parsed bid tab data to the database.

Handles IDOT bid tabs, IDOT awards, and ISTHA bid tabs.
All imports are tenant-scoped and use atomic transactions per file.
"""
from __future__ import annotations

import time
import uuid
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.award_item import AwardItem
from app.models.bid import Bid, BidItem
from app.models.contract import Contract
from app.models.contractor import Contractor
from app.services.estimator.parsers.idot_awards import ParsedAwards
from app.services.estimator.parsers.idot_bidtabs import (
    ParsedBidTab,
    calculate_bid_totals,
    calculate_rankings,
    identify_bad_bidders,
    build_name_to_id_map,
)
from app.services.estimator.parsers.istha_bidtabs import ParsedISTHA


async def import_idot_bidtab(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    parsed: ParsedBidTab,
    source_file: str = "",
) -> dict:
    """
    Save a parsed IDOT bid tab to the database.

    Upserts the contract (deletes existing bids to allow re-import),
    creates contractors (get-or-create), and bulk-creates bids + bid items.

    Returns a summary dict with counts.
    """
    header = parsed.header
    if not header.contract_number:
        return {"error": "No contract number found", "warnings": parsed.warnings}

    letting_date = header.letting_date.date() if header.letting_date else None
    if not letting_date:
        return {"error": "No letting date found", "warnings": parsed.warnings}

    # Upsert contract
    result = await db.execute(
        select(Contract).where(
            Contract.tenant_id == tenant_id,
            Contract.number == header.contract_number,
            Contract.agency == "IDOT",
        )
    )
    contract = result.scalar_one_or_none()
    contract_created = contract is None

    if contract is None:
        contract = Contract(
            tenant_id=tenant_id,
            number=header.contract_number,
            agency="IDOT",
        )
        db.add(contract)

    # Update contract fields
    contract.letting_date = letting_date
    contract.letting_type = header.letting_type
    contract.county = header.county
    contract.district = header.district
    contract.municipality = header.municipality
    contract.section_no = header.section_no
    contract.job_no = header.job_no
    contract.project_no = header.project_no
    contract.letting_no = header.letting_no
    contract.item_count = parsed.item_count
    contract.source_file = source_file

    await db.flush()  # Get contract_id

    # Delete existing bids for this contract (allows re-import)
    await db.execute(
        delete(Bid).where(
            Bid.tenant_id == tenant_id,
            Bid.contract_id == contract.contract_id,
        )
    )

    # Calculate totals, rankings, bad bidders
    totals = calculate_bid_totals(parsed.line_items)
    bad_bidders = identify_bad_bidders(parsed.line_items)
    rankings = calculate_rankings(totals, bad_bidders)
    name_to_id = build_name_to_id_map(parsed.line_items)
    summary_by_id = {s.contractor_id: s for s in parsed.summaries}

    # Create contractors and bids
    contractors_created = 0
    bids_created = 0
    bid_items_created = 0

    for contractor_name, calc_total in totals.items():
        cid = name_to_id.get(contractor_name, "")

        # Get or create contractor
        result = await db.execute(
            select(Contractor).where(
                Contractor.tenant_id == tenant_id,
                Contractor.contractor_id_code == cid,
                Contractor.name == contractor_name,
            )
        )
        contractor = result.scalar_one_or_none()
        if contractor is None:
            contractor = Contractor(
                tenant_id=tenant_id,
                contractor_id_code=cid,
                name=contractor_name,
            )
            db.add(contractor)
            await db.flush()
            contractors_created += 1

        # Get doc_total from summary
        summary = summary_by_id.get(cid)
        doc_total = summary.doc_total if summary else Decimal(0)

        # Create bid
        bid = Bid(
            tenant_id=tenant_id,
            contract_id=contract.contract_id,
            contractor_pk=contractor.contractor_pk,
            rank=rankings.get(contractor_name, 0),
            total=round(calc_total, 2),
            doc_total=doc_total,
            is_low=(summary.is_low if summary else False),
            is_bad=(contractor_name in bad_bidders),
            has_alt=(summary.has_alt if summary else False),
            no_omitted=(summary.no_omitted if summary else None),
        )
        db.add(bid)
        await db.flush()
        bids_created += 1

        # Create bid items for this contractor
        for line_item in parsed.line_items:
            for line_bid in line_item.bids:
                if line_bid.contractor_name == contractor_name:
                    bid_item = BidItem(
                        tenant_id=tenant_id,
                        bid_id=bid.bid_id,
                        pay_item_code=line_item.item_code,
                        abbreviation=line_item.abbreviation,
                        unit=line_item.unit,
                        quantity=line_item.quantity,
                        unit_price=line_bid.unit_price,
                        was_omitted=line_bid.was_omitted,
                    )
                    db.add(bid_item)
                    bid_items_created += 1

    await db.flush()

    return {
        "contract_number": header.contract_number,
        "contract_created": contract_created,
        "contractors_created": contractors_created,
        "bids_created": bids_created,
        "bid_items_created": bid_items_created,
        "warnings": parsed.warnings,
    }


async def import_idot_awards(
    db: AsyncSession,
    parsed: ParsedAwards,
) -> dict:
    """Save parsed IDOT award items to the database (reference table, no tenant)."""
    created = 0
    skipped = 0

    for item in parsed.items:
        # Check for existing (upsert by unique constraint)
        result = await db.execute(
            select(AwardItem).where(
                AwardItem.contract_number == item.contract_number,
                AwardItem.pay_item_code == item.pay_item_code,
                AwardItem.letting_date == item.letting_date,
                AwardItem.unit_price == item.unit_price,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            skipped += 1
            continue

        award = AwardItem(
            letting_date=item.letting_date,
            pay_item_code=item.pay_item_code,
            abbreviation=item.abbreviation,
            item_number=item.item_number,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            contract_number=item.contract_number,
            county=item.county,
            district=item.district,
            source_file=parsed.source_file,
        )
        db.add(award)
        created += 1

    await db.flush()

    return {
        "created": created,
        "skipped": skipped,
        "total": len(parsed.items),
        "warnings": parsed.warnings,
    }


async def import_istha_bidtabs(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    parsed: ParsedISTHA,
) -> dict:
    """
    Save parsed ISTHA bid data to the database.

    ISTHA records are flattened (one record = one pay item + one contractor),
    so we need to group them into contracts, contractors, bids, and bid items.
    """
    if not parsed.letting_date:
        return {"error": "No letting date found", "warnings": parsed.warnings}

    # Group records by contractor
    contractors_data: dict[str, list] = {}
    for record in parsed.records:
        key = record.contractor_name
        if key not in contractors_data:
            contractors_data[key] = []
        contractors_data[key].append(record)

    # Upsert contract
    contract_number = parsed.project_id
    result = await db.execute(
        select(Contract).where(
            Contract.tenant_id == tenant_id,
            Contract.number == contract_number,
            Contract.agency == "ISTHA",
        )
    )
    contract = result.scalar_one_or_none()
    contract_created = contract is None

    if contract is None:
        contract = Contract(
            tenant_id=tenant_id,
            number=contract_number,
            letting_date=parsed.letting_date,
            agency="ISTHA",
            item_count=parsed.item_count,
            source_file=parsed.source_file,
        )
        db.add(contract)
    else:
        contract.letting_date = parsed.letting_date
        contract.item_count = parsed.item_count
        contract.source_file = parsed.source_file

    await db.flush()

    # Delete existing bids for re-import
    await db.execute(
        delete(Bid).where(
            Bid.tenant_id == tenant_id,
            Bid.contract_id == contract.contract_id,
        )
    )

    contractors_created = 0
    bids_created = 0
    bid_items_created = 0

    for contractor_name, records in contractors_data.items():
        # Get or create contractor
        result = await db.execute(
            select(Contractor).where(
                Contractor.tenant_id == tenant_id,
                Contractor.name == contractor_name,
                Contractor.contractor_id_code == "",
            )
        )
        contractor = result.scalar_one_or_none()
        if contractor is None:
            contractor = Contractor(
                tenant_id=tenant_id,
                contractor_id_code="",
                name=contractor_name,
            )
            db.add(contractor)
            await db.flush()
            contractors_created += 1

        # Use first record for bid-level data
        first = records[0]
        bid = Bid(
            tenant_id=tenant_id,
            contract_id=contract.contract_id,
            contractor_pk=contractor.contractor_pk,
            rank=first.rank,
            total=first.bid_total,
            doc_total=first.doc_total,
            is_low=first.is_low,
            is_bad=False,
            has_alt=False,
            no_omitted=None,
        )
        db.add(bid)
        await db.flush()
        bids_created += 1

        # Create bid items
        for record in records:
            bid_item = BidItem(
                tenant_id=tenant_id,
                bid_id=bid.bid_id,
                pay_item_code=record.pay_item_code,
                abbreviation=record.abbreviation,
                unit=record.unit,
                quantity=record.quantity,
                unit_price=record.unit_price,
                was_omitted=False,
            )
            db.add(bid_item)
            bid_items_created += 1

    await db.flush()

    return {
        "contract_number": contract_number,
        "contract_created": contract_created,
        "contractors_created": contractors_created,
        "bids_created": bids_created,
        "bid_items_created": bid_items_created,
        "warnings": parsed.warnings,
    }
