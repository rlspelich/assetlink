"""Seed/initialization endpoints for cost indices and regional factors."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.estimator import RegionalFactorOut, SeedResultOut

router = APIRouter()


@router.post("/cost-indices/seed", response_model=SeedResultOut)
async def seed_cost_indices_endpoint(db: AsyncSession = Depends(get_db)) -> SeedResultOut:
    """Seed cost index data from bundled CSV files."""
    from app.services.estimator.inflation_service import seed_cost_indices as _si, seed_index_mappings as _sm
    idx = await _si(db); maps = await _sm(db)
    return SeedResultOut(created=idx["created"]+maps["created"],
        message=f"Indices: {idx['created']}. Mappings: {maps['created']}.")


@router.post("/regional-factors/seed", response_model=SeedResultOut)
async def seed_regional_factors_endpoint(db: AsyncSession = Depends(get_db)) -> SeedResultOut:
    """Seed regional cost factors from bundled CSV."""
    from app.services.estimator.regional_service import seed_regional_factors as _seed
    r = await _seed(db)
    return SeedResultOut(created=r["created"], updated=r.get("updated", 0),
        message=f"{r['created']} created, {r.get('updated', 0)} updated.")


@router.get("/regional-factors", response_model=list[RegionalFactorOut])
async def get_regional_factors(db: AsyncSession = Depends(get_db)) -> list[RegionalFactorOut]:
    """Get all state-level regional cost factors."""
    from app.services.estimator.regional_service import get_all_regional_factors as _get
    return [RegionalFactorOut.model_validate(f) for f in await _get(db)]
