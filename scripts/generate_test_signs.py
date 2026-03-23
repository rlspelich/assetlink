#!/usr/bin/env python3
"""
Generate a realistic CSV of 2,000 signs with support data for Springfield, Illinois.

Signs are grouped onto supports realistically:
- ~60% share a support with 1-3 other signs (intersections)
- ~30% are on a standalone post (single sign per support)
- ~10% have no support data (legacy/unknown records)

The CSV includes support columns so the smart import auto-detects and creates
supports, linking signs automatically.

Usage:
    python scripts/generate_test_signs.py
    # Output: data/springfield_signs_2000.csv
"""

import csv
import random
from datetime import date, timedelta
from pathlib import Path

# Seed for reproducibility
random.seed(42)

NUM_SIGNS = 2000

# ---------------------------------------------------------------------------
# MUTCD sign types — exact codes from backend/app/db/seed.py
# ---------------------------------------------------------------------------
SIGN_TYPES = {
    # Regulatory
    "R1-1": {"category": "regulatory", "description": "STOP"},
    "R1-2": {"category": "regulatory", "description": "YIELD"},
    "R1-3": {"category": "regulatory", "description": "Multi-Way Stop Plaque"},
    "R2-1": {"category": "regulatory", "description": "Speed Limit"},
    "R2-2": {"category": "regulatory", "description": "Night Speed Limit"},
    "R2-3": {"category": "regulatory", "description": "Truck Speed Limit"},
    "R2-4": {"category": "regulatory", "description": "Minimum Speed Limit"},
    "R2-5": {"category": "regulatory", "description": "End Speed Limit"},
    "R3-1": {"category": "regulatory", "description": "No Right Turn"},
    "R3-2": {"category": "regulatory", "description": "No Left Turn"},
    "R3-3": {"category": "regulatory", "description": "No Turns"},
    "R3-4": {"category": "regulatory", "description": "No U-Turn"},
    "R3-5a": {"category": "regulatory", "description": "No Right Turn (symbol)"},
    "R3-7": {"category": "regulatory", "description": "No Left Turn (symbol)"},
    "R3-8": {"category": "regulatory", "description": "No U-Turn (symbol)"},
    "R4-1": {"category": "regulatory", "description": "Do Not Pass"},
    "R4-7": {"category": "regulatory", "description": "Keep Right"},
    "R5-1": {"category": "regulatory", "description": "Do Not Enter"},
    "R6-1": {"category": "regulatory", "description": "One Way (arrow)"},
    "R6-2": {"category": "regulatory", "description": "One Way (word)"},
    "R7-1": {"category": "regulatory", "description": "No Parking (symbol)"},
    "R7-2": {"category": "regulatory", "description": "No Parking"},
    "R7-8": {"category": "regulatory", "description": "No Parking Any Time"},
    "R8-3": {"category": "regulatory", "description": "No Parking (tow zone)"},
    "R9-3": {"category": "regulatory", "description": "No Pedestrian Crossing"},
    "R9-7": {"category": "regulatory", "description": "Pedestrian Crossing"},
    "R10-1": {"category": "regulatory", "description": "Traffic Signal Ahead"},
    "R10-3": {"category": "regulatory", "description": "Pedestrian Signal (push button)"},
    # Warning
    "W1-1": {"category": "warning", "description": "Turn (right)"},
    "W1-2": {"category": "warning", "description": "Curve (right)"},
    "W1-3": {"category": "warning", "description": "Reverse Turn"},
    "W1-4": {"category": "warning", "description": "Reverse Curve"},
    "W1-5": {"category": "warning", "description": "Winding Road"},
    "W1-6": {"category": "warning", "description": "Large Arrow (chevron)"},
    "W1-8": {"category": "warning", "description": "Chevron Alignment"},
    "W2-1": {"category": "warning", "description": "Intersection Ahead"},
    "W2-2": {"category": "warning", "description": "Side Road (right)"},
    "W2-3": {"category": "warning", "description": "T-Intersection"},
    "W2-4": {"category": "warning", "description": "Y-Intersection"},
    "W2-5": {"category": "warning", "description": "Circular Intersection"},
    "W3-1": {"category": "warning", "description": "Stop Ahead"},
    "W3-2": {"category": "warning", "description": "Yield Ahead"},
    "W3-3": {"category": "warning", "description": "Signal Ahead"},
    "W4-1": {"category": "warning", "description": "Merge"},
    "W4-2": {"category": "warning", "description": "Lane Ends"},
    "W5-2": {"category": "warning", "description": "Road Narrows"},
    "W6-1": {"category": "warning", "description": "Divided Highway Begins"},
    "W6-2": {"category": "warning", "description": "Divided Highway Ends"},
    "W7-1": {"category": "warning", "description": "Hill"},
    "W8-1": {"category": "warning", "description": "Dip"},
    "W8-2": {"category": "warning", "description": "Rough Road"},
    "W8-3": {"category": "warning", "description": "Bump"},
    "W8-5": {"category": "warning", "description": "Slippery When Wet"},
    "W8-17": {"category": "warning", "description": "Speed Hump"},
    "W10-1": {"category": "warning", "description": "Railroad Crossing Advance"},
    "W11-1": {"category": "warning", "description": "Bicycle Warning"},
    "W11-2": {"category": "warning", "description": "Pedestrian Crossing"},
    "W11-3": {"category": "warning", "description": "Deer Crossing"},
    "W11-8": {"category": "warning", "description": "Fire Station"},
    "W11-10": {"category": "warning", "description": "Truck Crossing"},
    "W12-1": {"category": "warning", "description": "Low Clearance"},
    "W14-1": {"category": "warning", "description": "Dead End / No Outlet"},
    "W14-2": {"category": "warning", "description": "No Outlet"},
    "W16-7p": {"category": "warning", "description": "Arrow Plaque (auxiliary)"},
    # School
    "S1-1": {"category": "school", "description": "School Zone"},
    "S3-1": {"category": "school", "description": "School Speed Limit"},
    "S4-3": {"category": "school", "description": "School Crossing"},
    # Guide
    "D1-1": {"category": "guide", "description": "Street Name Sign"},
    "D3-1": {"category": "guide", "description": "Distance Sign"},
    "D9-4": {"category": "guide", "description": "Hospital"},
    "D9-7": {"category": "guide", "description": "Library"},
    "D9-8": {"category": "guide", "description": "Airport"},
    "D11-1": {"category": "guide", "description": "Route Marker"},
    # Construction
    "W20-1": {"category": "construction", "description": "Road Work Ahead"},
    "W20-2": {"category": "construction", "description": "Detour Ahead"},
    "W20-3": {"category": "construction", "description": "Road Closed Ahead"},
    "W20-4": {"category": "construction", "description": "One Lane Road Ahead"},
    "W20-5": {"category": "construction", "description": "Lane Ends Ahead"},
    "W21-1": {"category": "construction", "description": "Worker Symbol"},
    "W21-2": {"category": "construction", "description": "Flagger Ahead"},
}

