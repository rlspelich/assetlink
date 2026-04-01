"""Reference data lookup routes (material types, pipe shapes, manhole types)."""

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.sewer import ManholeType, SewerMaterialType, SewerPipeShape
from app.schemas.sewer import ManholeTypeOut, SewerMaterialTypeOut, SewerPipeShapeOut

router = APIRouter()


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
