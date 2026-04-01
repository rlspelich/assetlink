"""Shared helpers for contractor intelligence endpoints."""
import uuid

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contractor import Contractor


async def _get_contractor(db: AsyncSession, contractor_pk: uuid.UUID) -> Contractor:
    result = await db.execute(
        select(Contractor).where(Contractor.contractor_pk == contractor_pk)
    )
    contractor = result.scalar_one_or_none()
    if not contractor:
        raise HTTPException(status_code=404, detail="Contractor not found")
    return contractor