# ---------------------------------------------------------------------------
# Distribution of sign types (weighted to match real municipal inventory)
# ---------------------------------------------------------------------------
DISTRIBUTION = [
    ("R1-1", 500), ("R2-1", 300), ("D1-1", 120), ("D3-1", 80),
    ("W1-1", 55), ("W1-2", 50), ("W2-1", 50), ("W3-1", 45),
    ("R1-2", 60), ("S1-1", 40), ("S3-1", 15), ("S4-3", 5),
    ("R3-1", 30), ("R3-2", 30), ("R1-3", 40), ("R5-1", 35),
    ("R6-1", 30), ("R6-2", 15), ("W11-2", 30), ("R9-7", 20),
    ("W3-3", 25), ("R7-1", 20), ("R7-8", 20), ("W14-1", 20),
    ("W14-2", 15), ("D11-1", 20), ("W10-1", 15), ("W8-17", 15),
    ("W1-6", 12), ("W1-8", 12), ("R4-7", 12), ("W4-1", 10),
    ("W4-2", 10), ("R10-1", 10), ("W11-1", 10), ("W11-3", 8),
    ("R2-5", 8), ("W8-5", 8), ("R3-4", 8), ("D9-4", 6),
    ("D9-7", 4), ("D9-8", 3), ("W6-1", 6), ("W6-2", 6),
    ("W2-2", 8), ("W2-3", 8), ("W5-2", 5), ("W7-1", 5),
    ("W8-1", 5), ("W8-2", 5), ("W8-3", 5), ("R7-2", 5),
    ("R8-3", 5), ("R10-3", 5), ("R4-1", 5), ("R9-3", 3),
    ("R2-2", 3), ("R2-3", 3), ("R2-4", 2), ("R3-3", 3),
    ("R3-5a", 3), ("R3-7", 3), ("R3-8", 3), ("W1-3", 3),
    ("W1-4", 3), ("W1-5", 2), ("W2-4", 3), ("W2-5", 3),
    ("W3-2", 5), ("W11-8", 3), ("W11-10", 3), ("W12-1", 3),
    ("W16-7p", 5),
    ("W20-1", 8), ("W20-2", 4), ("W20-3", 3), ("W20-4", 2),
    ("W20-5", 2), ("W21-1", 4), ("W21-2", 2),
]

sign_codes: list[str] = []
for code, count in DISTRIBUTION:
    sign_codes.extend([code] * count)
