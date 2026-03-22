"""
Email endpoints for sending work orders and inspections to recipients.

When SMTP is configured (SMTP_HOST env var), emails are sent immediately.
When SMTP is not configured, emails are logged and the generated HTML is
returned for preview.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.inspection import Inspection
from app.models.inspection_asset import InspectionAsset
from app.models.sign import Sign, SignSupport, SignType
from app.models.work_order import WorkOrder
from app.models.work_order_asset import WorkOrderAsset
from app.schemas.email import EmailRequest, EmailResponse
from app.services.email_html import (
    generate_inspection_email_html,
    generate_work_order_email_html,
)
from app.services.email_service import send_email

router = APIRouter()


# --- Shared helpers for asset label population ---


async def _build_asset_labels(
    asset_list: list, db: AsyncSession
) -> dict[uuid.UUID, str]:
    """Build asset_label lookup dict for a list of WorkOrderAsset or InspectionAsset."""
    if not asset_list:
        return {}

    sign_ids = [a.asset_id for a in asset_list if a.asset_type == "sign"]
    support_ids = [a.asset_id for a in asset_list if a.asset_type == "sign_support"]

    labels: dict[uuid.UUID, str] = {}

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
            select(SignSupport.support_id, SignSupport.support_type).where(
                SignSupport.support_id.in_(support_ids)
            )
        )
        for row in result.all():
            labels[row.support_id] = row.support_type.replace("_", " ").title() + " Support"

    return labels


# --- Endpoints ---


@router.post("/work-order/{wo_id}", response_model=EmailResponse)
async def email_work_order(
    wo_id: uuid.UUID,
    body: EmailRequest,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Send a work order via email. Returns preview HTML when SMTP is not configured."""
    result = await db.execute(
        select(WorkOrder)
        .options(selectinload(WorkOrder.assets))
        .where(WorkOrder.work_order_id == wo_id, WorkOrder.tenant_id == tenant_id)
    )
    wo = result.scalar_one_or_none()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")

    # Build asset labels
    assets = list(wo.assets) if wo.assets else []
    labels = await _build_asset_labels(assets, db)

    subject, html_body = generate_work_order_email_html(
        wo, assets, labels, custom_message=body.message
    )

    status = send_email(
        to=body.to,
        subject=subject,
        html_body=html_body,
        cc=body.cc,
    )

    return EmailResponse(
        status=status,
        subject=subject,
        preview_html=html_body if status == "preview" else None,
    )


@router.post("/inspection/{insp_id}", response_model=EmailResponse)
async def email_inspection(
    insp_id: uuid.UUID,
    body: EmailRequest,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Send an inspection via email. Returns preview HTML when SMTP is not configured."""
    result = await db.execute(
        select(Inspection)
        .options(selectinload(Inspection.assets))
        .where(
            Inspection.inspection_id == insp_id,
            Inspection.tenant_id == tenant_id,
        )
    )
    insp = result.scalar_one_or_none()
    if not insp:
        raise HTTPException(status_code=404, detail="Inspection not found")

    # Build asset labels
    assets = list(insp.assets) if insp.assets else []
    labels = await _build_asset_labels(assets, db)

    subject, html_body = generate_inspection_email_html(
        insp, assets, labels, custom_message=body.message
    )

    status = send_email(
        to=body.to,
        subject=subject,
        html_body=html_body,
        cc=body.cc,
    )

    return EmailResponse(
        status=status,
        subject=subject,
        preview_html=html_body if status == "preview" else None,
    )
