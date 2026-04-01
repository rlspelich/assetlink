"""Shared geometry helpers and ORM-to-schema converters for sewer routes."""

from geoalchemy2.shape import to_shape

from app.models.sewer import (
    ForceMain,
    LiftStation,
    Manhole,
    SewerLateral,
    SewerMain,
)
from app.schemas.sewer import (
    ForceMainOut,
    LiftStationOut,
    ManholeOut,
    SewerLateralOut,
    SewerMainOut,
)


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def _coords_to_linestring_wkt(coordinates: list[list[float]]) -> str:
    """Convert [[lon, lat], ...] to WKT LINESTRING."""
    pairs = ", ".join(f"{c[0]} {c[1]}" for c in coordinates)
    return f"SRID=4326;LINESTRING({pairs})"


def _linestring_geom_to_coords(geom) -> list[list[float]] | None:
    """Convert a GeoAlchemy2 LineString geometry to [[lon, lat], ...]."""
    if geom is None:
        return None
    shape = to_shape(geom)
    return [[c[0], c[1]] for c in shape.coords]


def _point_geom_to_lonlat(geom) -> tuple[float, float] | None:
    """Convert a GeoAlchemy2 Point geometry to (lon, lat)."""
    if geom is None:
        return None
    shape = to_shape(geom)
    return (shape.x, shape.y)


# ---------------------------------------------------------------------------
# ORM → Schema converters
# ---------------------------------------------------------------------------


def _manhole_to_out(
    mh: Manhole, lon: float, lat: float, pipe_connection_count: int = 0
) -> ManholeOut:
    """Convert a Manhole ORM object to the response schema."""
    return ManholeOut(
        manhole_id=mh.manhole_id,
        tenant_id=mh.tenant_id,
        asset_tag=mh.asset_tag,
        description=mh.description,
        manhole_type_code=mh.manhole_type_code,
        material=mh.material,
        diameter_inches=mh.diameter_inches,
        rim_elevation_ft=mh.rim_elevation_ft,
        invert_elevation_ft=mh.invert_elevation_ft,
        depth_ft=mh.depth_ft,
        cover_type=mh.cover_type,
        cover_diameter_inches=mh.cover_diameter_inches,
        frame_type=mh.frame_type,
        has_steps=mh.has_steps,
        step_material=mh.step_material,
        cone_type=mh.cone_type,
        chimney_height_inches=mh.chimney_height_inches,
        channel_type=mh.channel_type,
        bench_type=mh.bench_type,
        system_type=mh.system_type,
        macp_grade=mh.macp_grade,
        macp_score=mh.macp_score,
        last_macp_date=mh.last_macp_date,
        status=mh.status,
        install_date=mh.install_date,
        condition_rating=mh.condition_rating,
        custom_fields=mh.custom_fields,
        notes=mh.notes,
        longitude=lon,
        latitude=lat,
        pipe_connection_count=pipe_connection_count,
        created_at=mh.created_at,
        updated_at=mh.updated_at,
    )


def _sewer_main_to_out(sm: SewerMain, coordinates: list[list[float]] | None) -> SewerMainOut:
    """Convert a SewerMain ORM object to the response schema."""
    return SewerMainOut(
        sewer_main_id=sm.sewer_main_id,
        tenant_id=sm.tenant_id,
        asset_tag=sm.asset_tag,
        description=sm.description,
        material_code=sm.material_code,
        shape_code=sm.shape_code,
        diameter_inches=sm.diameter_inches,
        height_inches=sm.height_inches,
        width_inches=sm.width_inches,
        length_feet=sm.length_feet,
        lining_type=sm.lining_type,
        lining_date=sm.lining_date,
        lining_thickness_mm=sm.lining_thickness_mm,
        depth_ft_upstream=sm.depth_ft_upstream,
        depth_ft_downstream=sm.depth_ft_downstream,
        slope_pct=sm.slope_pct,
        upstream_invert_ft=sm.upstream_invert_ft,
        downstream_invert_ft=sm.downstream_invert_ft,
        upstream_manhole_id=sm.upstream_manhole_id,
        downstream_manhole_id=sm.downstream_manhole_id,
        system_type=sm.system_type,
        owner=sm.owner,
        maintained_by=sm.maintained_by,
        pacp_grade=sm.pacp_grade,
        pacp_structural_score=sm.pacp_structural_score,
        pacp_om_score=sm.pacp_om_score,
        last_pacp_date=sm.last_pacp_date,
        status=sm.status,
        install_date=sm.install_date,
        condition_rating=sm.condition_rating,
        expected_life_years=sm.expected_life_years,
        replacement_cost=sm.replacement_cost,
        custom_fields=sm.custom_fields,
        notes=sm.notes,
        coordinates=coordinates,
        created_at=sm.created_at,
        updated_at=sm.updated_at,
    )