if len(sign_codes) < NUM_SIGNS:
    extras = ["R1-1", "R2-1", "D1-1", "W2-1", "W3-1", "R1-2", "W1-1", "W1-2"]
    while len(sign_codes) < NUM_SIGNS:
        sign_codes.append(random.choice(extras))
elif len(sign_codes) > NUM_SIGNS:
    sign_codes = sign_codes[:NUM_SIGNS]
random.shuffle(sign_codes)

# ---------------------------------------------------------------------------
# Springfield IL streets
# ---------------------------------------------------------------------------
MAJOR_ROADS = [
    "MacArthur Blvd", "Wabash Ave", "Veterans Pkwy", "Dirksen Pkwy",
    "Stevenson Dr", "Chatham Rd", "Toronto Rd", "Iles Ave",
    "South Grand Ave", "North Grand Ave", "Peoria Rd",
    "J David Jones Pkwy", "Meadowbrook Rd", "Lindbergh Blvd",
    "Koke Mill Rd", "Old Jacksonville Rd", "Archer Elevator Rd",
]

DOWNTOWN_STREETS = [
    "Monroe St", "Jefferson St", "Washington St", "Adams St",
    "Capitol Ave", "Cook St", "5th St", "6th St", "2nd St",
    "9th St", "11th St", "Spring St", "Edwards St",
]

RESIDENTIAL_STREETS = [
    "Lawrence Ave", "Sangamon Ave", "Grand Ave", "Clear Lake Ave",
    "Martin Luther King Dr", "Stanford Ave", "Ash St", "Walnut St",
    "Pasfield St", "Glenwood Ave", "Rutledge St", "Allen St",
    "Black Ave", "Bruns Ln", "White Oaks Ln", "Montvale Dr",
]

ALL_STREETS = MAJOR_ROADS + DOWNTOWN_STREETS + RESIDENTIAL_STREETS
CROSS_STREETS = ALL_STREETS.copy()

# ---------------------------------------------------------------------------
# Coordinate zones for Springfield IL
# ---------------------------------------------------------------------------
DOWNTOWN_CENTER = (39.7998, -89.6440)
DOWNTOWN_SPREAD = (0.005, 0.005)

RESIDENTIAL_ZONES = [
    (39.8100, -89.6600), (39.8100, -89.6300),
    (39.7850, -89.6600), (39.7850, -89.6300),
    (39.8200, -89.6500), (39.7700, -89.6450),
]
RESIDENTIAL_SPREAD = (0.012, 0.012)

OUTER_CORRIDORS = [
    (39.8300, -89.6700), (39.8300, -89.6100),
    (39.7600, -89.6700), (39.7600, -89.6100),
    (39.7550, -89.6450),
]
OUTER_SPREAD = (0.015, 0.020)

# ---------------------------------------------------------------------------
# Support types and materials
# ---------------------------------------------------------------------------
SUPPORT_TYPES = [
    ("u_channel", 45),      # Most common — cheap, standard
    ("square_tube", 25),    # Common for newer installs
    ("round_tube", 10),     # Less common
    ("wood", 8),            # Older, residential
    ("mast_arm", 5),        # Major intersections
    ("span_wire", 4),       # Overhead
    ("wall_mount", 3),      # Downtown buildings
]

SUPPORT_MATERIALS = {
    "u_channel": [("galvanized_steel", 70), ("aluminum", 30)],
    "square_tube": [("aluminum", 60), ("galvanized_steel", 40)],
    "round_tube": [("galvanized_steel", 50), ("aluminum", 50)],
    "wood": [("wood", 90), ("treated_wood", 10)],
    "mast_arm": [("steel", 80), ("galvanized_steel", 20)],
    "span_wire": [("steel", 100)],
    "wall_mount": [("steel", 60), ("aluminum", 40)],
}

SUPPORT_HEIGHTS = {
    "u_channel": (84, 6),      # 84" avg, 6" std
    "square_tube": (84, 6),
    "round_tube": (84, 6),
    "wood": (96, 8),           # Taller, older
    "mast_arm": (180, 24),     # Much taller
    "span_wire": (216, 12),    # Overhead
    "wall_mount": (96, 6),
}


def pick_support_type() -> tuple[str, str, int]:
    """Pick support type, material, and height."""
    types, weights = zip(*SUPPORT_TYPES)
    stype = random.choices(types, weights=weights)[0]

    materials, mweights = zip(*SUPPORT_MATERIALS[stype])
    material = random.choices(materials, weights=mweights)[0]

    avg_h, std_h = SUPPORT_HEIGHTS[stype]
    height = round(random.gauss(avg_h, std_h))
    height = max(60, min(300, height))

    return stype, material, height


