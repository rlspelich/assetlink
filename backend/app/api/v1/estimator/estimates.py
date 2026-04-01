"""Estimate CRUD, items management, bulk import, and engineer's report."""
import csv
import io
import uuid
from datetime import date as dt
from decimal import Decimal

from fastapi import APIRouter, Body, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.award_item import AwardItem as AwardItemModel
from app.schemas.estimator import (
    AwardPriceHistoryOut,
    AwardPricePoint,
    ConfidenceOut,
    EstimateCreate,
    EstimateDetailOut,
    EstimateItemCreate,
    EstimateItemOut,
    EstimateItemUpdate,
    EstimateListOut,
    EstimateOut,
    EstimateUpdate,
    PriceStatsOut,
)

router = APIRouter()


# ---------------------------------------------------------------------------
# Award price history, stats, confidence
# ---------------------------------------------------------------------------


@router.get("/award-items/{code}/price-history", response_model=AwardPriceHistoryOut)
async def get_award_price_history(
    code: str, db: AsyncSession = Depends(get_db),
    district: str | None = None, county: str | None = None,
    min_date: str | None = None, max_date: str | None = None,
    limit: int = Query(2000, ge=1, le=10000),
) -> AwardPriceHistoryOut:
    """Get price history for a pay item from the shared award data (1.4M rows)."""
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
) -> PriceStatsOut:
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
) -> ConfidenceOut:
    """Score a proposed unit price against historical distribution."""
    from app.services.estimator.pricing_engine import compute_confidence
    result = await compute_confidence(db, code, Decimal(str(unit_price)),
        district=district, years_back=years_back,
        adjust_inflation=adjust_inflation, target_year=target_year)
    return ConfidenceOut(**result)


# ---------------------------------------------------------------------------
# Estimate CRUD
# ---------------------------------------------------------------------------


@router.get("/estimates", response_model=EstimateListOut)
async def list_estimates_endpoint(
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=200),
) -> EstimateListOut:
    """List all estimates for the current tenant."""
    from app.services.estimator.estimate_service import list_estimates as _list
    estimates, total = await _list(db, tenant_id, page, page_size)
    return EstimateListOut(estimates=[EstimateOut.model_validate(e) for e in estimates],
        total=total, page=page, page_size=page_size)


@router.post("/estimates", response_model=EstimateOut, status_code=201)
async def create_estimate_endpoint(
    data: EstimateCreate, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> EstimateOut:
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
) -> EstimateDetailOut:
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
) -> EstimateOut:
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
) -> None:
    """Delete an estimate and all its items."""
    from app.services.estimator.estimate_service import get_estimate as _get
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    await db.delete(estimate); await db.flush()


@router.post("/estimates/{estimate_id}/duplicate", response_model=EstimateOut, status_code=201)
async def duplicate_estimate_endpoint(
    estimate_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> EstimateOut:
    """Duplicate an estimate with all its items."""
    from app.services.estimator.estimate_service import get_estimate as _get, duplicate_estimate as _dup
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    return EstimateOut.model_validate(await _dup(db, tenant_id, estimate))


@router.post("/estimates/{estimate_id}/recalculate", response_model=EstimateDetailOut)
async def recalculate_estimate_endpoint(
    estimate_id: uuid.UUID, tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> EstimateDetailOut:
    """Re-run the pricing engine on all items in an estimate."""
    from app.services.estimator.estimate_service import get_estimate as _get, recalculate_estimate as _recalc
    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate: raise HTTPException(status_code=404, detail="Estimate not found")
    estimate = await _recalc(db, estimate)
    return EstimateDetailOut(
        **{k: getattr(estimate, k) for k in EstimateOut.model_fields if hasattr(estimate, k)},
        items=[EstimateItemOut.model_validate(i) for i in estimate.items])


# ---------------------------------------------------------------------------
# Estimate items
# ---------------------------------------------------------------------------


@router.post("/estimates/{estimate_id}/items", response_model=list[EstimateItemOut], status_code=201)
async def add_estimate_items(
    estimate_id: uuid.UUID, items: list[EstimateItemCreate],
    tenant_id: uuid.UUID = Depends(get_current_tenant), db: AsyncSession = Depends(get_db),
) -> list[EstimateItemOut]:
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
) -> EstimateItemOut:
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
) -> None:
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


