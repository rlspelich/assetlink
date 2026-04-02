"""
Converter/serializer functions for ORM objects → Pydantic response schemas.

Centralizes all ORM-to-schema conversions that were previously scattered
across route files (signs.py, supports.py, work_orders.py, inspections.py).
"""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.inspection import Inspection
from app.models.inspection_asset import InspectionAsset
from app.models.sign import Sign, SignSupport, SignType
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.inspection import InspectionAssetOut, InspectionOut
from app.schemas.sign import SignOut
from app.schemas.support import SignSupportOut
from app.schemas.work_order import WorkOrderOut
from app.schemas.work_order_asset import WorkOrderAssetOut


# ---------------------------------------------------------------------------
# Sign converters
# ---------------------------------------------------------------------------


def sign_to_out(
    sign: Sign,
    lon: float,
    lat: float,
    support_type: str | None = None,
    support_status: str | None = None,
) -> SignOut:
    """Convert a Sign ORM object to the response schema."""
    return SignOut(
        sign_id=sign.sign_id,
        tenant_id=sign.tenant_id,
        support_id=sign.support_id,
        mutcd_code=sign.mutcd_code,
        description=sign.description,
        legend_text=sign.legend_text,
        sign_category=sign.sign_category,
        size_width_inches=sign.size_width_inches,
        size_height_inches=sign.size_height_inches,
        shape=sign.shape,
        background_color=sign.background_color,
        condition_rating=sign.condition_rating,
        road_name=sign.road_name,
        address=sign.address,
        side_of_road=sign.side_of_road,
        intersection_with=sign.intersection_with,
        location_notes=sign.location_notes,
        sheeting_type=sign.sheeting_type,
        sheeting_manufacturer=sign.sheeting_manufacturer,
        expected_life_years=sign.expected_life_years,
        install_date=sign.install_date,
        expected_replacement_date=sign.expected_replacement_date,
        last_measured_date=sign.last_measured_date,
        measured_value=sign.measured_value,
        passes_minimum=sign.passes_minimum,
        last_inspected_date=sign.last_inspected_date,
        last_replaced_date=sign.last_replaced_date,
        replacement_cost_estimate=sign.replacement_cost_estimate,
        status=sign.status,
        facing_direction=sign.facing_direction,
        mount_height_inches=sign.mount_height_inches,
        offset_from_road_inches=sign.offset_from_road_inches,
        custom_fields=sign.custom_fields,
        longitude=lon,
        latitude=lat,
        support_type=support_type,
        support_status=support_status,
        created_at=sign.created_at,
        updated_at=sign.updated_at,
    )


# ---------------------------------------------------------------------------
# Sign support converters
# ---------------------------------------------------------------------------


def support_to_out(
    support: SignSupport, lon: float, lat: float, sign_count: int = 0
) -> SignSupportOut:
    """Convert a SignSupport ORM object to the response schema."""
    return SignSupportOut(
        support_id=support.support_id,
        tenant_id=support.tenant_id,
        support_type=support.support_type,
        support_material=support.support_material,
        install_date=support.install_date,
        condition_rating=support.condition_rating,
        height_inches=float(support.height_inches) if support.height_inches is not None else None,
        status=support.status,
        notes=support.notes,
        longitude=lon,
        latitude=lat,
        sign_count=sign_count,
        created_at=support.created_at,
        updated_at=support.updated_at,
    )


# ---------------------------------------------------------------------------
# Work order converters
# ---------------------------------------------------------------------------


