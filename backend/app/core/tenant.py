"""
Multi-tenant resolution.

How tenant context is resolved (in priority order):

1. Clerk JWT org claim (production) — the org_id from the JWT's `o.id` field
   maps to a tenant via the `clerk_org_id` column on the tenant table.
2. X-Tenant-ID header (development) — direct UUID of the tenant.

When Clerk auth is configured, the tenant is resolved from the JWT's organization
claim. The X-Tenant-ID header is ignored in production.
"""

import uuid

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth import AuthContext, get_auth_context
from app.db.session import get_db


async def get_current_tenant(
    auth: AuthContext = Depends(get_auth_context),
    x_tenant_id: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> uuid.UUID:
    """
    Resolve the current tenant ID from auth context or header.

    Returns a validated tenant UUID that can be used to filter queries.
    """
    # --- Production: resolve tenant from Clerk org ---
    if settings.clerk_jwks_url and auth.clerk_org_id:
        # Look up tenant by clerk_org_id
        from app.models.tenant import Tenant

        result = await db.execute(
            select(Tenant.tenant_id).where(
                Tenant.clerk_org_id == auth.clerk_org_id,
                Tenant.is_active == True,
            )
        )
        tenant_id = result.scalar_one_or_none()
        if not tenant_id:
            raise HTTPException(
                status_code=403,
                detail=f"No active tenant linked to organization {auth.clerk_org_id}",
            )
        return tenant_id

    # --- Development: resolve from X-Tenant-ID header ---
    if not x_tenant_id:
        raise HTTPException(
            status_code=400,
            detail="X-Tenant-ID header is required",
        )
    try:
        return uuid.UUID(x_tenant_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="X-Tenant-ID must be a valid UUID",
        )
