import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.user import AppUser

router = APIRouter()


# Placeholder — full user management comes with auth provider integration
@router.get("")
async def list_users(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List users for current tenant."""
    result = await db.execute(
        select(AppUser)
        .where(AppUser.tenant_id == tenant_id, AppUser.is_active == True)
        .order_by(AppUser.name)
    )
    users = result.scalars().all()
    return [
        {
            "user_id": u.user_id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
        }
        for u in users
    ]
