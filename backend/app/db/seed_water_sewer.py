"""
Seed reference tables for Water and Sewer modules.

Water: water_material_type, water_valve_type
Sewer: sewer_material_type, sewer_pipe_shape, manhole_type
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.water import WaterMaterialType, WaterValveType
from app.models.sewer import SewerMaterialType, SewerPipeShape, ManholeType


# ---------------------------------------------------------------------------
# Water Material Types
# ---------------------------------------------------------------------------

WATER_MATERIAL_TYPES = [
    {"code": "DI", "description": "Ductile Iron", "expected_life_years": 100},
    {"code": "CI", "description": "Cast Iron", "expected_life_years": 100},
    {"code": "PVC", "description": "Polyvinyl Chloride (PVC)", "expected_life_years": 100},
    {"code": "HDPE", "description": "High-Density Polyethylene", "expected_life_years": 100},
    {"code": "AC", "description": "Asbestos Cement (Transite)", "expected_life_years": 75},
    {"code": "CU", "description": "Copper", "expected_life_years": 70},
    {"code": "GAL", "description": "Galvanized Steel", "expected_life_years": 50},
    {"code": "STL", "description": "Steel", "expected_life_years": 60},
    {"code": "CONC", "description": "Concrete", "expected_life_years": 75},
    {"code": "PCCP", "description": "Prestressed Concrete Cylinder Pipe", "expected_life_years": 75},
    {"code": "LEAD", "description": "Lead", "expected_life_years": None},
    {"code": "PE", "description": "Polyethylene", "expected_life_years": 100},
    {"code": "BRASS", "description": "Brass", "expected_life_years": 70},
    {"code": "FRP", "description": "Fiberglass Reinforced Plastic", "expected_life_years": 50},
    {"code": "UNK", "description": "Unknown", "expected_life_years": None},
]

# ---------------------------------------------------------------------------
# Water Valve Types
# ---------------------------------------------------------------------------

WATER_VALVE_TYPES = [
    {"code": "GATE", "description": "Gate Valve", "exercise_interval_days": 365},
    {"code": "BUTTERFLY", "description": "Butterfly Valve", "exercise_interval_days": 365},
    {"code": "BALL", "description": "Ball Valve", "exercise_interval_days": 365},
    {"code": "CHECK", "description": "Check Valve", "exercise_interval_days": 365},
    {"code": "PRV", "description": "Pressure Reducing Valve", "exercise_interval_days": 180},
    {"code": "PSV", "description": "Pressure Sustaining Valve", "exercise_interval_days": 180},
    {"code": "ARV", "description": "Air Release Valve", "exercise_interval_days": 180},
    {"code": "AV", "description": "Air/Vacuum Valve", "exercise_interval_days": 180},
    {"code": "PLUG", "description": "Plug Valve", "exercise_interval_days": 365},
    {"code": "ALTITUDE", "description": "Altitude Valve", "exercise_interval_days": 180},
    {"code": "BLOWOFF", "description": "Blow-Off Valve", "exercise_interval_days": 365},
    {"code": "CURB_STOP", "description": "Curb Stop", "exercise_interval_days": None},
    {"code": "CORP_STOP", "description": "Corporation Stop", "exercise_interval_days": None},
    {"code": "CONTROL", "description": "Control Valve (general)", "exercise_interval_days": 365},
    {"code": "UNK", "description": "Unknown", "exercise_interval_days": None},
]

# ---------------------------------------------------------------------------
# Sewer Material Types
# ---------------------------------------------------------------------------

SEWER_MATERIAL_TYPES = [
    {"code": "VCP", "description": "Vitrified Clay Pipe", "expected_life_years": 100},
    {"code": "PVC", "description": "Polyvinyl Chloride (PVC)", "expected_life_years": 100},
    {"code": "RCP", "description": "Reinforced Concrete Pipe", "expected_life_years": 75},
    {"code": "HDPE", "description": "High-Density Polyethylene", "expected_life_years": 100},
    {"code": "DIP", "description": "Ductile Iron Pipe", "expected_life_years": 100},
    {"code": "CMP", "description": "Corrugated Metal Pipe", "expected_life_years": 50},
    {"code": "BRICK", "description": "Brick", "expected_life_years": 100},
    {"code": "CONC", "description": "Concrete (non-reinforced)", "expected_life_years": 50},
    {"code": "CI", "description": "Cast Iron", "expected_life_years": 75},
    {"code": "ABS", "description": "Acrylonitrile Butadiene Styrene", "expected_life_years": 50},
    {"code": "PE", "description": "Polyethylene", "expected_life_years": 100},
    {"code": "FRP", "description": "Fiberglass Reinforced Plastic", "expected_life_years": 50},
    {"code": "PP", "description": "Polypropylene", "expected_life_years": 100},
    {"code": "STL", "description": "Steel", "expected_life_years": 50},
    {"code": "CIPP", "description": "Cured-In-Place Pipe (liner)", "expected_life_years": 50},
    {"code": "AC", "description": "Asbestos Cement", "expected_life_years": 75},
    {"code": "UNK", "description": "Unknown", "expected_life_years": None},
]

# ---------------------------------------------------------------------------
# Sewer Pipe Shapes
# ---------------------------------------------------------------------------

SEWER_PIPE_SHAPES = [
    {"code": "CIRC", "description": "Circular"},
    {"code": "EGG", "description": "Egg-Shaped (Ovoid)"},
    {"code": "HORSE", "description": "Horseshoe"},
    {"code": "ARCH", "description": "Arch"},
    {"code": "BOX", "description": "Box / Rectangular"},
    {"code": "ELLIP", "description": "Elliptical"},
    {"code": "SEMI", "description": "Semi-Circular"},
    {"code": "TRAP", "description": "Trapezoidal"},
    {"code": "UNK", "description": "Unknown"},
]

# ---------------------------------------------------------------------------
# Manhole Types
# ---------------------------------------------------------------------------

MANHOLE_TYPES = [
    {"code": "PRECAST", "description": "Precast Concrete"},
    {"code": "BRICK", "description": "Brick"},
    {"code": "BLOCK", "description": "Concrete Block"},
    {"code": "FIBERG", "description": "Fiberglass"},
    {"code": "POLYMER", "description": "Polymer / HDPE"},
    {"code": "PIP", "description": "Poured-In-Place Concrete"},
    {"code": "STONE", "description": "Stone Masonry"},
    {"code": "COMBO", "description": "Combination (mixed materials)"},
    {"code": "UNK", "description": "Unknown"},
]


# ---------------------------------------------------------------------------
# Seed Functions
# ---------------------------------------------------------------------------


async def seed_water_material_types(db: AsyncSession) -> int:
    """Insert water material types if they don't exist."""
    existing = await db.execute(select(WaterMaterialType.code))
    existing_codes = {row[0] for row in existing.all()}
    new_count = 0
    for data in WATER_MATERIAL_TYPES:
        if data["code"] not in existing_codes:
            db.add(WaterMaterialType(**data))
            new_count += 1
    if new_count > 0:
        await db.commit()
    return new_count


