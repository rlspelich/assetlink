"""
Estimate CRUD and pricing service.

Manages estimate lifecycle: create, add items, recalculate pricing,
duplicate, and delete. Integrates with the pricing engine for
auto-fill unit prices and confidence scoring.
"""
from __future__ import annotations

import uuid
from decimal import Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.estimate import Estimate, EstimateItem
from app.services.estimator.pricing_engine import compute_price_stats, compute_confidence
from app.services.estimator.regional_service import get_regional_factor


async def create_estimate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    name: str,
    description: str = "",
    target_state: str = "IL",
    target_district: str = "",
    use_inflation_adjustment: bool = True,
    target_year: int | None = None,
) -> Estimate:
    """Create a new empty estimate."""
    estimate = Estimate(
        tenant_id=tenant_id,
        name=name,
        description=description,
        target_state=target_state,
        target_district=target_district,
        use_inflation_adjustment=use_inflation_adjustment,
        target_year=target_year,
    )
    db.add(estimate)
    await db.flush()
    return estimate


async def get_estimate(
    db: AsyncSession, tenant_id: uuid.UUID, estimate_id: uuid.UUID
) -> Estimate | None:
    """Get an estimate with all its items."""
    result = await db.execute(
        select(Estimate)
        .options(selectinload(Estimate.items))
        .where(
            Estimate.tenant_id == tenant_id,
            Estimate.estimate_id == estimate_id,
        )
    )
    return result.scalar_one_or_none()


async def list_estimates(
    db: AsyncSession, tenant_id: uuid.UUID,
    page: int = 1, page_size: int = 50,
) -> tuple[list[Estimate], int]:
    """List estimates for a tenant, paginated."""
    query = select(Estimate).where(Estimate.tenant_id == tenant_id)
    count = (await db.execute(
        select(func.count()).select_from(query.subquery())
    )).scalar() or 0

    query = query.order_by(Estimate.updated_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), count


async def add_items_to_estimate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    estimate: Estimate,
    items: list[dict],
) -> list[EstimateItem]:
    """
    Add items to an estimate and auto-price them.

    Each item dict should have: pay_item_code, quantity, description (optional), unit (optional)
    """
    created_items = []

    # Get current max sort_order
    max_order = 0
    if estimate.items:
        max_order = max(i.sort_order for i in estimate.items)

    for i, item_data in enumerate(items):
        code = item_data["pay_item_code"]
        quantity = Decimal(str(item_data["quantity"]))

        # Get price stats from historical data (inflation-adjusted, no regional —
        # regional is applied separately below so unit_price shows the base rate)
        stats = await compute_price_stats(
            db,
            pay_item_code=code,
            district=estimate.target_district or None,
            adjust_inflation=estimate.use_inflation_adjustment,
            target_year=estimate.target_year,
            target_state="IL",  # base rate — regional applied separately below
        )

        # Use weighted average as the auto-fill price
        unit_price = stats.weighted_avg if stats.data_points > 0 else Decimal("0")

        # Regional adjustment
        regional_factor = await get_regional_factor(db, estimate.target_state)
        regional_price = round(unit_price * regional_factor, 4) if estimate.target_state != "IL" else unit_price

        # Compute extension
        extension = round(quantity * regional_price, 2)

        # Confidence scoring
        confidence = await compute_confidence(
            db, code, unit_price,
            district=estimate.target_district or None,
            adjust_inflation=estimate.use_inflation_adjustment,
            target_year=estimate.target_year,
        )

        estimate_item = EstimateItem(
            tenant_id=tenant_id,
            estimate_id=estimate.estimate_id,
            pay_item_code=code,
            description=item_data.get("description") or stats.description,
            unit=item_data.get("unit") or stats.unit,
            quantity=quantity,
            unit_price=unit_price,
            unit_price_source="computed" if stats.data_points > 0 else "manual",
            adjusted_unit_price=unit_price,  # Already adjusted if inflation is on
            regional_unit_price=regional_price,
            extension=extension,
            confidence_pct=confidence.get("percentile"),
            confidence_label=confidence.get("label"),
            price_p25=stats.p25,
            price_p50=stats.p50,
            price_p75=stats.p75,
            price_count=stats.data_points,
            sort_order=max_order + i + 1,
        )
        db.add(estimate_item)
        created_items.append(estimate_item)

    await db.flush()

    # Update estimate totals
    await _update_estimate_totals(db, estimate)

    return created_items


