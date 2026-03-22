"""
Seed MUTCD sign type lookup table.

Source: FHWA Manual on Uniform Traffic Control Devices
This covers the most common signs — not exhaustive. Additional codes can be added
as municipalities request them.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sign import SignType

MUTCD_SIGN_TYPES = [
    # --- REGULATORY ---
    # Stop / Yield
    {"mutcd_code": "R1-1", "category": "regulatory", "description": "STOP", "standard_width": 30, "standard_height": 30, "shape": "octagon", "background_color": "red", "legend_color": "white", "expected_life_years": 10},
    {"mutcd_code": "R1-2", "category": "regulatory", "description": "YIELD", "standard_width": 36, "standard_height": 36, "shape": "triangle", "background_color": "white", "legend_color": "red", "expected_life_years": 10},
    {"mutcd_code": "R1-3", "category": "regulatory", "description": "Multi-Way Stop Plaque", "standard_width": 18, "standard_height": 6, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    # Speed Limit
    {"mutcd_code": "R2-1", "category": "regulatory", "description": "Speed Limit", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R2-2", "category": "regulatory", "description": "Night Speed Limit", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R2-3", "category": "regulatory", "description": "Truck Speed Limit", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R2-4", "category": "regulatory", "description": "Minimum Speed Limit", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R2-5", "category": "regulatory", "description": "End Speed Limit", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    # Turn / Movement
    {"mutcd_code": "R3-1", "category": "regulatory", "description": "No Right Turn", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R3-2", "category": "regulatory", "description": "No Left Turn", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R3-3", "category": "regulatory", "description": "No Turns", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R3-4", "category": "regulatory", "description": "No U-Turn", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R3-5a", "category": "regulatory", "description": "No Right Turn (symbol)", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R3-7", "category": "regulatory", "description": "No Left Turn (symbol)", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R3-8", "category": "regulatory", "description": "No U-Turn (symbol)", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    # Lane Use / One Way
    {"mutcd_code": "R4-1", "category": "regulatory", "description": "Do Not Pass", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R4-7", "category": "regulatory", "description": "Keep Right", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R5-1", "category": "regulatory", "description": "Do Not Enter", "standard_width": 30, "standard_height": 30, "shape": "square", "background_color": "white", "legend_color": "red", "expected_life_years": 10},
    {"mutcd_code": "R6-1", "category": "regulatory", "description": "One Way (arrow)", "standard_width": 36, "standard_height": 12, "shape": "rectangle", "background_color": "black", "legend_color": "white", "expected_life_years": 10},
    {"mutcd_code": "R6-2", "category": "regulatory", "description": "One Way (word)", "standard_width": 36, "standard_height": 12, "shape": "rectangle", "background_color": "black", "legend_color": "white", "expected_life_years": 10},
    # Parking
    {"mutcd_code": "R7-1", "category": "regulatory", "description": "No Parking (symbol)", "standard_width": 12, "standard_height": 18, "shape": "rectangle", "background_color": "white", "legend_color": "red", "expected_life_years": 10},
    {"mutcd_code": "R7-2", "category": "regulatory", "description": "No Parking", "standard_width": 12, "standard_height": 18, "shape": "rectangle", "background_color": "white", "legend_color": "red", "expected_life_years": 10},
    {"mutcd_code": "R7-8", "category": "regulatory", "description": "No Parking Any Time", "standard_width": 12, "standard_height": 18, "shape": "rectangle", "background_color": "white", "legend_color": "red", "expected_life_years": 10},
    {"mutcd_code": "R8-3", "category": "regulatory", "description": "No Parking (tow zone)", "standard_width": 12, "standard_height": 18, "shape": "rectangle", "background_color": "white", "legend_color": "red", "expected_life_years": 10},
    # Pedestrian / Bicycle
    {"mutcd_code": "R9-3", "category": "regulatory", "description": "No Pedestrian Crossing", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R9-7", "category": "regulatory", "description": "Pedestrian Crossing", "standard_width": 12, "standard_height": 18, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R10-1", "category": "regulatory", "description": "Traffic Signal Ahead", "standard_width": 24, "standard_height": 30, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "R10-3", "category": "regulatory", "description": "Pedestrian Signal (push button)", "standard_width": 9, "standard_height": 12, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 10},

    # --- WARNING ---
    {"mutcd_code": "W1-1", "category": "warning", "description": "Turn (right)", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W1-2", "category": "warning", "description": "Curve (right)", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W1-3", "category": "warning", "description": "Reverse Turn", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W1-4", "category": "warning", "description": "Reverse Curve", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W1-5", "category": "warning", "description": "Winding Road", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W1-6", "category": "warning", "description": "Large Arrow (chevron)", "standard_width": 24, "standard_height": 48, "shape": "rectangle", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W1-8", "category": "warning", "description": "Chevron Alignment", "standard_width": 12, "standard_height": 18, "shape": "rectangle", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W2-1", "category": "warning", "description": "Intersection Ahead", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W2-2", "category": "warning", "description": "Side Road (right)", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W2-3", "category": "warning", "description": "T-Intersection", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W2-4", "category": "warning", "description": "Y-Intersection", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W2-5", "category": "warning", "description": "Circular Intersection", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W3-1", "category": "warning", "description": "Stop Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W3-2", "category": "warning", "description": "Yield Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W3-3", "category": "warning", "description": "Signal Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W4-1", "category": "warning", "description": "Merge", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W4-2", "category": "warning", "description": "Lane Ends", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W5-2", "category": "warning", "description": "Road Narrows", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W6-1", "category": "warning", "description": "Divided Highway Begins", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W6-2", "category": "warning", "description": "Divided Highway Ends", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W7-1", "category": "warning", "description": "Hill", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W8-1", "category": "warning", "description": "Dip", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W8-2", "category": "warning", "description": "Rough Road", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W8-3", "category": "warning", "description": "Bump", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W8-5", "category": "warning", "description": "Slippery When Wet", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W8-17", "category": "warning", "description": "Speed Hump", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W10-1", "category": "warning", "description": "Railroad Crossing Advance", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W11-1", "category": "warning", "description": "Bicycle Warning", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W11-2", "category": "warning", "description": "Pedestrian Crossing", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W11-3", "category": "warning", "description": "Deer Crossing", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W11-8", "category": "warning", "description": "Fire Station", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W11-10", "category": "warning", "description": "Truck Crossing", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W12-1", "category": "warning", "description": "Low Clearance", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W14-1", "category": "warning", "description": "Dead End / No Outlet", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W14-2", "category": "warning", "description": "No Outlet", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},
    {"mutcd_code": "W16-7p", "category": "warning", "description": "Arrow Plaque (auxiliary)", "standard_width": 24, "standard_height": 12, "shape": "rectangle", "background_color": "yellow", "legend_color": "black", "expected_life_years": 10},

    # --- SCHOOL ---
    {"mutcd_code": "S1-1", "category": "school", "description": "School Zone", "standard_width": 36, "standard_height": 36, "shape": "pentagon", "background_color": "fluorescent_yellow_green", "legend_color": "black", "expected_life_years": 7},
    {"mutcd_code": "S3-1", "category": "school", "description": "School Speed Limit", "standard_width": 24, "standard_height": 48, "shape": "rectangle", "background_color": "fluorescent_yellow_green", "legend_color": "black", "expected_life_years": 7},
    {"mutcd_code": "S4-3", "category": "school", "description": "School Crossing", "standard_width": 30, "standard_height": 30, "shape": "diamond", "background_color": "fluorescent_yellow_green", "legend_color": "black", "expected_life_years": 7},

    # --- GUIDE ---
    {"mutcd_code": "D1-1", "category": "guide", "description": "Street Name Sign", "standard_width": 36, "standard_height": 9, "shape": "rectangle", "background_color": "green", "legend_color": "white", "expected_life_years": 12},
    {"mutcd_code": "D3-1", "category": "guide", "description": "Distance Sign", "standard_width": 36, "standard_height": 24, "shape": "rectangle", "background_color": "green", "legend_color": "white", "expected_life_years": 12},
    {"mutcd_code": "D9-4", "category": "guide", "description": "Hospital", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "blue", "legend_color": "white", "expected_life_years": 12},
    {"mutcd_code": "D9-7", "category": "guide", "description": "Library", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "blue", "legend_color": "white", "expected_life_years": 12},
    {"mutcd_code": "D9-8", "category": "guide", "description": "Airport", "standard_width": 24, "standard_height": 24, "shape": "square", "background_color": "blue", "legend_color": "white", "expected_life_years": 12},
    {"mutcd_code": "D11-1", "category": "guide", "description": "Route Marker", "standard_width": 24, "standard_height": 24, "shape": "rectangle", "background_color": "white", "legend_color": "black", "expected_life_years": 12},

    # --- CONSTRUCTION / TEMPORARY ---
    {"mutcd_code": "W20-1", "category": "construction", "description": "Road Work Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
    {"mutcd_code": "W20-2", "category": "construction", "description": "Detour Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
    {"mutcd_code": "W20-3", "category": "construction", "description": "Road Closed Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
    {"mutcd_code": "W20-4", "category": "construction", "description": "One Lane Road Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
    {"mutcd_code": "W20-5", "category": "construction", "description": "Lane Ends Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
    {"mutcd_code": "W21-1", "category": "construction", "description": "Worker Symbol", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
    {"mutcd_code": "W21-2", "category": "construction", "description": "Flagger Ahead", "standard_width": 36, "standard_height": 36, "shape": "diamond", "background_color": "orange", "legend_color": "black", "expected_life_years": None},
]


async def seed_sign_types(db: AsyncSession) -> int:
    """Insert MUTCD sign types if they don't exist. Returns count of new records."""
    existing = await db.execute(select(SignType.mutcd_code))
    existing_codes = {row[0] for row in existing.all()}

    new_count = 0
    for st_data in MUTCD_SIGN_TYPES:
        if st_data["mutcd_code"] not in existing_codes:
            db.add(SignType(**st_data))
            new_count += 1

    if new_count > 0:
        await db.commit()

    return new_count
