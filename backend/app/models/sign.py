import uuid
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


class SignType(Base):
    """MUTCD sign type lookup table. Seeded from federal data, not tenant-specific."""

    __tablename__ = "sign_type"

    mutcd_code: Mapped[str] = mapped_column(String(20), primary_key=True)
    # regulatory, warning, guide, school, recreation, temporary, construction
    category: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(200), nullable=False)
    # Standard dimensions (inches)
    standard_width: Mapped[float | None] = mapped_column(Numeric(6, 2))
    standard_height: Mapped[float | None] = mapped_column(Numeric(6, 2))
    shape: Mapped[str | None] = mapped_column(String(30))
    background_color: Mapped[str | None] = mapped_column(String(30))
    legend_color: Mapped[str | None] = mapped_column(String(30))
    # Default sheeting and expected life
    default_sheeting_type: Mapped[str | None] = mapped_column(String(30))
    expected_life_years: Mapped[int | None] = mapped_column(SmallInteger)
    # Thumbnail image URL
    thumbnail_url: Mapped[str | None] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class SignSupport(Base, TenantMixin, TimestampMixin):
    """Physical post/support structure. One support can hold multiple signs."""

    __tablename__ = "sign_support"

    support_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # u_channel, square_tube, round_tube, wood, mast_arm, span_wire, bridge_mount
    support_type: Mapped[str] = mapped_column(String(30), nullable=False)
    support_material: Mapped[str | None] = mapped_column(String(30))
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )
    height_inches: Mapped[float | None] = mapped_column(Numeric(6, 2))
    # active, damaged, leaning, missing, removed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    notes: Mapped[str | None] = mapped_column(Text)
    # PostGIS point geometry — WGS84
    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="sign_supports")
    signs = relationship("Sign", back_populates="support")


class Sign(Base, TenantMixin, TimestampMixin):
    """Individual sign asset. Core entity for the Signs module."""

    __tablename__ = "sign"

    sign_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Link to support (optional — sign may not have support mapped yet)
    support_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sign_support.support_id")
    )
    # MUTCD code links to lookup table
    mutcd_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("sign_type.mutcd_code")
    )

    # --- Sign Details ---
    description: Mapped[str | None] = mapped_column(String(200))
    legend_text: Mapped[str | None] = mapped_column(String(100))
    # regulatory, warning, guide, school, recreation, temporary, construction
    sign_category: Mapped[str | None] = mapped_column(String(30))
    size_width_inches: Mapped[float | None] = mapped_column(Numeric(6, 2))
    size_height_inches: Mapped[float | None] = mapped_column(Numeric(6, 2))
    shape: Mapped[str | None] = mapped_column(String(30))
    background_color: Mapped[str | None] = mapped_column(String(30))
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )

    # --- Location ---
    road_name: Mapped[str | None] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(500))
    side_of_road: Mapped[str | None] = mapped_column(String(5))  # N, S, E, W
    intersection_with: Mapped[str | None] = mapped_column(String(200))
    location_notes: Mapped[str | None] = mapped_column(Text)

    # --- Retroreflectivity / MUTCD Compliance ---
    # Type I through XI
    sheeting_type: Mapped[str | None] = mapped_column(String(30))
    sheeting_manufacturer: Mapped[str | None] = mapped_column(String(100))
    expected_life_years: Mapped[int | None] = mapped_column(SmallInteger)
    install_date: Mapped[date | None] = mapped_column(Date)
    expected_replacement_date: Mapped[date | None] = mapped_column(Date)
    last_measured_date: Mapped[date | None] = mapped_column(Date)
    # Retroreflectivity reading in mcd/lux/m2
    measured_value: Mapped[float | None] = mapped_column(Numeric(8, 2))
    passes_minimum: Mapped[bool | None] = mapped_column()

    # --- Lifecycle ---
    last_inspected_date: Mapped[date | None] = mapped_column(Date)
    last_replaced_date: Mapped[date | None] = mapped_column(Date)
    replacement_cost_estimate: Mapped[float | None] = mapped_column(Numeric(10, 2))
    # active, damaged, faded, missing, obscured, replaced, removed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")

    # --- Facing / Orientation ---
    facing_direction: Mapped[int | None] = mapped_column(
        SmallInteger
    )  # Degrees 0-360
    mount_height_inches: Mapped[float | None] = mapped_column(Numeric(6, 2))
    offset_from_road_inches: Mapped[float | None] = mapped_column(Numeric(6, 2))

    # --- Flexible custom fields ---
    custom_fields: Mapped[dict | None] = mapped_column(JSONB)

    # --- Geometry ---
    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="signs")
    support = relationship("SignSupport", back_populates="signs")
    sign_type = relationship("SignType")
    work_orders = relationship("WorkOrder", back_populates="sign")
    inspections = relationship("Inspection", back_populates="sign")
