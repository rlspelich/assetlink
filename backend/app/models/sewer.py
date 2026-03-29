"""
Sewer collection system models.

Assets: sewer_main (LineString), force_main (LineString), manhole (Point),
lift_station (Point), sewer_lateral (Point/Line), sewer_fitting (Point).

Reference tables: sewer_material_type, sewer_pipe_shape, manhole_type.

Junction tables: manhole_pipe (connects pipes to manholes with invert elevations).

Design principle: minimum viable record = geometry + tenant. Everything else
is nullable and earned over time as the municipality builds its program.
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


class SewerMaterialType(Base):
    """Pipe material lookup. Seeded reference data.
    VCP, PVC, RCP, HDPE, DIP, CMP, brick, concrete, etc."""

    __tablename__ = "sewer_material_type"

    code: Mapped[str] = mapped_column(String(20), primary_key=True)
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    expected_life_years: Mapped[int | None] = mapped_column(SmallInteger)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class SewerPipeShape(Base):
    """Pipe cross-section shape lookup.
    Circular, egg, horseshoe, arch, box/rectangular, elliptical."""

    __tablename__ = "sewer_pipe_shape"

    code: Mapped[str] = mapped_column(String(20), primary_key=True)
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ManholeType(Base):
    """Manhole construction type lookup.
    Precast, brick, block, fiberglass, polymer, poured-in-place."""

    __tablename__ = "manhole_type"

    code: Mapped[str] = mapped_column(String(30), primary_key=True)
    description: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


# ---------------------------------------------------------------------------
# Manhole (Point)
# ---------------------------------------------------------------------------


class Manhole(Base, TenantMixin, TimestampMixin):
    """Sewer manhole / access structure."""

    __tablename__ = "manhole"

    manhole_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(String(200))

    # Type / Construction
    manhole_type_code: Mapped[str | None] = mapped_column(
        String(30), ForeignKey("manhole_type.code")
    )
    material: Mapped[str | None] = mapped_column(String(30))
    diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Elevations
    rim_elevation_ft: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    invert_elevation_ft: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    depth_ft: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Cover / Frame
    cover_type: Mapped[str | None] = mapped_column(String(30))  # standard, watertight, bolted
    cover_diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    frame_type: Mapped[str | None] = mapped_column(String(30))
    has_steps: Mapped[bool | None] = mapped_column(Boolean)
    step_material: Mapped[str | None] = mapped_column(String(30))

    # Chimney / Cone
    cone_type: Mapped[str | None] = mapped_column(String(20))  # eccentric, concentric, flat_top
    chimney_height_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Channel / Bench
    channel_type: Mapped[str | None] = mapped_column(String(20))  # formed, half_pipe, none
    bench_type: Mapped[str | None] = mapped_column(String(20))  # sloped, flat, none

    # System classification
    system_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="sanitary"
    )  # sanitary, storm, combined

    # NASSCO MACP
    macp_grade: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("macp_grade BETWEEN 1 AND 5")
    )
    macp_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    last_macp_date: Mapped[date | None] = mapped_column(Date)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="manholes")
    manhole_type_ref = relationship("ManholeType")
    pipe_connections = relationship("ManholePipe", back_populates="manhole")


# ---------------------------------------------------------------------------
# Sewer Main — Gravity (LineString)
# ---------------------------------------------------------------------------


class SewerMain(Base, TenantMixin, TimestampMixin):
    """Gravity sewer main segment. Flows from upstream to downstream manhole."""

    __tablename__ = "sewer_main"

    sewer_main_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(String(200))

    # Material / Physical
    material_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("sewer_material_type.code")
    )
    shape_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("sewer_pipe_shape.code")
    )
    diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    height_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))  # for non-circular
    width_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))   # for non-circular
    length_feet: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # Lining / Rehab
    lining_type: Mapped[str | None] = mapped_column(String(30))  # CIPP, slip_line, fold_and_form, spray
    lining_date: Mapped[date | None] = mapped_column(Date)
    lining_thickness_mm: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Burial
    depth_ft_upstream: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    depth_ft_downstream: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Hydraulics
    slope_pct: Mapped[Decimal | None] = mapped_column(Numeric(8, 4))
    upstream_invert_ft: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))
    downstream_invert_ft: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))

    # Network topology — manhole connections
    upstream_manhole_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manhole.manhole_id", ondelete="SET NULL")
    )
    downstream_manhole_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manhole.manhole_id", ondelete="SET NULL")
    )

    # System classification
    system_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="sanitary"
    )  # sanitary, storm, combined

    # Ownership
    owner: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    maintained_by: Mapped[str | None] = mapped_column(String(100))

    # NASSCO PACP
    pacp_grade: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("pacp_grade BETWEEN 1 AND 5")
    )
    pacp_structural_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    pacp_om_score: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    last_pacp_date: Mapped[date | None] = mapped_column(Date)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )
    expected_life_years: Mapped[int | None] = mapped_column(SmallInteger)
    replacement_cost: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="sewer_mains")
    material_type = relationship("SewerMaterialType")
    pipe_shape = relationship("SewerPipeShape")
    upstream_manhole = relationship("Manhole", foreign_keys=[upstream_manhole_id])
    downstream_manhole = relationship("Manhole", foreign_keys=[downstream_manhole_id])


# ---------------------------------------------------------------------------
# Force Main — Pressurized (LineString)
# ---------------------------------------------------------------------------


class ForceMain(Base, TenantMixin, TimestampMixin):
    """Pressurized sewer force main — different inspection/maintenance regime than gravity."""

    __tablename__ = "force_main"

    force_main_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    description: Mapped[str | None] = mapped_column(String(200))

    # Material / Physical
    material_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("sewer_material_type.code")
    )
    diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    length_feet: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    pressure_class: Mapped[str | None] = mapped_column(String(30))

    # Burial
    depth_feet: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Network
    lift_station_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("lift_station.lift_station_id", ondelete="SET NULL")
    )
    discharge_manhole_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("manhole.manhole_id", ondelete="SET NULL")
    )

    # Cathodic protection (common for metallic force mains)
    has_cathodic_protection: Mapped[bool | None] = mapped_column(Boolean)
    cp_test_date: Mapped[date | None] = mapped_column(Date)

    # Air release valves on force mains
    arv_count: Mapped[int | None] = mapped_column(SmallInteger)

    # Ownership
    owner: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    maintained_by: Mapped[str | None] = mapped_column(String(100))

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="LINESTRING", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="force_mains")
    material_type = relationship("SewerMaterialType")
    lift_station = relationship("LiftStation", back_populates="force_mains")
    discharge_manhole = relationship("Manhole", foreign_keys=[discharge_manhole_id])


# ---------------------------------------------------------------------------
# Lift Station / Pump Station (Point)
# ---------------------------------------------------------------------------


class LiftStation(Base, TenantMixin, TimestampMixin):
    """Sewer lift station / pump station."""

    __tablename__ = "lift_station"

    lift_station_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)
    station_name: Mapped[str | None] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(200))

    # Wet Well
    wet_well_depth_ft: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    wet_well_diameter_ft: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    wet_well_material: Mapped[str | None] = mapped_column(String(30))

    # Pumps
    pump_count: Mapped[int | None] = mapped_column(SmallInteger)
    pump_type: Mapped[str | None] = mapped_column(String(30))  # submersible, dry_pit, suction_lift
    pump_hp: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    firm_capacity_gpm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    design_capacity_gpm: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))

    # Controls
    control_type: Mapped[str | None] = mapped_column(String(30))  # float, transducer, bubbler
    has_scada: Mapped[bool | None] = mapped_column(Boolean)
    has_backup_power: Mapped[bool | None] = mapped_column(Boolean)
    backup_power_type: Mapped[str | None] = mapped_column(String(30))  # generator, portable, none
    has_alarm: Mapped[bool | None] = mapped_column(Boolean)
    alarm_type: Mapped[str | None] = mapped_column(String(30))  # dialer, scada, light, audible

    # Electrical
    electrical_service: Mapped[str | None] = mapped_column(String(30))  # single_phase, three_phase
    voltage: Mapped[int | None] = mapped_column(SmallInteger)

    # Ownership
    owner: Mapped[str] = mapped_column(String(20), nullable=False, default="public")
    maintained_by: Mapped[str | None] = mapped_column(String(100))

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)
    condition_rating: Mapped[int | None] = mapped_column(
        SmallInteger, CheckConstraint("condition_rating BETWEEN 1 AND 5")
    )

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="POINT", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="lift_stations")
    force_mains = relationship("ForceMain", back_populates="lift_station")


# ---------------------------------------------------------------------------
# Sewer Lateral / Service Connection
# ---------------------------------------------------------------------------


class SewerLateral(Base, TenantMixin, TimestampMixin):
    """Sewer service lateral — connection from building to main."""

    __tablename__ = "sewer_lateral"

    sewer_lateral_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)

    # Type
    service_type: Mapped[str | None] = mapped_column(
        String(20)
    )  # residential, commercial, industrial

    # Material / Physical
    material_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("sewer_material_type.code")
    )
    diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))
    length_feet: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    depth_at_main_ft: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Connection
    connected_main_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sewer_main.sewer_main_id", ondelete="SET NULL")
    )
    tap_location: Mapped[str | None] = mapped_column(String(30))  # top, side, saddle
    has_cleanout: Mapped[bool | None] = mapped_column(Boolean)
    cleanout_location: Mapped[str | None] = mapped_column(String(200))

    # Location / Account
    address: Mapped[str | None] = mapped_column(String(500))
    account_number: Mapped[str | None] = mapped_column(String(50), index=True)

    # Lifecycle
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    install_date: Mapped[date | None] = mapped_column(Date)

    custom_fields: Mapped[dict | None] = mapped_column(JSONB)
    notes: Mapped[str | None] = mapped_column(Text)

    # Point (cleanout/tap location) or short LineString (lateral route if known)
    geometry: Mapped[str] = mapped_column(
        Geometry(geometry_type="GEOMETRY", srid=4326), nullable=False
    )

    # Relationships
    tenant = relationship("Tenant", back_populates="sewer_laterals")
    material_type = relationship("SewerMaterialType")
    connected_main = relationship("SewerMain")


# ---------------------------------------------------------------------------
# Sewer Fitting (Point)
# ---------------------------------------------------------------------------


class SewerFitting(Base, TenantMixin, TimestampMixin):
    """Sewer system fitting — wye, tee, bend, cleanout, etc."""

    __tablename__ = "sewer_fitting"

    sewer_fitting_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    asset_tag: Mapped[str | None] = mapped_column(String(50), index=True)

    fitting_type: Mapped[str] = mapped_column(String(20), nullable=False)
    material_code: Mapped[str | None] = mapped_column(
        String(20), ForeignKey("sewer_material_type.code")
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

    # Relationships
    material_type = relationship("SewerMaterialType")


# ---------------------------------------------------------------------------
# Manhole-Pipe Junction (network connectivity with invert elevations)
# ---------------------------------------------------------------------------


class ManholePipe(Base, TenantMixin):
    """Junction: which pipes connect to a manhole, with invert elevation at that manhole.
    Critical for hydraulic profile and surcharge analysis."""

    __tablename__ = "manhole_pipe"
    __table_args__ = (
        UniqueConstraint(
            "manhole_id", "pipe_type", "pipe_id", name="uq_manhole_pipe"
        ),
    )

    manhole_pipe_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    manhole_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("manhole.manhole_id", ondelete="CASCADE"),
        nullable=False,
    )
    # Polymorphic: "sewer_main" or "force_main"
    pipe_type: Mapped[str] = mapped_column(String(20), nullable=False)
    pipe_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    # Direction relative to manhole
    direction: Mapped[str | None] = mapped_column(String(10))  # in, out

    # Invert elevation at this manhole
    invert_elevation_ft: Mapped[Decimal | None] = mapped_column(Numeric(10, 3))

    # Clock position (for MACP reference)
    clock_position: Mapped[str | None] = mapped_column(String(10))  # 12, 3, 6, 9, etc.

    # Pipe size at connection
    pipe_diameter_inches: Mapped[Decimal | None] = mapped_column(Numeric(6, 2))

    # Relationships
    manhole = relationship("Manhole", back_populates="pipe_connections")