# ---------------------------------------------------------------------------
# Bulk import for estimate items
# ---------------------------------------------------------------------------


@router.post("/estimates/{estimate_id}/import-items", response_model=list[EstimateItemOut], status_code=201)
async def bulk_import_estimate_items(
    estimate_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    text_data: str | None = Body(None, description="Pasted tab/comma-separated item data"),
    file: UploadFile | None = File(None, description="CSV file upload"),
) -> list[EstimateItemOut]:
    """
    Bulk import items into an estimate from pasted text or CSV upload.

    Accepts tab-separated or comma-separated data with columns:
    pay_item_code, quantity [, description, unit]

    Auto-matches pay item codes to the catalog and prices from historical data.
    Returns the created items with auto-filled prices and confidence scores.
    """
    from app.services.estimator.estimate_service import get_estimate as _get, add_items_to_estimate

    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    # Get raw text from either paste or file upload
    raw = ""
    if file:
        content = await file.read()
        raw = content.decode("utf-8", errors="replace")
    elif text_data:
        raw = text_data
    else:
        raise HTTPException(status_code=400, detail="Provide text_data or file")

    raw = raw.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty input")

    # Detect delimiter
    delimiter = "\t" if "\t" in raw else ","

    # Parse rows
    reader = csv.reader(io.StringIO(raw), delimiter=delimiter)
    items_to_add = []
    errors = []

    for row_num, row in enumerate(reader, start=1):
        if not row or not row[0].strip():
            continue

        # Skip header rows
        first = row[0].strip().upper()
        if first in ("PAY ITEM", "CODE", "ITEM", "PAY_ITEM_CODE", "PAYITEM", "#"):
            continue

        try:
            code = row[0].strip()
            qty = float(row[1].strip().replace(",", "")) if len(row) > 1 and row[1].strip() else 1.0
            desc = row[2].strip() if len(row) > 2 else ""
            unit = row[3].strip() if len(row) > 3 else ""

            items_to_add.append({
                "pay_item_code": code,
                "quantity": qty,
                "description": desc,
                "unit": unit,
            })
        except (ValueError, IndexError) as e:
            errors.append(f"Row {row_num}: {e}")

    if not items_to_add:
        raise HTTPException(status_code=400, detail=f"No valid items found. Errors: {errors[:5]}")

    created = await add_items_to_estimate(db, tenant_id, estimate, items_to_add)
    return [EstimateItemOut.model_validate(i) for i in created]


# ---------------------------------------------------------------------------
# Engineer's estimate report
# ---------------------------------------------------------------------------


