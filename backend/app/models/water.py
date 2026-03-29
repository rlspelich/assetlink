"""
Water distribution system models.

Assets: water_main (LineString), water_valve (Point), fire_hydrant (Point),
water_service (Point/Line), water_fitting (Point), pressure_zone (Polygon).

Reference tables: water_material_type, water_valve_type.
"""
import uuid
from datetime import date
from decimal import Decimal

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin


# ---------------------------------------------------------------------------
# Reference Tables (no tenant_id)
# ---------------------------------------------------------------------------


class WaterMaterialType(Base):
    """Pipe/fitting material lookup. Seeded reference data."""

    __tablename__ = "water_material_type"

    code: Mapped[str] = mapped_column(String(20), primary_key=True)
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    expected_life_years: Mapped[int | None] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class WaterValveType(Base):
    """Valve type lookup with exercise standards."""

    __tablename__ = "water_valve_type"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    exercise_interval_days: Mapped[int | None] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ---------------------------------------------------------------------------
# Pressure Zone
# ---------------------------------------------------------------------------


class PressureZone(Base, TenantMixin, TimestampMixin):
    """Water pressure zone boundary."""

    __tablename__ = "pressure_zone"
    __table_args__ = (
        UniqueConstraint("tenant_id", "zone_name", name="uq_pressure_zone_name"),
    )

    pressure_zone_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    zone_name: Mapped[str] = mapped_column(String(100), nullable=False)
    zone_number: Mapped[str | None] = mapped_column(String(20))
    target_pressure_min_psi: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    target_pressure_max_psi: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    description: Mapped[str | None] = mapped_column(String(500))

    geometry: Mapped[str | None] = mapped_column(
        Geometry(geometry_type="POLYGON", srid=4326), nullable=True
    )


# ---------------------------------------------------------------------------
# Water Main (LineString)
# ---------------------------------------------------------------------------


class WaterMain(Base, TenantMixin, TimestampMixin):
    """Water distribution main — pipe segment."""

    __tablename__ = "water_main"

    water_main_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(String(200))

    # Material / Physical
    material_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("water_material_type.code")
    )
    diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    length_feet: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    pressure_class: Mapped[str | None] = mapped_column(String(30))
    shape: Mapped[str | None] = mapped_column(String(20))

    # Lining
    lining_type: Mapped[str | None] = mapped_column(String(30))
    lining_date: Mapped[date | None] = mapped_column(Date)

    # Burial
    depth_feet: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    soil_type: Mapped[str | None] = mapped_column(String(30))

    # Ownership
    owner: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    maintained_by: Mapped[str | None] = mapped_column(String(100))

    # Status / Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)
    expected_life_years: Mapped[int | None] = mapped_column(SmallInteger)
    replacement_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    # Flow / Pressure
    flow_direction: Mapped[str | None] = mapped_column(String(20))
    pressure_zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pressure_zone.pressure_zone_id")
    )

    # Network topology
    upstream_node_type: Mapped[str | None] = mapped_column(String(30))
    upstream_node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    downstream_node_type: Mapped[str | None] = mapped_column(String(30))
    downstream_node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))

    # History
    break_count: Mapped[int] = mapped_column(Integer, default=0)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="water_mains")
    material_type = relationship("WaterMaterialType")
    pressure_zone = relationship("PressureZone")


# ---------------------------------------------------------------------------
# Water Valve (Point)
# ---------------------------------------------------------------------------


class WaterValve(Base, TenantMixin, TimestampMixin):
    """Water distribution valve."""

    __tablename__ = "water_valve"

    water_valve_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(String(200))

    # Type / Physical
    valve_type_code: Mapped[str | None] = mapped_column(
        String(30), ForeignKey("water_valve_type.code")
    )
    size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    manufacturer: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    material: Mapped[str | None] = mapped_column(String(30))

    # Operation
    turns_to_close: Mapped[int | None] = mapped_column(SmallInteger)
    turn_direction: Mapped[str | None] = mapped_column(String(3))  # CW, CCW
    normal_position: Mapped[str] = mapped_column(String(10), nullable=False, default="open")
    current_position: Mapped[str | None] = mapped_column(String(10))
    is_operable: Mapped[str | None] = mapped_column(String(10))
    is_critical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Installation
    installation_type: Mapped[str | None] = mapped_column(String(20))  # vault, buried, above_ground
    depth_feet: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )

    # Exercise tracking
    last_exercised_date: Mapped[date | None] = mapped_column(Date)
    exercise_interval_days: Mapped[int | None] = mapped_column(SmallInteger)

    # Network
    pressure_zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pressure_zone.pressure_zone_id")
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="water_valves")
    valve_type = relationship("WaterValveType")
    pressure_zone = relationship("PressureZone")


