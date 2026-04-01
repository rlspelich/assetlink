"""Sewer lateral CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.tenant import get_current_tenant
from app.db.session import get_db
from app.models.sewer import SewerLateral
from app.schemas.sewer import (
    SewerLateralCreate,
    SewerLateralListOut,
    SewerLateralOut,
    SewerLateralUpdate,
)

from .helpers import _coords_to_linestring_wkt, _sewer_lateral_to_out

router = APIRouter()


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