@router.get("/estimates/{estimate_id}/engineers-report")
async def get_engineers_estimate_report(
    estimate_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    format: str = Query("txt", description="Report format: txt or csv"),
    contingency_pct: float = Query(0, ge=0, le=50, description="Contingency percentage to add"),
) -> PlainTextResponse:
    """
    Generate an Engineer's Estimate report.

    TXT format: Formatted report with header, line items, subtotals, contingency.
    CSV format: Tabular data ready for Excel with all pricing details.
    """
    from app.services.estimator.estimate_service import get_estimate as _get

    estimate = await _get(db, tenant_id, estimate_id)
    if not estimate:
        raise HTTPException(status_code=404, detail="Estimate not found")

    items = sorted(estimate.items, key=lambda x: x.sort_order)
    total = sum(i.extension for i in items)
    contingency_amt = total * Decimal(str(contingency_pct / 100)) if contingency_pct > 0 else Decimal("0")
    grand_total = total + contingency_amt

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "Pay Item Code", "Description", "Unit", "Quantity",
            "Unit Price", "Price Source", "Extension",
            "Confidence", "Data Points", "P25", "P50", "P75",
        ])
        for item in items:
            writer.writerow([
                item.pay_item_code,
                item.description,
                item.unit,
                f"{item.quantity:.3f}",
                f"{item.unit_price:.4f}",
                item.unit_price_source,
                f"{item.extension:.2f}",
                item.confidence_label or "",
                item.price_count,
                f"{item.price_p25:.4f}" if item.price_p25 else "",
                f"{item.price_p50:.4f}" if item.price_p50 else "",
                f"{item.price_p75:.4f}" if item.price_p75 else "",
            ])

        # Subtotal and contingency rows
        writer.writerow([])
        writer.writerow(["", "", "", "", "", "SUBTOTAL", f"{total:.2f}"])
        if contingency_pct > 0:
            writer.writerow(["", "", "", "", "", f"CONTINGENCY ({contingency_pct:.0f}%)", f"{contingency_amt:.2f}"])
            writer.writerow(["", "", "", "", "", "GRAND TOTAL", f"{grand_total:.2f}"])

        return PlainTextResponse(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="engineers_estimate_{estimate.name.replace(" ", "_")}.csv"'},
        )

    else:  # txt format
        lines = []
        lines.append("=" * 90)
        lines.append("ENGINEER'S ESTIMATE")
        lines.append("=" * 90)
        lines.append(f"Project:    {estimate.name}")
        if estimate.description:
            lines.append(f"Desc:       {estimate.description}")
        lines.append(f"Date:       {dt.today().isoformat()}")
        lines.append(f"State:      {estimate.target_state}")
        if estimate.target_district:
            lines.append(f"District:   {estimate.target_district}")
        lines.append(f"Inflation:  {'Adjusted' if estimate.use_inflation_adjustment else 'Nominal'}")
        if estimate.target_year:
            lines.append(f"Base Year:  {estimate.target_year}")
        lines.append(f"Items:      {len(items)}")
        lines.append("")
        lines.append(f"{'Code':<12} {'Description':<40} {'Unit':<6} {'Quantity':>10} {'Unit Price':>12} {'Extension':>14} {'Conf':>6} {'Basis'}")
        lines.append("-" * 120)

        for item in items:
            basis = f"{item.price_count} awards" if item.unit_price_source == "computed" and item.price_count > 0 else item.unit_price_source
            conf = item.confidence_label or ""
            lines.append(
                f"{item.pay_item_code:<12} "
                f"{item.description[:40]:<40} "
                f"{item.unit:<6} "
                f"{item.quantity:>10,.3f} "
                f"{item.unit_price:>12,.4f} "
                f"{item.extension:>14,.2f} "
                f"{conf:>6} "
                f"{basis}"
            )

        lines.append("-" * 120)
        lines.append(f"{'':>82} SUBTOTAL: {total:>14,.2f}")
        if contingency_pct > 0:
            lines.append(f"{'':>72} CONTINGENCY ({contingency_pct:.0f}%): {contingency_amt:>14,.2f}")
            lines.append(f"{'':>78} GRAND TOTAL: {grand_total:>14,.2f}")
        lines.append("")
        lines.append(f"Confidence Range: ${float(estimate.confidence_low or 0):,.2f} — ${float(estimate.confidence_high or 0):,.2f} (P25–P75)")
        lines.append("")
        lines.append("Pricing Methodology:")
        lines.append(f"  Source:    IDOT historical award data ({estimate.target_state})")
        lines.append(f"  Method:   Recency-weighted average with FHWA NHCCI inflation adjustment")
        lines.append(f"  Data:     1.4M+ awarded prices, 2003–2026")
        lines.append(f"  Generated by AssetLink Estimator")
        lines.append("=" * 90)

        return PlainTextResponse(
            content="\n".join(lines),
            media_type="text/plain",
            headers={"Content-Disposition": f'attachment; filename="engineers_estimate_{estimate.name.replace(" ", "_")}.txt"'},
        )
