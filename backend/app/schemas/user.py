import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, EmailStr, Field, computed_field


class UserRole(StrEnum):
    ADMIN = "admin"
    SUPERVISOR = "supervisor"
    CREW_CHIEF = "crew_chief"


class UserCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    role: UserRole = UserRole.CREW_CHIEF
    employee_id: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=20)


class UserUpdate(BaseModel):
    first_name: str | None = Field(None, min_length=1, max_length=100)
    last_name: str | None = Field(None, min_length=1, max_length=100)
    email: EmailStr | None = None
    role: UserRole | None = None
    employee_id: str | None = Field(None, max_length=50)
    phone: str | None = Field(None, max_length=20)
    is_active: bool | None = None


class UserOut(BaseModel):
    user_id: uuid.UUID
    tenant_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    role: str
    employee_id: str | None = None
    phone: str | None = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"

    model_config = {"from_attributes": True}


class UserListOut(BaseModel):
    users: list[UserOut]
    total: int
