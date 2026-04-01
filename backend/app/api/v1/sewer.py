"""Sewer collection system API routes.

CRUD endpoints for manholes, sewer mains, force mains, lift stations,
sewer laterals, and reference lookups (material types, pipe shapes,
manhole types).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from geoalchemy2.shape import to_shape
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.sewer import (
    ForceMain,
    LiftStation,
    Manhole,
    ManholeType,
    ManholePipe,
    SewerLateral,
    SewerMain,
    SewerMaterialType,
    SewerPipeShape,
)
from app.schemas.sewer import (
    ForceMainCreate,
    ForceMainListOut,
    ForceMainOut,
    ForceMainUpdate,
    LiftStationCreate,
    LiftStationListOut,
    LiftStationOut,
    LiftStationUpdate,
    ManholeCreate,
    ManholeListOut,
    ManholeOut,
    ManholeTypeOut,
    ManholeUpdate,
    ManholePipeOut,
    SewerLateralCreate,
    SewerLateralListOut,
    SewerLateralOut,
    SewerLateralUpdate,
    SewerMainCreate,
    SewerMainListOut,
    SewerMainOut,
    SewerMainUpdate,
    SewerMaterialTypeOut,
    SewerPipeShapeOut,
)

router = APIRouter()


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


# ===========================================================================
# Manholes
# ===========================================================================


@router.get("/manholes", response_model=ManholeListOut, tags=["sewer-manholes"])
async def list_manholes(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    system_type: str | None = None,
    manhole_type_code: str | None = None,
) -> ManholeListOut:
    """List manholes for the current tenant with optional filters."""
    # Subquery for pipe connection count per manhole
    pipe_count_subq = (
        select(
            ManholePipe.manhole_id,
            func.count(ManholePipe.manhole_pipe_id).label("pipe_count"),
        )
        .where(ManholePipe.tenant_id == tenant_id)
        .group_by(ManholePipe.manhole_id)
        .subquery()
    )

    query = (
        select(
            Manhole,
            func.ST_X(Manhole.geometry).label("lon"),
            func.ST_Y(Manhole.geometry).label("lat"),
            func.coalesce(pipe_count_subq.c.pipe_count, 0).label("pipe_count"),
        )
        .outerjoin(pipe_count_subq, Manhole.manhole_id == pipe_count_subq.c.manhole_id)
        .where(Manhole.tenant_id == tenant_id)
    )

    if status:
        query = query.where(Manhole.status == status)
    if system_type:
        query = query.where(Manhole.system_type == system_type)
    if manhole_type_code:
        query = query.where(Manhole.manhole_type_code == manhole_type_code)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(Manhole.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    manholes = [
        _manhole_to_out(row.Manhole, row.lon, row.lat, row.pipe_count)
        for row in rows
    ]

    return ManholeListOut(manholes=manholes, total=total, page=page, page_size=page_size)


@router.post("/manholes", response_model=ManholeOut, status_code=201, tags=["sewer-manholes"])
async def create_manhole(
    data: ManholeCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ManholeOut:
    """Create a new manhole."""
    geom = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)

    manhole = Manhole(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        manhole_type_code=data.manhole_type_code,
        material=data.material,
        diameter_inches=data.diameter_inches,
        rim_elevation_ft=data.rim_elevation_ft,
        invert_elevation_ft=data.invert_elevation_ft,
        depth_ft=data.depth_ft,
        cover_type=data.cover_type,
        cover_diameter_inches=data.cover_diameter_inches,
        frame_type=data.frame_type,
        has_steps=data.has_steps,
        step_material=data.step_material,
        cone_type=data.cone_type,
        chimney_height_inches=data.chimney_height_inches,
        channel_type=data.channel_type,
        bench_type=data.bench_type,
        system_type=data.system_type,
        macp_grade=data.macp_grade,
        macp_score=data.macp_score,
        last_macp_date=data.last_macp_date,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(manhole)
    await db.flush()

    return ManholeOut(
        manhole_id=manhole.manhole_id,
        tenant_id=manhole.tenant_id,
        asset_tag=manhole.asset_tag,
        description=manhole.description,
        manhole_type_code=manhole.manhole_type_code,
        material=manhole.material,
        diameter_inches=manhole.diameter_inches,
        rim_elevation_ft=manhole.rim_elevation_ft,
        invert_elevation_ft=manhole.invert_elevation_ft,
        depth_ft=manhole.depth_ft,
        cover_type=manhole.cover_type,
        cover_diameter_inches=manhole.cover_diameter_inches,
        frame_type=manhole.frame_type,
        has_steps=manhole.has_steps,
        step_material=manhole.step_material,
        cone_type=manhole.cone_type,
        chimney_height_inches=manhole.chimney_height_inches,
        channel_type=manhole.channel_type,
        bench_type=manhole.bench_type,
        system_type=manhole.system_type,
        macp_grade=manhole.macp_grade,
        macp_score=manhole.macp_score,
        last_macp_date=manhole.last_macp_date,
        status=manhole.status,
        install_date=manhole.install_date,
        condition_rating=manhole.condition_rating,
        custom_fields=manhole.custom_fields,
        notes=manhole.notes,
        longitude=data.longitude,
        latitude=data.latitude,
        pipe_connection_count=0,
        created_at=manhole.created_at,
        updated_at=manhole.updated_at,
    )


@router.get("/manholes/{manhole_id}", response_model=ManholeOut, tags=["sewer-manholes"])
async def get_manhole(
    manhole_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ManholeOut:
    """Get a single manhole by ID, including pipe connections."""
    # Pipe connection count subquery
    pipe_count_subq = (
        select(func.count(ManholePipe.manhole_pipe_id).label("pipe_count"))
        .where(ManholePipe.manhole_id == manhole_id, ManholePipe.tenant_id == tenant_id)
        .scalar_subquery()
    )

    query = select(
        Manhole,
        func.ST_X(Manhole.geometry).label("lon"),
        func.ST_Y(Manhole.geometry).label("lat"),
        func.coalesce(pipe_count_subq, 0).label("pipe_count"),
    ).where(Manhole.manhole_id == manhole_id, Manhole.tenant_id == tenant_id)

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Manhole not found")

    # Fetch pipe connections
    pipe_result = await db.execute(
        select(ManholePipe).where(
            ManholePipe.manhole_id == manhole_id,
            ManholePipe.tenant_id == tenant_id,
        )
    )
    pipe_connections = [
        ManholePipeOut.model_validate(mp) for mp in pipe_result.scalars().all()
    ]

    out = _manhole_to_out(row.Manhole, row.lon, row.lat, row.pipe_count)
    # Attach pipe_connections as extra data in the response
    # Since ManholeOut doesn't have pipe_connections, we return ManholeOut
    # with pipe connections available via the /manholes/{id}/pipe-connections endpoint
    # or embedded in a detail view. For now, return the standard ManholeOut.
    return out


@router.put("/manholes/{manhole_id}", response_model=ManholeOut, tags=["sewer-manholes"])
async def update_manhole(
    manhole_id: uuid.UUID,
    data: ManholeUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ManholeOut:
    """Update a manhole."""
    result = await db.execute(
        select(Manhole).where(
            Manhole.manhole_id == manhole_id, Manhole.tenant_id == tenant_id
        )
    )
    manhole = result.scalar_one_or_none()
    if not manhole:
        raise HTTPException(status_code=404, detail="Manhole not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        manhole.geometry = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(manhole, field, value)

    await db.flush()

    # Re-fetch with coordinates and pipe count
    pipe_count_subq = (
        select(func.count(ManholePipe.manhole_pipe_id).label("pipe_count"))
        .where(ManholePipe.manhole_id == manhole_id, ManholePipe.tenant_id == tenant_id)
        .scalar_subquery()
    )

    query = select(
        Manhole,
        func.ST_X(Manhole.geometry).label("lon"),
        func.ST_Y(Manhole.geometry).label("lat"),
        func.coalesce(pipe_count_subq, 0).label("pipe_count"),
    ).where(Manhole.manhole_id == manhole_id)
    result = await db.execute(query)
    row = result.first()

    return _manhole_to_out(row.Manhole, row.lon, row.lat, row.pipe_count)


@router.delete("/manholes/{manhole_id}", status_code=204, tags=["sewer-manholes"])
async def delete_manhole(
    manhole_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a manhole."""
    result = await db.execute(
        select(Manhole).where(
            Manhole.manhole_id == manhole_id, Manhole.tenant_id == tenant_id
        )
    )
    manhole = result.scalar_one_or_none()
    if not manhole:
        raise HTTPException(status_code=404, detail="Manhole not found")

    # Check for pipe connections
    pipe_count = (
        await db.execute(
            select(func.count(ManholePipe.manhole_pipe_id)).where(
                ManholePipe.manhole_id == manhole_id,
                ManholePipe.tenant_id == tenant_id,
            )
        )
    ).scalar_one()

    if pipe_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete manhole with {pipe_count} pipe connection(s). "
            "Remove pipe connections first.",
        )

    await db.delete(manhole)