def random_coord_in_zone(center: tuple, spread: tuple) -> tuple[float, float]:
    lat = center[0] + random.gauss(0, spread[0] / 2)
    lon = center[1] + random.gauss(0, spread[1] / 2)
    lat = max(39.75, min(39.84, lat))
    lon = max(-89.72, min(-89.59, lon))
    return round(lat, 6), round(lon, 6)


def pick_location(mutcd_code: str) -> tuple[float, float, str, str | None]:
    category = SIGN_TYPES[mutcd_code]["category"]
    downtown_codes = {
        "R6-1", "R6-2", "R7-1", "R7-2", "R7-8", "R8-3",
        "R9-3", "R9-7", "R10-3", "W11-2",
    }
    outer_codes = {
        "W1-1", "W1-2", "W1-3", "W1-4", "W1-5", "W4-1", "W4-2",
        "W5-2", "W6-1", "W6-2", "W7-1", "W11-3", "W11-10",
        "R4-1", "W12-1",
    }

    if mutcd_code in downtown_codes or (mutcd_code == "R1-1" and random.random() < 0.3):
        lat, lon = random_coord_in_zone(DOWNTOWN_CENTER, DOWNTOWN_SPREAD)
        road = random.choice(DOWNTOWN_STREETS)
        cross = random.choice([s for s in DOWNTOWN_STREETS if s != road])
    elif mutcd_code in outer_codes:
        zone = random.choice(OUTER_CORRIDORS)
        lat, lon = random_coord_in_zone(zone, OUTER_SPREAD)
        road = random.choice(MAJOR_ROADS)
        cross = random.choice(ALL_STREETS) if random.random() < 0.4 else None
    elif category == "school":
        zone = random.choice(RESIDENTIAL_ZONES)
        lat, lon = random_coord_in_zone(zone, (0.005, 0.005))
        road = random.choice(RESIDENTIAL_STREETS + DOWNTOWN_STREETS[:4])
        cross = random.choice(ALL_STREETS) if random.random() < 0.7 else None
    elif category == "construction":
        zone = random.choice(OUTER_CORRIDORS + RESIDENTIAL_ZONES[:2])
        lat, lon = random_coord_in_zone(zone, OUTER_SPREAD)
        road = random.choice(MAJOR_ROADS)
        cross = None
    else:
        r = random.random()
        if r < 0.35:
            lat, lon = random_coord_in_zone(DOWNTOWN_CENTER, (0.008, 0.008))
            road = random.choice(DOWNTOWN_STREETS + MAJOR_ROADS[:4])
        elif r < 0.75:
            zone = random.choice(RESIDENTIAL_ZONES)
            lat, lon = random_coord_in_zone(zone, RESIDENTIAL_SPREAD)
            road = random.choice(RESIDENTIAL_STREETS + MAJOR_ROADS[:6])
        else:
            zone = random.choice(OUTER_CORRIDORS)
            lat, lon = random_coord_in_zone(zone, OUTER_SPREAD)
            road = random.choice(MAJOR_ROADS)

        if mutcd_code in ("R1-1", "R1-2", "R1-3", "W3-1"):
            cross = random.choice([s for s in ALL_STREETS if s != road])
        elif random.random() < 0.5:
            cross = random.choice([s for s in ALL_STREETS if s != road])
        else:
            cross = None

    return lat, lon, road, cross


# ---------------------------------------------------------------------------
# Date, condition, sheeting, retro — same as before
# ---------------------------------------------------------------------------
START_DATE = date(2010, 1, 1)
END_DATE = date(2026, 3, 1)
DATE_RANGE_DAYS = (END_DATE - START_DATE).days


def random_install_date() -> date:
    fraction = random.betavariate(2.5, 1.3)
    days = int(fraction * DATE_RANGE_DAYS)
    return START_DATE + timedelta(days=days)


STATUS_WEIGHTS = {
    "active": 85, "faded": 5, "damaged": 3, "missing": 2,
    "removed": 2, "replaced": 1, "obscured": 2,
}
STATUS_CHOICES = []
for status, weight in STATUS_WEIGHTS.items():
    STATUS_CHOICES.extend([status] * weight)

SUPPORT_STATUS_WEIGHTS = {
    "active": 88, "damaged": 5, "leaning": 3, "rusted": 2, "missing": 2,
}
SUPPORT_STATUS_CHOICES = []
for status, weight in SUPPORT_STATUS_WEIGHTS.items():
    SUPPORT_STATUS_CHOICES.extend([status] * weight)