def _force_main_to_out(fm: ForceMain, coordinates: list[list[float]] | None) -> ForceMainOut:
    """Convert a ForceMain ORM object to the response schema."""
    return ForceMainOut(
        force_main_id=fm.force_main_id,
        tenant_id=fm.tenant_id,
        asset_tag=fm.asset_tag,
        description=fm.description,
        material_code=fm.material_code,
        diameter_inches=fm.diameter_inches,
        length_feet=fm.length_feet,
        pressure_class=fm.pressure_class,
        depth_feet=fm.depth_feet,
        lift_station_id=fm.lift_station_id,
        discharge_manhole_id=fm.discharge_manhole_id,
        has_cathodic_protection=fm.has_cathodic_protection,
        cp_test_date=fm.cp_test_date,
        arv_count=fm.arv_count,
        owner=fm.owner,
        maintained_by=fm.maintained_by,
        status=fm.status,
        install_date=fm.install_date,
        condition_rating=fm.condition_rating,
        custom_fields=fm.custom_fields,
        notes=fm.notes,
        coordinates=coordinates,
        created_at=fm.created_at,
        updated_at=fm.updated_at,
    )


def _lift_station_to_out(
    ls: LiftStation, lon: float, lat: float, force_main_count: int = 0
) -> LiftStationOut:
    """Convert a LiftStation ORM object to the response schema."""
    return LiftStationOut(
        lift_station_id=ls.lift_station_id,
        tenant_id=ls.tenant_id,
        asset_tag=ls.asset_tag,
        station_name=ls.station_name,
        description=ls.description,
        wet_well_depth_ft=ls.wet_well_depth_ft,
        wet_well_diameter_ft=ls.wet_well_diameter_ft,
        wet_well_material=ls.wet_well_material,
        pump_count=ls.pump_count,
        pump_type=ls.pump_type,
        pump_hp=ls.pump_hp,
        firm_capacity_gpm=ls.firm_capacity_gpm,
        design_capacity_gpm=ls.design_capacity_gpm,
        control_type=ls.control_type,
        has_scada=ls.has_scada,
        has_backup_power=ls.has_backup_power,
        backup_power_type=ls.backup_power_type,
        has_alarm=ls.has_alarm,
        alarm_type=ls.alarm_type,
        electrical_service=ls.electrical_service,
        voltage=ls.voltage,
        owner=ls.owner,
        maintained_by=ls.maintained_by,
        status=ls.status,
        install_date=ls.install_date,
        condition_rating=ls.condition_rating,
        custom_fields=ls.custom_fields,
        notes=ls.notes,
        longitude=lon,
        latitude=lat,
        force_main_count=force_main_count,
        created_at=ls.created_at,
        updated_at=ls.updated_at,
    )


def _sewer_lateral_to_out(sl: SewerLateral) -> SewerLateralOut:
    """Convert a SewerLateral ORM object to the response schema.

    SewerLateral geometry can be Point or LineString. We detect the type
    and populate the appropriate fields.
    """
    longitude = None
    latitude = None
    coordinates = None

    if sl.geometry is not None:
        shape = to_shape(sl.geometry)
        if shape.geom_type == "Point":
            longitude = shape.x
            latitude = shape.y
        elif shape.geom_type == "LineString":
            coordinates = [[c[0], c[1]] for c in shape.coords]

    return SewerLateralOut(
        sewer_lateral_id=sl.sewer_lateral_id,
        tenant_id=sl.tenant_id,
        asset_tag=sl.asset_tag,
        service_type=sl.service_type,
        material_code=sl.material_code,
        diameter_inches=sl.diameter_inches,
        length_feet=sl.length_feet,
        depth_at_main_ft=sl.depth_at_main_ft,
        connected_main_id=sl.connected_main_id,
        tap_location=sl.tap_location,
        has_cleanout=sl.has_cleanout,
        cleanout_location=sl.cleanout_location,
        address=sl.address,
        account_number=sl.account_number,
        status=sl.status,
        install_date=sl.install_date,
        custom_fields=sl.custom_fields,
        notes=sl.notes,
        longitude=longitude,
        latitude=latitude,
        coordinates=coordinates,
        created_at=sl.created_at,
        updated_at=sl.updated_at,
    )