async def populate_wo_asset_labels(
    woa_list: list[WorkOrderAsset], db: AsyncSession
) -> dict[uuid.UUID, str]:
    """
    Build asset_label for each WorkOrderAsset.

    Signs: "R1-1 — Stop Sign" (mutcd_code — sign_type description)
    Supports: "U Channel Support" (support_type formatted)
    """
    labels: dict[uuid.UUID, str] = {}
    if not woa_list:
        return labels

    sign_ids = [woa.asset_id for woa in woa_list if woa.asset_type == "sign"]
    support_ids = [woa.asset_id for woa in woa_list if woa.asset_type == "sign_support"]

    # Fetch sign labels
    if sign_ids:
        result = await db.execute(
            select(Sign.sign_id, Sign.mutcd_code, SignType.description)
            .outerjoin(SignType, Sign.mutcd_code == SignType.mutcd_code)
            .where(Sign.sign_id.in_(sign_ids))
        )
        for row in result.all():
            if row.mutcd_code and row.description:
                labels[row.sign_id] = f"{row.mutcd_code} \u2014 {row.description}"
            elif row.mutcd_code:
                labels[row.sign_id] = row.mutcd_code
            else:
                labels[row.sign_id] = "Sign (no MUTCD code)"

    # Fetch support labels
    if support_ids:
        result = await db.execute(
            select(SignSupport.support_id, SignSupport.support_type)
            .where(SignSupport.support_id.in_(support_ids))
        )
        for row in result.all():
            # Format: "U Channel Support" from "u_channel"
            label = row.support_type.replace("_", " ").title() + " Support"
            labels[row.support_id] = label

    return labels


def woa_to_out(woa: WorkOrderAsset, label: str | None = None) -> WorkOrderAssetOut:
    """Convert a WorkOrderAsset ORM object to the response schema."""
    return WorkOrderAssetOut(
        work_order_asset_id=woa.work_order_asset_id,
        work_order_id=woa.work_order_id,
        tenant_id=woa.tenant_id,
        asset_type=woa.asset_type,
        asset_id=woa.asset_id,
        damage_notes=woa.damage_notes,
        action_required=woa.action_required,
        resolution=woa.resolution,
        status=woa.status,
        asset_label=label,
        created_at=woa.created_at,
        updated_at=woa.updated_at,
    )


async def wo_to_out(
    wo: WorkOrder,
    db: AsyncSession,
    lon: float | None = None,
    lat: float | None = None,
) -> WorkOrderOut:
    """Convert a WorkOrder ORM object to WorkOrderOut, including asset labels."""
    assets_out = []
    if wo.assets:
        labels = await populate_wo_asset_labels(wo.assets, db)
        assets_out = [
            woa_to_out(woa, labels.get(woa.asset_id))
            for woa in wo.assets
        ]

    return WorkOrderOut(
        work_order_id=wo.work_order_id,
        tenant_id=wo.tenant_id,
        work_order_number=wo.work_order_number,
        asset_type=wo.asset_type,
        asset_id=wo.asset_id,
        sign_id=wo.sign_id,
        description=wo.description,
        work_type=wo.work_type,
        priority=wo.priority,
        status=wo.status,
        category=wo.category,
        resolution=wo.resolution,
        assigned_to=wo.assigned_to,
        supervisor_id=wo.supervisor_id,
        requested_by=wo.requested_by,
        due_date=wo.due_date,
        projected_start_date=wo.projected_start_date,
        projected_finish_date=wo.projected_finish_date,
        actual_start_date=wo.actual_start_date,
        actual_finish_date=wo.actual_finish_date,
        completed_date=wo.completed_date,
        closed_date=wo.closed_date,
        address=wo.address,
        location_notes=wo.location_notes,
        longitude=lon,
        latitude=lat,
        labor_hours=wo.labor_hours,
        labor_cost=wo.labor_cost,
        material_cost=wo.material_cost,
        equipment_cost=wo.equipment_cost,
        total_cost=wo.total_cost,
        instructions=wo.instructions,
        notes=wo.notes,
        materials_used=wo.materials_used,
        custom_fields=wo.custom_fields,
        assets=assets_out,
        created_at=wo.created_at,
        updated_at=wo.updated_at,
    )


# ---------------------------------------------------------------------------
# Inspection converters
# ---------------------------------------------------------------------------