class WaterValveMain(Base, TenantMixin):
    """Junction: which mains a valve is associated with."""

    __tablename__ = "water_valve_main"
    __table_args__ = (
        UniqueConstraint("water_valve_id", "water_main_id", name="uq_valve_main"),
    )

    water_valve_main_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    water_valve_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("water_valve.water_valve_id", ondelete="CASCADE"),
        nullable=False,
    )
    water_main_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("water_main.water_main_id", ondelete="CASCADE"),
        nullable=False,
    )
    position_on_main: Mapped[str | None] = mapped_column(String(20))  # inline, branch, end


# ---------------------------------------------------------------------------
# Fire Hydrant (Point)
# ---------------------------------------------------------------------------


class FireHydrant(Base, TenantMixin, TimestampMixin):
    """Fire hydrant asset."""

    __tablename__ = "fire_hydrant"

    hydrant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(String(200))

    # Manufacturer
    make: Mapped[str | None] = mapped_column(String(100))
    model: Mapped[str | None] = mapped_column(String(100))
    year_manufactured: Mapped[int | None] = mapped_column(SmallInteger)

    # Type
    barrel_type: Mapped[str | None] = mapped_column(String(20))  # wet, dry
    nozzle_count: Mapped[int | None] = mapped_column(SmallInteger)
    nozzle_sizes: Mapped[str | None] = mapped_column(String(50))  # e.g. "2.5,2.5,4.5"

    # Flow test data (most recent)
    flow_test_date: Mapped[date | None] = mapped_column(Date)
    static_pressure_psi: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    residual_pressure_psi: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    pitot_pressure_psi: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    flow_gpm: Mapped[Decimal | None] = mapped_column(Numeric(8, 2))

    # NFPA/ISO color coding
    flow_class_color: Mapped[str | None] = mapped_column(String(20))

    # Flushing
    last_flush_date: Mapped[date | None] = mapped_column(Date)
    flush_interval_days: Mapped[int | None] = mapped_column(SmallInteger)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    out_of_service_reason: Mapped[str | None] = mapped_column(String(200))
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )
    ownership: Mapped[str] = mapped_column(String(20), nullable=False, default="public")

    # Connection
    auxiliary_valve_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("water_valve.water_valve_id", ondelete="SET NULL")
    )
    lateral_size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    main_size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    connected_main_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("water_main.water_main_id", ondelete="SET NULL")
    )

    # Network
    pressure_zone_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("pressure_zone.pressure_zone_id")
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="hydrants")
    auxiliary_valve = relationship("WaterValve")
    connected_main = relationship("WaterMain")
    pressure_zone = relationship("PressureZone")


# ---------------------------------------------------------------------------
# Water Service Connection
# ---------------------------------------------------------------------------


class WaterService(Base, TenantMixin, TimestampMixin):
    """Water service connection (tap to meter)."""

    __tablename__ = "water_service"

    water_service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)

    # Type
    service_type: Mapped[str] = mapped_column(String(20), nullable=False)  # domestic, commercial, industrial, irrigation, fire

    # Meter
    meter_number: Mapped[str | None] = mapped_column(String(50), index=True)
    meter_size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    meter_type: Mapped[str | None] = mapped_column(String(30))

    # Service line
    service_line_material: Mapped[str | None] = mapped_column(String(20))
    service_line_size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Tap
    tap_main_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("water_main.water_main_id", ondelete="SET NULL")
    )

    # Location / Account
    address: Mapped[str | None] = mapped_column(String(500))
    account_number: Mapped[str | None] = mapped_column(String(50), index=True)
    curb_stop_location: Mapped[str | None] = mapped_column(String(200))

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    # Point or short LineString
    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False
    )

    # Relationships
    tap_main = relationship("WaterMain")


# ---------------------------------------------------------------------------
# Water Fitting (Point)
# ---------------------------------------------------------------------------


class WaterFitting(Base, TenantMixin, TimestampMixin):
    """Water system fitting (tee, cross, reducer, etc.)."""

    __tablename__ = "water_fitting"

    water_fitting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)

    fitting_type: Mapped[str] = mapped_column(String(20), nullable=False)
    material_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("water_material_type.code")
    )
    primary_size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    secondary_size_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    material_type = relationship("WaterMaterialType")