def condition_for_date(install_date: date) -> int:
    age_years = (END_DATE - install_date).days / 365.25
    if age_years < 2:
        return random.choices([5, 4, 3], weights=[70, 25, 5])[0]
    elif age_years < 5:
        return random.choices([5, 4, 3, 2], weights=[30, 45, 20, 5])[0]
    elif age_years < 10:
        return random.choices([5, 4, 3, 2, 1], weights=[10, 30, 35, 20, 5])[0]
    else:
        return random.choices([5, 4, 3, 2, 1], weights=[5, 15, 30, 30, 20])[0]


def sheeting_for_date(install_date: date) -> tuple[str, str]:
    year = install_date.year
    if year >= 2022:
        stype = random.choices(["Type XI", "Type IX", "Type III"], weights=[40, 35, 25])[0]
    elif year >= 2018:
        stype = random.choices(["Type IX", "Type III", "Type XI", "Type I"], weights=[30, 40, 15, 15])[0]
    elif year >= 2015:
        stype = random.choices(["Type III", "Type I", "Type IX"], weights=[50, 35, 15])[0]
    else:
        stype = random.choices(["Type I", "Type III"], weights=[65, 35])[0]
    if random.random() < 0.15:
        manufacturer = ""
    else:
        manufacturer = random.choices(["3M", "Avery Dennison"], weights=[65, 35])[0]
    return stype, manufacturer


SPEED_LIMITS = {"R2-1": ["SPEED LIMIT 25", "SPEED LIMIT 30", "SPEED LIMIT 35", "SPEED LIMIT 45"]}
SPEED_LIMIT_WEIGHTS = [30, 35, 20, 15]


def retro_reading(condition: int, sheeting_type: str, install_year: int) -> tuple[str, str]:
    base = {"Type XI": 700, "Type IX": 500, "Type III": 250, "Type I": 100}.get(sheeting_type, 150)
    age = 2026 - install_year
    degradation_rate = {"Type I": 0.08, "Type III": 0.05, "Type IX": 0.04, "Type XI": 0.03}.get(sheeting_type, 0.06)
    current_retro = base * ((1 - degradation_rate) ** age)
    current_retro *= random.gauss(1.0, 0.15)
    current_retro = max(5, current_retro)
    measured = round(current_retro)
    passes = "true" if measured >= 50 else "false"
    return str(measured), passes


