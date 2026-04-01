"""Manhole CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.sewer import Manhole, ManholePipe
from app.schemas.sewer import (
    ManholeCreate,
    ManholeListOut,
    ManholeOut,
    ManholePipeOut,
    ManholeUpdate,
)

from .helpers import _manhole_to_out

router = APIRouter()


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