async def seed_water_valve_types(db: AsyncSession) -> int:
    """Insert water valve types if they don't exist."""
    existing = await db.execute(select(WaterValveType.code))
    existing_codes = {row[0] for row in existing.all()}
    new_count = 0
    for data in WATER_VALVE_TYPES:
        if data["code"] not in existing_codes:
            db.add(WaterValveType(**data))
            new_count += 1
    if new_count > 0:
        await db.commit()
    return new_count


async def seed_sewer_material_types(db: AsyncSession) -> int:
    """Insert sewer material types if they don't exist."""
    existing = await db.execute(select(SewerMaterialType.code))
    existing_codes = {row[0] for row in existing.all()}
    new_count = 0
    for data in SEWER_MATERIAL_TYPES:
        if data["code"] not in existing_codes:
            db.add(SewerMaterialType(**data))
            new_count += 1
    if new_count > 0:
        await db.commit()
    return new_count


async def seed_sewer_pipe_shapes(db: AsyncSession) -> int:
    """Insert sewer pipe shapes if they don't exist."""
    existing = await db.execute(select(SewerPipeShape.code))
    existing_codes = {row[0] for row in existing.all()}
    new_count = 0
    for data in SEWER_PIPE_SHAPES:
        if data["code"] not in existing_codes:
            db.add(SewerPipeShape(**data))
            new_count += 1
    if new_count > 0:
        await db.commit()
    return new_count


async def seed_manhole_types(db: AsyncSession) -> int:
    """Insert manhole types if they don't exist."""
    existing = await db.execute(select(ManholeType.code))
    existing_codes = {row[0] for row in existing.all()}
    new_count = 0
    for data in MANHOLE_TYPES:
        if data["code"] not in existing_codes:
            db.add(ManholeType(**data))
            new_count += 1
    if new_count > 0:
        await db.commit()
    return new_count


async def seed_all_water_sewer(db: AsyncSession) -> dict[str, int]:
    """Seed all water and sewer reference tables. Returns counts per table."""
    return {
        "water_material_type": await seed_water_material_types(db),
        "water_valve_type": await seed_water_valve_types(db),
        "sewer_material_type": await seed_sewer_material_types(db),
        "sewer_pipe_shape": await seed_sewer_pipe_shapes(db),
        "manhole_type": await seed_manhole_types(db),
    }