async def recalculate_estimate(
    db: AsyncSession, estimate: Estimate
) -> Estimate:
    """Re-run pricing engine on all items and update totals."""
    regional_factor = await get_regional_factor(db, estimate.target_state)

    for item in estimate.items:
        stats = await compute_price_stats(
            db,
            pay_item_code=item.pay_item_code,
            district=estimate.target_district or None,
            adjust_inflation=estimate.use_inflation_adjustment,
            target_year=estimate.target_year,
            target_state="IL",  # base rate — regional applied separately below
        )

        # Only update auto-priced items (not manual overrides)
        if item.unit_price_source == "computed":
            item.unit_price = stats.weighted_avg if stats.data_points > 0 else item.unit_price
            item.adjusted_unit_price = item.unit_price

        # Always update regional price and extension
        item.regional_unit_price = round(item.unit_price * regional_factor, 4) if estimate.target_state != "IL" else item.unit_price
        item.extension = round(item.quantity * (item.regional_unit_price or item.unit_price), 2)

        # Update confidence
        confidence = await compute_confidence(
            db, item.pay_item_code, item.unit_price,
            district=estimate.target_district or None,
            adjust_inflation=estimate.use_inflation_adjustment,
            target_year=estimate.target_year,
        )
        item.confidence_pct = confidence.get("percentile")
        item.confidence_label = confidence.get("label")
        item.price_p25 = stats.p25
        item.price_p50 = stats.p50
        item.price_p75 = stats.p75
        item.price_count = stats.data_points

    await db.flush()
    await _update_estimate_totals(db, estimate)
    return estimate


async def duplicate_estimate(
    db: AsyncSession, tenant_id: uuid.UUID, estimate: Estimate
) -> Estimate:
    """Create a copy of an estimate with all its items."""
    new_estimate = Estimate(
        tenant_id=tenant_id,
        name=f"{estimate.name} (Copy)",
        description=estimate.description,
        status="draft",
        target_state=estimate.target_state,
        target_district=estimate.target_district,
        use_inflation_adjustment=estimate.use_inflation_adjustment,
        target_year=estimate.target_year,
    )
    db.add(new_estimate)
    await db.flush()

    for item in estimate.items:
        new_item = EstimateItem(
            tenant_id=tenant_id,
            estimate_id=new_estimate.estimate_id,
            pay_item_code=item.pay_item_code,
            description=item.description,
            unit=item.unit,
            quantity=item.quantity,
            unit_price=item.unit_price,
            unit_price_source=item.unit_price_source,
            adjusted_unit_price=item.adjusted_unit_price,
            regional_unit_price=item.regional_unit_price,
            extension=item.extension,
            confidence_pct=item.confidence_pct,
            confidence_label=item.confidence_label,
            price_p25=item.price_p25,
            price_p50=item.price_p50,
            price_p75=item.price_p75,
            price_count=item.price_count,
            sort_order=item.sort_order,
        )
        db.add(new_item)

    await db.flush()
    await _update_estimate_totals(db, new_estimate)

    # Re-fetch to ensure all attributes are loaded (avoids lazy load errors)
    return await get_estimate(db, tenant_id, new_estimate.estimate_id)


async def _update_estimate_totals(db: AsyncSession, estimate: Estimate):
    """Recalculate and update estimate-level totals from items."""
    # Query items directly to ensure we get the latest state
    result = await db.execute(
        select(EstimateItem)
        .where(EstimateItem.estimate_id == estimate.estimate_id)
    )
    items = list(result.scalars().all())

    estimate.item_count = len(items)

    if items:
        estimate.total_nominal = round(sum(
            i.quantity * i.unit_price for i in items
        ), 2)
        estimate.total_adjusted = round(sum(
            i.quantity * (i.adjusted_unit_price or i.unit_price) for i in items
        ), 2)
        estimate.total_with_regional = round(sum(i.extension for i in items), 2)

        # Confidence range from p25/p75
        low = sum(
            i.quantity * (i.price_p25 or i.unit_price) for i in items
        )
        high = sum(
            i.quantity * (i.price_p75 or i.unit_price) for i in items
        )
        estimate.confidence_low = round(low, 2)
        estimate.confidence_high = round(high, 2)
    else:
        estimate.total_nominal = Decimal("0")
        estimate.total_adjusted = Decimal("0")
        estimate.total_with_regional = Decimal("0")
        estimate.confidence_low = None
        estimate.confidence_high = None

    await db.flush()
