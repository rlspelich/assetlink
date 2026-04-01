"""Reference data lookup routes for water module (not tenant-specific)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.water import WaterMaterialType, WaterValveType

from .helpers import WaterMaterialTypeOut, WaterValveTypeOut

router = APIRouter()


@router.get(
    "/water-material-types",
    response_model=list[WaterMaterialTypeOut],
    tags=["water-lookups"],
)
async def list_water_material_types(
    db: AsyncSession = Depends(get_db),
) -> list[WaterMaterialTypeOut]:
    """List all active water material types. Not tenant-specific."""
    query = (
        select(WaterMaterialType)
        .where(WaterMaterialType.is_active == True)
        .order_by(WaterMaterialType.code)
    )
    result = await db.execute(query)
    return [WaterMaterialTypeOut.model_validate(mt) for mt in result.scalars().all()]


@router.get(
    "/water-valve-types",
    response_model=list[WaterValveTypeOut],
    tags=["water-lookups"],
)
async def list_water_valve_types(
    db: AsyncSession = Depends(get_db),
) -> list[WaterValveTypeOut]:
    """List all active water valve types. Not tenant-specific."""
    query = (
        select(WaterValveType)
        .where(WaterValveType.is_active == True)
        .order_by(WaterValveType.code)
    )
    result = await db.execute(query)
    return [WaterValveTypeOut.model_validate(vt) for vt in result.scalars().all()]