# ---------------------------------------------------------------------------
# Signs that commonly appear together on the same support
# ---------------------------------------------------------------------------
# At a typical intersection, you might see:
# - Stop sign (R1-1) + Multi-Way plaque (R1-3) + Street name (D1-1)
# - Stop sign (R1-1) + Street name (D1-1)
# - Speed limit (R2-1) + Street name (D1-1)
# - School zone (S1-1) + School speed limit (S3-1)
# - One Way (R6-1) + Do Not Enter (R5-1)
# - No parking (R7-8) + Street name (D1-1)
MULTI_SIGN_COMBOS = [
    # (additional signs to add to the support alongside the primary)
    # Stop + Multi-Way + Street Name (3 signs on one post)
    (["R1-1", "R1-3", "D1-1"], 80),
    # Stop + Street Name (2 signs)
    (["R1-1", "D1-1"], 120),
    # Stop + Multi-Way (2 signs)
    (["R1-1", "R1-3"], 60),
    # Speed Limit + Street Name (2 signs)
    (["R2-1", "D1-1"], 50),
    # School Zone + School Speed (2 signs)
    (["S1-1", "S3-1"], 15),
    # One Way + Do Not Enter (2 signs)
    (["R6-1", "R5-1"], 20),
    # No Parking + Street Name (2 signs)
    (["R7-8", "D1-1"], 15),
    # Ped Crossing Warning + Ped Crossing Regulatory (2 signs)
    (["W11-2", "R9-7"], 10),
    # Stop Ahead + Arrow plaque (2 signs)
    (["W3-1", "W16-7p"], 8),
    # Dead End + Street Name (2 signs)
    (["W14-1", "D1-1"], 10),
    # Stop + Multi-Way + Street Name + Street Name (4 signs — corner with both streets)
    (["R1-1", "R1-3", "D1-1", "D1-1"], 25),
]


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------
def generate():
    output_dir = Path(__file__).resolve().parent.parent / "data"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / "springfield_signs_2000.csv"

    fieldnames = [
        "Asset_ID", "MUTCD_Code", "Description", "Sign_Category", "Legend_Text",
        "Latitude", "Longitude", "Road_Name", "Intersection_With",
        "Condition_Rating", "Status", "Install_Date",
        "Sheeting_Type", "Sheeting_Manufacturer",
        "Facing_Direction", "Side_of_Road", "Mount_Height",
        "Measured_Value", "Passes_Minimum", "Replacement_Cost",
        # Support columns — auto-detected by smart import
        "Support_Tag", "Support_Type", "Support_Material",
        "Support_Height_Inches", "Support_Condition", "Support_Status",
        "Support_Install_Date",
    ]

    rows = []
    sign_idx = 0
    support_idx = 0

    # -----------------------------------------------------------------------
    # Phase 1: Generate multi-sign supports (~60% of signs)
    # -----------------------------------------------------------------------
    target_multi = int(NUM_SIGNS * 0.60)
    multi_sign_count = 0

    # Build weighted list of combos
    combos_list = []
    combos_weights = []
    for combo, weight in MULTI_SIGN_COMBOS:
        combos_list.append(combo)
        combos_weights.append(weight)

    while multi_sign_count < target_multi:
        # Pick a combo
        combo = random.choices(combos_list, weights=combos_weights)[0]

        # This support's location is based on the first sign in the combo
        primary_code = combo[0]
        lat, lon, road_name, cross_street = pick_location(primary_code)

        # Support properties
        support_idx += 1
        support_tag = f"SUP-{support_idx:04d}"
        stype, smaterial, sheight = pick_support_type()
        support_install = random_install_date()
        support_condition = condition_for_date(support_install)
        support_status = random.choice(SUPPORT_STATUS_CHOICES)

        # Correlate support condition with damage
        if support_condition <= 2:
            support_status = random.choices(
                ["active", "damaged", "leaning", "rusted"],
                weights=[20, 35, 30, 15]
            )[0]

        # Generate each sign in the combo
        for i, mutcd_code in enumerate(combo):
            sign_idx += 1
            if sign_idx > NUM_SIGNS:
                break

            info = SIGN_TYPES[mutcd_code]

            # Legend text
            legend_text = _get_legend_text(mutcd_code, road_name, cross_street, i)

            # Sign install date — may differ from support (replacement)
            if random.random() < 0.3:
                # Sign was replaced — newer than support
                sign_install = support_install + timedelta(days=random.randint(365, 2000))
                if sign_install > END_DATE:
                    sign_install = support_install
            else:
                sign_install = support_install

            condition = condition_for_date(sign_install)
            if condition == 1:
                status = random.choices(
                    ["active", "damaged", "faded", "missing"], weights=[20, 30, 30, 20]
                )[0]
            elif condition == 2:
                status = random.choices(
                    ["active", "faded", "damaged", "obscured"], weights=[50, 25, 15, 10]
                )[0]
            else:
                status = random.choice(STATUS_CHOICES)

            sheeting_type, sheeting_mfr = sheeting_for_date(sign_install)
            if info["category"] == "construction":
                sheeting_type = ""
                sheeting_mfr = ""

            facing = random.choice([0, 90, 180, 270])
            side_map = {0: "S", 90: "W", 180: "N", 270: "E"}
            side = side_map[facing]
            mount_height = round(random.gauss(84, 4))
            mount_height = max(72, min(96, mount_height))

            measured_value = ""
            passes_minimum = ""
            if random.random() < 0.20 and info["category"] != "construction":
                measured_value, passes_minimum = retro_reading(
                    condition, sheeting_type, sign_install.year
                )

            replacement_cost = ""
            if condition <= 2:
                replacement_cost = str(random.randint(75, 350))

            rows.append({
                "Asset_ID": f"SGN-{sign_idx:04d}",
                "MUTCD_Code": mutcd_code,
                "Description": info["description"],
                "Sign_Category": info["category"],
                "Legend_Text": legend_text,
                "Latitude": f"{lat:.6f}",
                "Longitude": f"{lon:.6f}",
                "Road_Name": road_name,
                "Intersection_With": cross_street or "",
                "Condition_Rating": str(condition),
                "Status": status,
                "Install_Date": sign_install.strftime("%m/%d/%Y"),
                "Sheeting_Type": sheeting_type,
                "Sheeting_Manufacturer": sheeting_mfr,
                "Facing_Direction": str(facing),
                "Side_of_Road": side,
                "Mount_Height": str(mount_height),
                "Measured_Value": measured_value,
                "Passes_Minimum": passes_minimum,
                "Replacement_Cost": replacement_cost,
                "Support_Tag": support_tag,
                "Support_Type": stype,
                "Support_Material": smaterial,
                "Support_Height_Inches": str(sheight),
                "Support_Condition": str(support_condition),
                "Support_Status": support_status,
                "Support_Install_Date": support_install.strftime("%m/%d/%Y"),
            })
            multi_sign_count += 1

        if sign_idx >= NUM_SIGNS:
            break

    # -----------------------------------------------------------------------
    # Phase 2: Single-sign supports (~30% of signs)
    # -----------------------------------------------------------------------
    target_single = int(NUM_SIGNS * 0.30)
    single_count = 0

    while single_count < target_single and sign_idx < NUM_SIGNS:
        sign_idx += 1
        support_idx += 1

        # Pick from remaining sign codes
        code_idx = sign_idx - 1
        if code_idx < len(sign_codes):
            mutcd_code = sign_codes[code_idx]
        else:
            mutcd_code = random.choice(["R1-1", "R2-1", "D1-1", "W3-1"])

        info = SIGN_TYPES[mutcd_code]
        lat, lon, road_name, cross_street = pick_location(mutcd_code)

        support_tag = f"SUP-{support_idx:04d}"
        stype, smaterial, sheight = pick_support_type()
        install_date = random_install_date()

        if info["category"] == "construction":
            install_date = date(2026, random.randint(1, 3), random.randint(1, 28))

        condition = condition_for_date(install_date)
        support_condition = condition  # Single sign — support matches

        if condition == 1:
            status = random.choices(
                ["active", "damaged", "faded", "missing"], weights=[20, 30, 30, 20]
            )[0]
        elif condition == 2:
            status = random.choices(
                ["active", "faded", "damaged", "obscured"], weights=[50, 25, 15, 10]
            )[0]
        else:
            status = random.choice(STATUS_CHOICES)

        support_status = random.choice(SUPPORT_STATUS_CHOICES)
        if support_condition <= 2:
            support_status = random.choices(
                ["active", "damaged", "leaning", "rusted"], weights=[20, 35, 30, 15]
            )[0]

        sheeting_type, sheeting_mfr = sheeting_for_date(install_date)
        if info["category"] == "construction":
            sheeting_type = ""
            sheeting_mfr = ""

        legend_text = _get_legend_text(mutcd_code, road_name, cross_street, 0)
        facing = random.choice([0, 90, 180, 270])
        side_map = {0: "S", 90: "W", 180: "N", 270: "E"}
        side = side_map[facing]
        mount_height = round(random.gauss(84, 4))
        mount_height = max(72, min(96, mount_height))

        measured_value = ""
        passes_minimum = ""
        if random.random() < 0.20 and info["category"] != "construction":
            measured_value, passes_minimum = retro_reading(
                condition, sheeting_type, install_date.year
            )

        replacement_cost = ""
        if condition <= 2:
            replacement_cost = str(random.randint(75, 350))

        rows.append({
            "Asset_ID": f"SGN-{sign_idx:04d}",
            "MUTCD_Code": mutcd_code,
            "Description": info["description"],
            "Sign_Category": info["category"],
            "Legend_Text": legend_text,
            "Latitude": f"{lat:.6f}",
            "Longitude": f"{lon:.6f}",
            "Road_Name": road_name,
            "Intersection_With": cross_street or "",
            "Condition_Rating": str(condition),
            "Status": status,
            "Install_Date": install_date.strftime("%m/%d/%Y"),
            "Sheeting_Type": sheeting_type,
            "Sheeting_Manufacturer": sheeting_mfr,
            "Facing_Direction": str(facing),
            "Side_of_Road": side,
            "Mount_Height": str(mount_height),
            "Measured_Value": measured_value,
            "Passes_Minimum": passes_minimum,
            "Replacement_Cost": replacement_cost,
            "Support_Tag": support_tag,
            "Support_Type": stype,
            "Support_Material": smaterial,
            "Support_Height_Inches": str(sheight),
            "Support_Condition": str(support_condition),
            "Support_Status": support_status,
            "Support_Install_Date": install_date.strftime("%m/%d/%Y"),
        })
        single_count += 1

    # -----------------------------------------------------------------------
    # Phase 3: Signs with no support data (~10%)
    # -----------------------------------------------------------------------
    while sign_idx < NUM_SIGNS:
        sign_idx += 1
        code_idx = sign_idx - 1
        if code_idx < len(sign_codes):
            mutcd_code = sign_codes[code_idx]
        else:
            mutcd_code = random.choice(["R1-1", "R2-1", "D1-1"])

        info = SIGN_TYPES[mutcd_code]
        lat, lon, road_name, cross_street = pick_location(mutcd_code)
        install_date = random_install_date()

        if info["category"] == "construction":
            install_date = date(2026, random.randint(1, 3), random.randint(1, 28))

        condition = condition_for_date(install_date)
        if condition == 1:
            status = random.choices(
                ["active", "damaged", "faded", "missing"], weights=[20, 30, 30, 20]
            )[0]
        elif condition == 2:
            status = random.choices(
                ["active", "faded", "damaged", "obscured"], weights=[50, 25, 15, 10]
            )[0]
        else:
            status = random.choice(STATUS_CHOICES)

        sheeting_type, sheeting_mfr = sheeting_for_date(install_date)
        if info["category"] == "construction":
            sheeting_type = ""
            sheeting_mfr = ""

        legend_text = _get_legend_text(mutcd_code, road_name, cross_street, 0)
        facing = random.choice([0, 90, 180, 270])
        side_map = {0: "S", 90: "W", 180: "N", 270: "E"}
        side = side_map[facing]
        mount_height = round(random.gauss(84, 4))
        mount_height = max(72, min(96, mount_height))

        measured_value = ""
        passes_minimum = ""
        if random.random() < 0.20 and info["category"] != "construction":
            measured_value, passes_minimum = retro_reading(
                condition, sheeting_type, install_date.year
            )

        replacement_cost = ""
        if condition <= 2:
            replacement_cost = str(random.randint(75, 350))

        rows.append({
            "Asset_ID": f"SGN-{sign_idx:04d}",
            "MUTCD_Code": mutcd_code,
            "Description": info["description"],
            "Sign_Category": info["category"],
            "Legend_Text": legend_text,
            "Latitude": f"{lat:.6f}",
            "Longitude": f"{lon:.6f}",
            "Road_Name": road_name,
            "Intersection_With": cross_street or "",
            "Condition_Rating": str(condition),
            "Status": status,
            "Install_Date": install_date.strftime("%m/%d/%Y"),
            "Sheeting_Type": sheeting_type,
            "Sheeting_Manufacturer": sheeting_mfr,
            "Facing_Direction": str(facing),
            "Side_of_Road": side,
            "Mount_Height": str(mount_height),
            "Measured_Value": measured_value,
            "Passes_Minimum": passes_minimum,
            "Replacement_Cost": replacement_cost,
            # No support data — legacy records
            "Support_Tag": "",
            "Support_Type": "",
            "Support_Material": "",
            "Support_Height_Inches": "",
            "Support_Condition": "",
            "Support_Status": "",
            "Support_Install_Date": "",
        })

    # Write CSV
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)

    # Stats
    total = len(rows)
    with_support = sum(1 for r in rows if r["Support_Tag"])
    without_support = total - with_support
    unique_supports = len(set(r["Support_Tag"] for r in rows if r["Support_Tag"]))
    multi_support_tags = {}
    for r in rows:
        tag = r["Support_Tag"]
        if tag:
            multi_support_tags[tag] = multi_support_tags.get(tag, 0) + 1
    multi_sign_supports = sum(1 for c in multi_support_tags.values() if c > 1)
    single_sign_supports = sum(1 for c in multi_support_tags.values() if c == 1)

    from collections import Counter
    signs_per_support = Counter(multi_support_tags.values())

    print(f"Generated {total} signs -> {output_path}")
    print(f"  Unique MUTCD codes: {len(set(r['MUTCD_Code'] for r in rows))}")
    print(f"  Signs with support: {with_support} ({with_support*100//total}%)")
    print(f"  Signs without support: {without_support} ({without_support*100//total}%)")
    print(f"  Unique supports: {unique_supports}")
    print(f"  Multi-sign supports: {multi_sign_supports} (2+ signs on one post)")
    print(f"  Single-sign supports: {single_sign_supports}")
    print(f"  Signs per support distribution: {dict(sorted(signs_per_support.items()))}")

    code_counts = Counter(r['MUTCD_Code'] for r in rows)
    print(f"  Top 5 codes: {code_counts.most_common(5)}")
    status_counts = Counter(r['Status'] for r in rows)
    print(f"  Status: {dict(status_counts)}")
    condition_counts = Counter(r['Condition_Rating'] for r in rows)
    print(f"  Condition: {dict(sorted(condition_counts.items()))}")


def _get_legend_text(mutcd_code: str, road_name: str, cross_street: str | None, sign_index: int) -> str:
    """Generate legend text for a sign based on its type."""
    if mutcd_code == "R2-1":
        return random.choices(SPEED_LIMITS["R2-1"], weights=SPEED_LIMIT_WEIGHTS)[0]
    elif mutcd_code == "R1-1":
        return "STOP"
    elif mutcd_code == "R1-2":
        return "YIELD"
    elif mutcd_code == "R5-1":
        return "DO NOT ENTER"
    elif mutcd_code in ("R6-1", "R6-2"):
        return "ONE WAY"
    elif mutcd_code == "R7-8":
        return "NO PARKING ANY TIME"
    elif mutcd_code == "S1-1":
        return "SCHOOL ZONE"
    elif mutcd_code == "S3-1":
        return random.choice(["SCHOOL SPEED LIMIT 20", "SCHOOL SPEED LIMIT 15"])
    elif mutcd_code == "D1-1":
        # Street name — if it's the second D1-1 on a support, use cross street
        if sign_index > 0 and cross_street:
            return cross_street.upper()
        return road_name.upper()
    return ""


if __name__ == "__main__":
    generate()