# ===========================================================================
# Sewer Mains
# ===========================================================================


@router.get("/sewer-mains", response_model=SewerMainListOut, tags=["sewer-mains"])
async def list_sewer_mains(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    system_type: str | None = None,
    material_code: str | None = None,
) -> SewerMainListOut:
    """List sewer mains for the current tenant with optional filters."""
    query = select(SewerMain).where(SewerMain.tenant_id == tenant_id)

    if status:
        query = query.where(SewerMain.status == status)
    if system_type:
        query = query.where(SewerMain.system_type == system_type)
    if material_code:
        query = query.where(SewerMain.material_code == material_code)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(SewerMain.created_at.desc())
    result = await db.execute(query)
    sewer_mains_orm = result.scalars().all()

    sewer_mains = [
        _sewer_main_to_out(sm, _linestring_geom_to_coords(sm.geometry))
        for sm in sewer_mains_orm
    ]

    return SewerMainListOut(
        sewer_mains=sewer_mains, total=total, page=page, page_size=page_size
    )


@router.post("/sewer-mains", response_model=SewerMainOut, status_code=201, tags=["sewer-mains"])
async def create_sewer_main(
    data: SewerMainCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerMainOut:
    """Create a new sewer main with LineString geometry."""
    from geoalchemy2.elements import WKTElement

    wkt = _coords_to_linestring_wkt(data.coordinates)
    geom = WKTElement(wkt, srid=4326)

    sewer_main = SewerMain(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        material_code=data.material_code,
        shape_code=data.shape_code,
        diameter_inches=data.diameter_inches,
        height_inches=data.height_inches,
        width_inches=data.width_inches,
        length_feet=data.length_feet,
        lining_type=data.lining_type,
        lining_date=data.lining_date,
        lining_thickness_mm=data.lining_thickness_mm,
        depth_ft_upstream=data.depth_ft_upstream,
        depth_ft_downstream=data.depth_ft_downstream,
        slope_pct=data.slope_pct,
        upstream_invert_ft=data.upstream_invert_ft,
        downstream_invert_ft=data.downstream_invert_ft,
        upstream_manhole_id=data.upstream_manhole_id,
        downstream_manhole_id=data.downstream_manhole_id,
        system_type=data.system_type,
        owner=data.owner,
        maintained_by=data.maintained_by,
        pacp_grade=data.pacp_grade,
        pacp_structural_score=data.pacp_structural_score,
        pacp_om_score=data.pacp_om_score,
        last_pacp_date=data.last_pacp_date,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        expected_life_years=data.expected_life_years,
        replacement_cost=data.replacement_cost,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(sewer_main)
    await db.flush()

    return _sewer_main_to_out(sewer_main, data.coordinates)


@router.get("/sewer-mains/{sewer_main_id}", response_model=SewerMainOut, tags=["sewer-mains"])
async def get_sewer_main(
    sewer_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerMainOut:
    """Get a single sewer main by ID."""
    result = await db.execute(
        select(SewerMain).where(
            SewerMain.sewer_main_id == sewer_main_id, SewerMain.tenant_id == tenant_id
        )
    )
    sewer_main = result.scalar_one_or_none()
    if not sewer_main:
        raise HTTPException(status_code=404, detail="Sewer main not found")

    return _sewer_main_to_out(sewer_main, _linestring_geom_to_coords(sewer_main.geometry))


@router.put("/sewer-mains/{sewer_main_id}", response_model=SewerMainOut, tags=["sewer-mains"])
async def update_sewer_main(
    sewer_main_id: uuid.UUID,
    data: SewerMainUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerMainOut:
    """Update a sewer main."""
    result = await db.execute(
        select(SewerMain).where(
            SewerMain.sewer_main_id == sewer_main_id, SewerMain.tenant_id == tenant_id
        )
    )
    sewer_main = result.scalar_one_or_none()
    if not sewer_main:
        raise HTTPException(status_code=404, detail="Sewer main not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "coordinates" in update_data:
        coords = update_data.pop("coordinates")
        if coords is not None:
            from geoalchemy2.elements import WKTElement

            wkt = _coords_to_linestring_wkt(coords)
            sewer_main.geometry = WKTElement(wkt, srid=4326)

    for field, value in update_data.items():
        setattr(sewer_main, field, value)

    await db.flush()

    # Re-fetch to get geometry back as coordinates
    result = await db.execute(
        select(SewerMain).where(SewerMain.sewer_main_id == sewer_main_id)
    )
    sewer_main = result.scalar_one()

    return _sewer_main_to_out(sewer_main, _linestring_geom_to_coords(sewer_main.geometry))


@router.delete("/sewer-mains/{sewer_main_id}", status_code=204, tags=["sewer-mains"])
async def delete_sewer_main(
    sewer_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a sewer main."""
    result = await db.execute(
        select(SewerMain).where(
            SewerMain.sewer_main_id == sewer_main_id, SewerMain.tenant_id == tenant_id
        )
    )
    sewer_main = result.scalar_one_or_none()
    if not sewer_main:
        raise HTTPException(status_code=404, detail="Sewer main not found")

    await db.delete(sewer_main)


# ===========================================================================
# Force Mains
# ===========================================================================


@router.get("/force-mains", response_model=ForceMainListOut, tags=["sewer-force-mains"])
async def list_force_mains(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    material_code: str | None = None,
) -> ForceMainListOut:
    """List force mains for the current tenant with optional filters."""
    query = select(ForceMain).where(ForceMain.tenant_id == tenant_id)

    if status:
        query = query.where(ForceMain.status == status)
    if material_code:
        query = query.where(ForceMain.material_code == material_code)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(ForceMain.created_at.desc())
    result = await db.execute(query)
    force_mains_orm = result.scalars().all()

    force_mains = [
        _force_main_to_out(fm, _linestring_geom_to_coords(fm.geometry))
        for fm in force_mains_orm
    ]

    return ForceMainListOut(
        force_mains=force_mains, total=total, page=page, page_size=page_size
    )


@router.post("/force-mains", response_model=ForceMainOut, status_code=201, tags=["sewer-force-mains"])
async def create_force_main(
    data: ForceMainCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ForceMainOut:
    """Create a new force main with LineString geometry."""
    from geoalchemy2.elements import WKTElement

    wkt = _coords_to_linestring_wkt(data.coordinates)
    geom = WKTElement(wkt, srid=4326)

    force_main = ForceMain(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        description=data.description,
        material_code=data.material_code,
        diameter_inches=data.diameter_inches,
        length_feet=data.length_feet,
        pressure_class=data.pressure_class,
        depth_feet=data.depth_feet,
        lift_station_id=data.lift_station_id,
        discharge_manhole_id=data.discharge_manhole_id,
        has_cathodic_protection=data.has_cathodic_protection,
        cp_test_date=data.cp_test_date,
        arv_count=data.arv_count,
        owner=data.owner,
        maintained_by=data.maintained_by,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(force_main)
    await db.flush()

    return _force_main_to_out(force_main, data.coordinates)


@router.get("/force-mains/{force_main_id}", response_model=ForceMainOut, tags=["sewer-force-mains"])
async def get_force_main(
    force_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ForceMainOut:
    """Get a single force main by ID."""
    result = await db.execute(
        select(ForceMain).where(
            ForceMain.force_main_id == force_main_id, ForceMain.tenant_id == tenant_id
        )
    )
    force_main = result.scalar_one_or_none()
    if not force_main:
        raise HTTPException(status_code=404, detail="Force main not found")

    return _force_main_to_out(force_main, _linestring_geom_to_coords(force_main.geometry))


@router.put("/force-mains/{force_main_id}", response_model=ForceMainOut, tags=["sewer-force-mains"])
async def update_force_main(
    force_main_id: uuid.UUID,
    data: ForceMainUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> ForceMainOut:
    """Update a force main."""
    result = await db.execute(
        select(ForceMain).where(
            ForceMain.force_main_id == force_main_id, ForceMain.tenant_id == tenant_id
        )
    )
    force_main = result.scalar_one_or_none()
    if not force_main:
        raise HTTPException(status_code=404, detail="Force main not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "coordinates" in update_data:
        coords = update_data.pop("coordinates")
        if coords is not None:
            from geoalchemy2.elements import WKTElement

            wkt = _coords_to_linestring_wkt(coords)
            force_main.geometry = WKTElement(wkt, srid=4326)

    for field, value in update_data.items():
        setattr(force_main, field, value)

    await db.flush()

    # Re-fetch to get geometry back as coordinates
    result = await db.execute(
        select(ForceMain).where(ForceMain.force_main_id == force_main_id)
    )
    force_main = result.scalar_one()

    return _force_main_to_out(force_main, _linestring_geom_to_coords(force_main.geometry))


@router.delete("/force-mains/{force_main_id}", status_code=204, tags=["sewer-force-mains"])
async def delete_force_main(
    force_main_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a force main."""
    result = await db.execute(
        select(ForceMain).where(
            ForceMain.force_main_id == force_main_id, ForceMain.tenant_id == tenant_id
        )
    )
    force_main = result.scalar_one_or_none()
    if not force_main:
        raise HTTPException(status_code=404, detail="Force main not found")

    await db.delete(force_main)


# ===========================================================================
# Lift Stations
# ===========================================================================


@router.get("/lift-stations", response_model=LiftStationListOut, tags=["sewer-lift-stations"])
async def list_lift_stations(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    has_scada: bool | None = None,
    has_backup_power: bool | None = None,
) -> LiftStationListOut:
    """List lift stations for the current tenant with optional filters."""
    # Subquery for force main count per lift station
    fm_count_subq = (
        select(
            ForceMain.lift_station_id,
            func.count(ForceMain.force_main_id).label("fm_count"),
        )
        .where(ForceMain.tenant_id == tenant_id)
        .group_by(ForceMain.lift_station_id)
        .subquery()
    )

    query = (
        select(
            LiftStation,
            func.ST_X(LiftStation.geometry).label("lon"),
            func.ST_Y(LiftStation.geometry).label("lat"),
            func.coalesce(fm_count_subq.c.fm_count, 0).label("fm_count"),
        )
        .outerjoin(fm_count_subq, LiftStation.lift_station_id == fm_count_subq.c.lift_station_id)
        .where(LiftStation.tenant_id == tenant_id)
    )

    if status:
        query = query.where(LiftStation.status == status)
    if has_scada is not None:
        query = query.where(LiftStation.has_scada == has_scada)
    if has_backup_power is not None:
        query = query.where(LiftStation.has_backup_power == has_backup_power)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(LiftStation.created_at.desc())
    result = await db.execute(query)
    rows = result.all()

    lift_stations = [
        _lift_station_to_out(row.LiftStation, row.lon, row.lat, row.fm_count)
        for row in rows
    ]

    return LiftStationListOut(
        lift_stations=lift_stations, total=total, page=page, page_size=page_size
    )


@router.post("/lift-stations", response_model=LiftStationOut, status_code=201, tags=["sewer-lift-stations"])
async def create_lift_station(
    data: LiftStationCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> LiftStationOut:
    """Create a new lift station."""
    geom = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)

    lift_station = LiftStation(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        station_name=data.station_name,
        description=data.description,
        wet_well_depth_ft=data.wet_well_depth_ft,
        wet_well_diameter_ft=data.wet_well_diameter_ft,
        wet_well_material=data.wet_well_material,
        pump_count=data.pump_count,
        pump_type=data.pump_type,
        pump_hp=data.pump_hp,
        firm_capacity_gpm=data.firm_capacity_gpm,
        design_capacity_gpm=data.design_capacity_gpm,
        control_type=data.control_type,
        has_scada=data.has_scada,
        has_backup_power=data.has_backup_power,
        backup_power_type=data.backup_power_type,
        has_alarm=data.has_alarm,
        alarm_type=data.alarm_type,
        electrical_service=data.electrical_service,
        voltage=data.voltage,
        owner=data.owner,
        maintained_by=data.maintained_by,
        status=data.status,
        install_date=data.install_date,
        condition_rating=data.condition_rating,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(lift_station)
    await db.flush()

    return LiftStationOut(
        lift_station_id=lift_station.lift_station_id,
        tenant_id=lift_station.tenant_id,
        asset_tag=lift_station.asset_tag,
        station_name=lift_station.station_name,
        description=lift_station.description,
        wet_well_depth_ft=lift_station.wet_well_depth_ft,
        wet_well_diameter_ft=lift_station.wet_well_diameter_ft,
        wet_well_material=lift_station.wet_well_material,
        pump_count=lift_station.pump_count,
        pump_type=lift_station.pump_type,
        pump_hp=lift_station.pump_hp,
        firm_capacity_gpm=lift_station.firm_capacity_gpm,
        design_capacity_gpm=lift_station.design_capacity_gpm,
        control_type=lift_station.control_type,
        has_scada=lift_station.has_scada,
        has_backup_power=lift_station.has_backup_power,
        backup_power_type=lift_station.backup_power_type,
        has_alarm=lift_station.has_alarm,
        alarm_type=lift_station.alarm_type,
        electrical_service=lift_station.electrical_service,
        voltage=lift_station.voltage,
        owner=lift_station.owner,
        maintained_by=lift_station.maintained_by,
        status=lift_station.status,
        install_date=lift_station.install_date,
        condition_rating=lift_station.condition_rating,
        custom_fields=lift_station.custom_fields,
        notes=lift_station.notes,
        longitude=data.longitude,
        latitude=data.latitude,
        force_main_count=0,
        created_at=lift_station.created_at,
        updated_at=lift_station.updated_at,
    )


@router.get("/lift-stations/{lift_station_id}", response_model=LiftStationOut, tags=["sewer-lift-stations"])
async def get_lift_station(
    lift_station_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> LiftStationOut:
    """Get a single lift station by ID."""
    fm_count_subq = (
        select(func.count(ForceMain.force_main_id).label("fm_count"))
        .where(
            ForceMain.lift_station_id == lift_station_id,
            ForceMain.tenant_id == tenant_id,
        )
        .scalar_subquery()
    )

    query = select(
        LiftStation,
        func.ST_X(LiftStation.geometry).label("lon"),
        func.ST_Y(LiftStation.geometry).label("lat"),
        func.coalesce(fm_count_subq, 0).label("fm_count"),
    ).where(
        LiftStation.lift_station_id == lift_station_id,
        LiftStation.tenant_id == tenant_id,
    )

    result = await db.execute(query)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Lift station not found")

    return _lift_station_to_out(row.LiftStation, row.lon, row.lat, row.fm_count)


@router.put("/lift-stations/{lift_station_id}", response_model=LiftStationOut, tags=["sewer-lift-stations"])
async def update_lift_station(
    lift_station_id: uuid.UUID,
    data: LiftStationUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> LiftStationOut:
    """Update a lift station."""
    result = await db.execute(
        select(LiftStation).where(
            LiftStation.lift_station_id == lift_station_id,
            LiftStation.tenant_id == tenant_id,
        )
    )
    lift_station = result.scalar_one_or_none()
    if not lift_station:
        raise HTTPException(status_code=404, detail="Lift station not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update
    if "longitude" in update_data and "latitude" in update_data:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        lift_station.geometry = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)

    for field, value in update_data.items():
        setattr(lift_station, field, value)

    await db.flush()

    # Re-fetch with coordinates and force main count
    fm_count_subq = (
        select(func.count(ForceMain.force_main_id).label("fm_count"))
        .where(
            ForceMain.lift_station_id == lift_station_id,
            ForceMain.tenant_id == tenant_id,
        )
        .scalar_subquery()
    )

    query = select(
        LiftStation,
        func.ST_X(LiftStation.geometry).label("lon"),
        func.ST_Y(LiftStation.geometry).label("lat"),
        func.coalesce(fm_count_subq, 0).label("fm_count"),
    ).where(LiftStation.lift_station_id == lift_station_id)
    result = await db.execute(query)
    row = result.first()

    return _lift_station_to_out(row.LiftStation, row.lon, row.lat, row.fm_count)


@router.delete("/lift-stations/{lift_station_id}", status_code=204, tags=["sewer-lift-stations"])
async def delete_lift_station(
    lift_station_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a lift station. Fails with 409 if force mains are still connected."""
    result = await db.execute(
        select(LiftStation).where(
            LiftStation.lift_station_id == lift_station_id,
            LiftStation.tenant_id == tenant_id,
        )
    )
    lift_station = result.scalar_one_or_none()
    if not lift_station:
        raise HTTPException(status_code=404, detail="Lift station not found")

    # Check for connected force mains
    fm_count = (
        await db.execute(
            select(func.count(ForceMain.force_main_id)).where(
                ForceMain.lift_station_id == lift_station_id,
                ForceMain.tenant_id == tenant_id,
            )
        )
    ).scalar_one()

    if fm_count > 0:
        raise HTTPException(
            status_code=409,
            detail=f"Cannot delete lift station with {fm_count} connected force main(s). "
            "Remove or reassign force mains first.",
        )

    await db.delete(lift_station)


# ===========================================================================
# Sewer Laterals
# ===========================================================================


@router.get("/sewer-laterals", response_model=SewerLateralListOut, tags=["sewer-laterals"])
async def list_sewer_laterals(
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(settings.default_page_size, ge=1, le=settings.max_page_size),
    status: str | None = None,
    service_type: str | None = None,
) -> SewerLateralListOut:
    """List sewer laterals for the current tenant with optional filters."""
    query = select(SewerLateral).where(SewerLateral.tenant_id == tenant_id)

    if status:
        query = query.where(SewerLateral.status == status)
    if service_type:
        query = query.where(SewerLateral.service_type == service_type)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar_one()

    # Paginate
    offset = (page - 1) * page_size
    query = query.offset(offset).limit(page_size).order_by(SewerLateral.created_at.desc())
    result = await db.execute(query)
    laterals_orm = result.scalars().all()

    sewer_laterals = [_sewer_lateral_to_out(sl) for sl in laterals_orm]

    return SewerLateralListOut(
        sewer_laterals=sewer_laterals, total=total, page=page, page_size=page_size
    )


@router.post("/sewer-laterals", response_model=SewerLateralOut, status_code=201, tags=["sewer-laterals"])
async def create_sewer_lateral(
    data: SewerLateralCreate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerLateralOut:
    """Create a new sewer lateral with Point or LineString geometry.

    Provide either longitude+latitude (Point) or coordinates (LineString), not both.
    """
    from geoalchemy2.elements import WKTElement

    if data.coordinates and (data.longitude is not None or data.latitude is not None):
        raise HTTPException(
            status_code=400,
            detail="Provide either longitude+latitude (Point) or coordinates (LineString), not both.",
        )

    if data.coordinates:
        wkt = _coords_to_linestring_wkt(data.coordinates)
        geom = WKTElement(wkt, srid=4326)
    elif data.longitude is not None and data.latitude is not None:
        geom = func.ST_SetSRID(func.ST_MakePoint(data.longitude, data.latitude), 4326)
    else:
        raise HTTPException(
            status_code=400,
            detail="Geometry is required. Provide longitude+latitude (Point) or coordinates (LineString).",
        )

    lateral = SewerLateral(
        tenant_id=tenant_id,
        asset_tag=data.asset_tag,
        service_type=data.service_type,
        material_code=data.material_code,
        diameter_inches=data.diameter_inches,
        length_feet=data.length_feet,
        depth_at_main_ft=data.depth_at_main_ft,
        connected_main_id=data.connected_main_id,
        tap_location=data.tap_location,
        has_cleanout=data.has_cleanout,
        cleanout_location=data.cleanout_location,
        address=data.address,
        account_number=data.account_number,
        status=data.status,
        install_date=data.install_date,
        custom_fields=data.custom_fields,
        notes=data.notes,
        geometry=geom,
    )
    db.add(lateral)
    await db.flush()

    # Build response using the input data (geometry isn't loaded from DB yet)
    return SewerLateralOut(
        sewer_lateral_id=lateral.sewer_lateral_id,
        tenant_id=lateral.tenant_id,
        asset_tag=lateral.asset_tag,
        service_type=lateral.service_type,
        material_code=lateral.material_code,
        diameter_inches=lateral.diameter_inches,
        length_feet=lateral.length_feet,
        depth_at_main_ft=lateral.depth_at_main_ft,
        connected_main_id=lateral.connected_main_id,
        tap_location=lateral.tap_location,
        has_cleanout=lateral.has_cleanout,
        cleanout_location=lateral.cleanout_location,
        address=lateral.address,
        account_number=lateral.account_number,
        status=lateral.status,
        install_date=lateral.install_date,
        custom_fields=lateral.custom_fields,
        notes=lateral.notes,
        longitude=data.longitude,
        latitude=data.latitude,
        coordinates=data.coordinates,
        created_at=lateral.created_at,
        updated_at=lateral.updated_at,
    )


@router.get("/sewer-laterals/{sewer_lateral_id}", response_model=SewerLateralOut, tags=["sewer-laterals"])
async def get_sewer_lateral(
    sewer_lateral_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerLateralOut:
    """Get a single sewer lateral by ID."""
    result = await db.execute(
        select(SewerLateral).where(
            SewerLateral.sewer_lateral_id == sewer_lateral_id,
            SewerLateral.tenant_id == tenant_id,
        )
    )
    lateral = result.scalar_one_or_none()
    if not lateral:
        raise HTTPException(status_code=404, detail="Sewer lateral not found")

    return _sewer_lateral_to_out(lateral)


@router.put("/sewer-laterals/{sewer_lateral_id}", response_model=SewerLateralOut, tags=["sewer-laterals"])
async def update_sewer_lateral(
    sewer_lateral_id: uuid.UUID,
    data: SewerLateralUpdate,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> SewerLateralOut:
    """Update a sewer lateral."""
    result = await db.execute(
        select(SewerLateral).where(
            SewerLateral.sewer_lateral_id == sewer_lateral_id,
            SewerLateral.tenant_id == tenant_id,
        )
    )
    lateral = result.scalar_one_or_none()
    if not lateral:
        raise HTTPException(status_code=404, detail="Sewer lateral not found")

    update_data = data.model_dump(exclude_unset=True)

    # Handle geometry update — Point or LineString
    has_point = "longitude" in update_data and "latitude" in update_data
    has_line = "coordinates" in update_data

    if has_point and has_line and update_data["coordinates"] is not None:
        raise HTTPException(
            status_code=400,
            detail="Provide either longitude+latitude (Point) or coordinates (LineString), not both.",
        )

    if has_line:
        coords = update_data.pop("coordinates")
        if coords is not None:
            from geoalchemy2.elements import WKTElement

            wkt = _coords_to_linestring_wkt(coords)
            lateral.geometry = WKTElement(wkt, srid=4326)
        # Remove point fields if present — line takes precedence
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)
    elif has_point:
        lon = update_data.pop("longitude")
        lat = update_data.pop("latitude")
        lateral.geometry = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    else:
        update_data.pop("longitude", None)
        update_data.pop("latitude", None)
        update_data.pop("coordinates", None)

    for field, value in update_data.items():
        setattr(lateral, field, value)

    await db.flush()

    # Re-fetch to get geometry
    result = await db.execute(
        select(SewerLateral).where(SewerLateral.sewer_lateral_id == sewer_lateral_id)
    )
    lateral = result.scalar_one()

    return _sewer_lateral_to_out(lateral)


@router.delete("/sewer-laterals/{sewer_lateral_id}", status_code=204, tags=["sewer-laterals"])
async def delete_sewer_lateral(
    sewer_lateral_id: uuid.UUID,
    tenant_id: uuid.UUID = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a sewer lateral."""
    result = await db.execute(
        select(SewerLateral).where(
            SewerLateral.sewer_lateral_id == sewer_lateral_id,
            SewerLateral.tenant_id == tenant_id,
        )
    )
    lateral = result.scalar_one_or_none()
    if not lateral:
        raise HTTPException(status_code=404, detail="Sewer lateral not found")

    await db.delete(lateral)


# ===========================================================================
# Reference Lookups
# ===========================================================================


@router.get(
    "/sewer-material-types",
    response_model=list[SewerMaterialTypeOut],
    tags=["sewer-lookups"],
)
async def list_sewer_material_types(
    db: AsyncSession = Depends(get_db),
) -> list[SewerMaterialTypeOut]:
    """List all active sewer material types. Not tenant-specific."""
    query = (
        select(SewerMaterialType)
        .where(SewerMaterialType.is_active == True)
        .order_by(SewerMaterialType.code)
    )
    result = await db.execute(query)
    return [SewerMaterialTypeOut.model_validate(mt) for mt in result.scalars().all()]


@router.get(
    "/sewer-pipe-shapes",
    response_model=list[SewerPipeShapeOut],
    tags=["sewer-lookups"],
)
async def list_sewer_pipe_shapes(
    db: AsyncSession = Depends(get_db),
) -> list[SewerPipeShapeOut]:
    """List all active sewer pipe shapes. Not tenant-specific."""
    query = (
        select(SewerPipeShape)
        .where(SewerPipeShape.is_active == True)
        .order_by(SewerPipeShape.code)
    )
    result = await db.execute(query)
    return [SewerPipeShapeOut.model_validate(ps) for ps in result.scalars().all()]


@router.get(
    "/manhole-types",
    response_model=list[ManholeTypeOut],
    tags=["sewer-lookups"],
)
async def list_manhole_types(
    db: AsyncSession = Depends(get_db),
) -> list[ManholeTypeOut]:
    """List all active manhole types. Not tenant-specific."""
    query = (
        select(ManholeType)
        .where(ManholeType.is_active == True)
        .order_by(ManholeType.code)
    )
    result = await db.execute(query)
    return [ManholeTypeOut.model_validate(mt) for mt in result.scalars().all()]
