import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.user import AppUser
from app.schemas.user import UserCreate, UserListOut, UserOut, UserUpdate

router = APIRouter()


@router.get("", response_model=UserListOut)
async def list_users(
    role: str | None = Query(None, description="Filter by role"),
    is_active: bool | None = Query(None, description="Filter by active status"),
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> UserListOut:
    """List users for current tenant, filterable by role and active status."""
    filters = [AppUser.tenant_id == tenant_id]
    if role is not None:
        filters.append(AppUser.role == role)
    if is_active is not None:
        filters.append(AppUser.is_active == is_active)

    # Count
    count_q = select(func.count()).select_from(AppUser).where(*filters)
    total = (await db.execute(count_q)).scalar() or 0

    # Fetch
    q = (
        select(AppUser)
        .where(*filters)
        .order_by(AppUser.last_name, AppUser.first_name)
    )
    result = await db.execute(q)
    users = result.scalars().all()

    return UserListOut(
        users=[UserOut.model_validate(u) for u in users],
        total=total,
    )


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    data: UserCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Create a new user for the current tenant."""
    # Check email uniqueness within tenant
    existing = await db.execute(
        select(AppUser).where(
            AppUser.tenant_id == tenant_id,
            AppUser.email == data.email,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"A user with email '{data.email}' already exists in this organization",
        )

    # Check employee_id uniqueness within tenant (if provided)
    if data.employee_id:
        existing_emp = await db.execute(
            select(AppUser).where(
                AppUser.tenant_id == tenant_id,
                AppUser.employee_id == data.employee_id,
            )
        )
        if existing_emp.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"A user with employee ID '{data.employee_id}' already exists in this organization",
            )

    user = AppUser(
        tenant_id=tenant_id,
        first_name=data.first_name,
        last_name=data.last_name,
        name=f"{data.first_name} {data.last_name}",
        email=data.email,
        role=data.role,
        employee_id=data.employee_id,
        phone=data.phone,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    audit_log("create", "user", entity_id=user.user_id, tenant_id=tenant_id, details=f"role={data.role} email={data.email}")
    return UserOut.model_validate(user)


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Get a single user by ID."""
    result = await db.execute(
        select(AppUser).where(
            AppUser.user_id == user_id,
            AppUser.tenant_id == tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut.model_validate(user)


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: uuid.UUID,
    data: UserUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Update a user."""
    result = await db.execute(
        select(AppUser).where(
            AppUser.user_id == user_id,
            AppUser.tenant_id == tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_unset=True)
    old_role = user.role

    # Check email uniqueness if email is being changed
    if "email" in update_data and update_data["email"] != user.email:
        existing = await db.execute(
            select(AppUser).where(
                AppUser.tenant_id == tenant_id,
                AppUser.email == update_data["email"],
                AppUser.user_id != user_id,
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"A user with email '{update_data['email']}' already exists in this organization",
            )

    # Check employee_id uniqueness if being changed
    if "employee_id" in update_data and update_data["employee_id"]:
        existing_emp = await db.execute(
            select(AppUser).where(
                AppUser.tenant_id == tenant_id,
                AppUser.employee_id == update_data["employee_id"],
                AppUser.user_id != user_id,
            )
        )
        if existing_emp.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"A user with employee ID '{update_data['employee_id']}' already exists in this organization",
            )

    for field, value in update_data.items():
        setattr(user, field, value)

    # Keep name in sync
    user.name = f"{user.first_name} {user.last_name}"

    await db.commit()
    await db.refresh(user)
    if "role" in update_data and update_data["role"] != old_role:
        audit_log("role_change", "user", entity_id=user_id, tenant_id=tenant_id, details=f"{old_role}->{user.role}")
    return UserOut.model_validate(user)


@router.delete("/{user_id}", response_model=UserOut)
async def delete_user(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Soft-delete a user (set is_active = false)."""
    result = await db.execute(
        select(AppUser).where(
            AppUser.user_id == user_id,
            AppUser.tenant_id == tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=400, detail="User is already inactive")

    user.is_active = False
    await db.commit()
    await db.refresh(user)
    audit_log("delete", "user", entity_id=user_id, tenant_id=tenant_id, details=f"soft_delete email={user.email}")
    return UserOut.model_validate(user)


@router.put("/{user_id}/reactivate", response_model=UserOut)
async def reactivate_user(
    user_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    """Reactivate a soft-deleted user."""
    result = await db.execute(
        select(AppUser).where(
            AppUser.user_id == user_id,
            AppUser.tenant_id == tenant_id,
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_active:
        raise HTTPException(status_code=400, detail="User is already active")

    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return UserOut.model_validate(user)
