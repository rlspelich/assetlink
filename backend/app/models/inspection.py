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


class Inspection(Base, TenantMixin, TimestampMixin):
    """
    Inspection / condition assessment record.

    Shared across all asset types. For signs, this captures condition rating,
    retroreflectivity readings, and visual observations.
    """

    __tablename__ = "inspection"

    inspection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Human-readable number: INS-YYYYMMDD-NNN (per tenant per day)
    inspection_number: Mapped[str | None] = mapped_column(String(30), index=True)

    # --- Asset Link (polymorphic) ---
    asset_type: Mapped[str | None] = mapped_column(String(30), index=True)
    asset_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), index=True)
    sign_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sign.sign_id")
    )

    # --- Link to work order (if inspection was part of scheduled work) ---
    work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("work_order.work_order_id")
    )

    # --- Inspection Details ---
    # sign_condition, sign_retroreflectivity, hydrant_flow_test, etc.
    inspection_type: Mapped[str] = mapped_column(String(50), nullable=False)
    inspection_date: Mapped[date] = mapped_column(Date, nullable=False)
    inspector_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("app_user.user_id")
    )
    # open, in_progress, completed, cancelled
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="completed"
    )
    # Overall condition: 1 (critical) to 5 (excellent)
    condition_rating: Mapped[int | None] = mapped_column(SmallInteger)

    # --- Findings ---
    findings: Mapped[str | None] = mapped_column(Text)
    # Structured defect list: [{"type": "faded", "severity": "moderate", ...}]
    defects: Mapped[dict | None] = mapped_column(JSONB)
    recommendations: Mapped[str | None] = mapped_column(Text)
    repairs_made: Mapped[str | None] = mapped_column(Text)

    # --- Sign-specific fields ---
    # Retroreflectivity measurement (mcd/lux/m2)
    retroreflectivity_value: Mapped[float | None] = mapped_column(Numeric(8, 2))
    passes_minimum_retro: Mapped[bool | None] = mapped_column()

    # --- Follow-up ---
    follow_up_required: Mapped[bool] = mapped_column(default=False, nullable=False)
    follow_up_work_order_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True)
    )

    # --- Location snapshot ---
    geometry: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326)
    )

    # --- Custom fields ---
    custom_fields: Mapped[dict | None] = mapped_column(JSONB)

    # Relationships
    tenant = relationship("Tenant", back_populates="inspections")
    sign = relationship("Sign", back_populates="inspections")
    inspector = relationship("AppUser", foreign_keys=[inspector_id])
    work_order = relationship("WorkOrder")
    # Multi-asset junction — the preferred way to link assets to inspections
    assets = relationship(
        "InspectionAsset",
        back_populates="inspection",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
