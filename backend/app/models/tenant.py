import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Tenant(Base):
    __tablename__ = "tenant"

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    subdomain: Mapped[str] = mapped_column(String(63), unique=True, nullable=False)
    # Clerk organization ID — links this tenant to a Clerk org for auth
    clerk_org_id: Mapped[str | None] = mapped_column(String(200), unique=True)
    # municipality, contractor, utility_district, county, consulting_firm
    tenant_type: Mapped[str] = mapped_column(
        String(30), nullable=False, default="municipality"
    )
    # "shared" | "schema" | "dedicated"
    isolation_model: Mapped[str] = mapped_column(
        String(20), nullable=False, default="shared"
    )
    # Which modules are enabled: ["signs", "water", "sewer", "estimator"]
    modules_enabled: Mapped[dict] = mapped_column(JSONB, default=list)
    # Contact info
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(254))
    contact_phone: Mapped[str | None] = mapped_column(String(20))
    # Address
    address: Mapped[str | None] = mapped_column(String(500))
    city: Mapped[str | None] = mapped_column(String(100))
    state: Mapped[str | None] = mapped_column(String(2))
    zip_code: Mapped[str | None] = mapped_column(String(10))
    # Subscription
    population: Mapped[int | None] = mapped_column()
    subscription_tier: Mapped[str] = mapped_column(
        String(20), nullable=False, default="starter"
    )
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    users = relationship("AppUser", back_populates="tenant")
    signs = relationship("Sign", back_populates="tenant")
    sign_supports = relationship("SignSupport", back_populates="tenant")
    work_orders = relationship("WorkOrder", back_populates="tenant")
    inspections = relationship("Inspection", back_populates="tenant")
    # Water module
    water_mains = relationship("WaterMain", back_populates="tenant")
    water_valves = relationship("WaterValve", back_populates="tenant")
    hydrants = relationship("FireHydrant", back_populates="tenant")
    # Sewer module
    manholes = relationship("Manhole", back_populates="tenant")
    sewer_mains = relationship("SewerMain", back_populates="tenant")
    force_mains = relationship("ForceMain", back_populates="tenant")
    lift_stations = relationship("LiftStation", back_populates="tenant")
    sewer_laterals = relationship("SewerLateral", back_populates="tenant")
