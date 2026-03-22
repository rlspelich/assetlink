import uuid
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class WorkOrder(Base, TenantMixin, TimestampMixin):
    """
    Work order for maintenance activities.

    Shared across all asset types — signs, water, sewer.
    The asset_type + asset_id fields polymorphically link to any asset.
    """

    __tablename__ = "work_order"

    work_order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Human-readable sequential number (per tenant)
    work_order_number: Mapped[str | None] = mapped_column(
        String(30), unique=True, index=True
    )

    # --- Asset Link (polymorphic) --- DEPRECATED: use work_order_asset junction table ---
    # Kept for backward compatibility. New code should use the `assets` relationship.
    # sign, water_pipe, water_valve, hydrant, sewer_pipe, manhole, lift_station
    asset_type: Mapped[str | None] = mapped_column(String(30), index=True)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    # Direct FK for signs (Phase 1) — DEPRECATED: use work_order_asset instead
    sign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sign.sign_id")
    )

    # --- Classification ---
    description: Mapped[str | None] = mapped_column(String(500))
    # inspection, repair, replacement, installation, flushing, painting, other
    work_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # emergency, urgent, routine, planned
    priority: Mapped[str] = mapped_column(
        String(20), nullable=False, default="routine"
    )
    # open, assigned, in_progress, on_hold, completed, cancelled
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    category: Mapped[str | None] = mapped_column(String(50))
    resolution: Mapped[str | None] = mapped_column(String(200))

    # --- People ---
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.user_id")
    )
    supervisor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.user_id")
    )
    requested_by: Mapped[str | None] = mapped_column(String(200))

    # --- Dates ---
    due_date: Mapped[date | None] = mapped_column(Date)
    projected_start_date: Mapped[date | None] = mapped_column(Date)
    projected_finish_date: Mapped[date | None] = mapped_column(Date)
    actual_start_date: Mapped[date | None] = mapped_column(Date)
    actual_finish_date: Mapped[date | None] = mapped_column(Date)
    completed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # --- Location ---
    address: Mapped[str | None] = mapped_column(String(500))
    location_notes: Mapped[str | None] = mapped_column(Text)
    geometry: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326)
    )

    # --- Cost Tracking (basic for MVP) ---
    labor_hours: Mapped[float | None] = mapped_column(Numeric(8, 2))
    labor_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    material_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    equipment_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))
    total_cost: Mapped[float | None] = mapped_column(Numeric(10, 2))

    # --- Notes ---
    instructions: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    # --- Materials used (flexible) ---
    materials_used: Mapped[dict | None] = mapped_column(JSONB)

    # --- Custom fields ---
    custom_fields: Mapped[dict | None] = mapped_column(JSONB)

    # Relationships
    tenant = relationship("Tenant", back_populates="work_orders")
    sign = relationship("Sign", back_populates="work_orders")  # DEPRECATED: use assets
    assignee = relationship("AppUser", foreign_keys=[assigned_to])
    supervisor = relationship("AppUser", foreign_keys=[supervisor_id])
    # Multi-asset junction — the preferred way to link assets to work orders
    assets = relationship(
        "WorkOrderAsset",
        back_populates="work_order",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