async def populate_inspection_asset_labels(
    ia_list: list[InspectionAsset], db: AsyncSession
) -> dict[uuid.UUID, str]:
    """
    Build asset_label for each InspectionAsset.

    Signs: "R1-1 — Stop Sign" (mutcd_code — sign_type description)
    Supports: "U Channel Support" (support_type formatted)
    """
    labels: dict[uuid.UUID, str] = {}
    if not ia_list:
        return labels

    sign_ids = [ia.asset_id for ia in ia_list if ia.asset_type == "sign"]
    support_ids = [ia.asset_id for ia in ia_list if ia.asset_type == "sign_support"]

    if sign_ids:
        result = await db.execute(
            select(Sign.sign_id, Sign.mutcd_code, SignType.description)
            .outerjoin(SignType, Sign.mutcd_code == SignType.mutcd_code)
            .where(Sign.sign_id.in_(sign_ids))
        )
        for row in result.all():
            if row.mutcd_code and row.description:
                labels[row.sign_id] = f"{row.mutcd_code} \u2014 {row.description}"
            elif row.mutcd_code:
                labels[row.sign_id] = row.mutcd_code
            else:
                labels[row.sign_id] = "Sign (no MUTCD code)"

    if support_ids:
        result = await db.execute(
            select(SignSupport.support_id, SignSupport.support_type)
            .where(SignSupport.support_id.in_(support_ids))
        )
        for row in result.all():
            label = row.support_type.replace("_", " ").title() + " Support"
            labels[row.support_id] = label

    return labels


def ia_to_out(ia: InspectionAsset, label: str | None = None) -> InspectionAssetOut:
    """Convert an InspectionAsset ORM object to the response schema."""
    return InspectionAssetOut(
        inspection_asset_id=ia.inspection_asset_id,
        inspection_id=ia.inspection_id,
        tenant_id=ia.tenant_id,
        asset_type=ia.asset_type,
        asset_id=ia.asset_id,
        condition_rating=ia.condition_rating,
        findings=ia.findings,
        defects=ia.defects,
        retroreflectivity_value=float(ia.retroreflectivity_value) if ia.retroreflectivity_value is not None else None,
        passes_minimum_retro=ia.passes_minimum_retro,
        action_recommended=ia.action_recommended,
        status=ia.status,
        asset_label=label,
        created_at=ia.created_at,
        updated_at=ia.updated_at,
    )


async def inspection_to_out(
    insp: Inspection,
    db: AsyncSession,
    lon: float | None = None,
    lat: float | None = None,
) -> InspectionOut:
    """Convert an Inspection ORM object to InspectionOut, including asset labels."""
    assets_out = []
    if insp.assets:
        labels = await populate_inspection_asset_labels(insp.assets, db)
        assets_out = [
            ia_to_out(ia, labels.get(ia.asset_id))
            for ia in insp.assets
        ]

    return InspectionOut(
        inspection_id=insp.inspection_id,
        tenant_id=insp.tenant_id,
        asset_type=insp.asset_type,
        asset_id=insp.asset_id,
        sign_id=insp.sign_id,
        work_order_id=insp.work_order_id,
        inspection_type=insp.inspection_type,
        inspection_date=insp.inspection_date,
        inspector_id=insp.inspector_id,
        status=insp.status,
        condition_rating=insp.condition_rating,
        findings=insp.findings,
        defects=insp.defects,
        recommendations=insp.recommendations,
        repairs_made=insp.repairs_made,
        retroreflectivity_value=float(insp.retroreflectivity_value) if insp.retroreflectivity_value is not None else None,
        passes_minimum_retro=insp.passes_minimum_retro,
        follow_up_required=insp.follow_up_required,
        follow_up_work_order_id=insp.follow_up_work_order_id,
        custom_fields=insp.custom_fields,
        longitude=lon,
        latitude=lat,
        assets=assets_out,
        created_at=insp.created_at,
        updated_at=insp.updated_at,
    )
