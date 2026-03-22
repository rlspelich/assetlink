#!/usr/bin/env python3
"""
Generate a realistic CSV of 2,000 signs for Springfield, Illinois.

This mimics what a municipality would export from their GIS system.
All MUTCD codes come from the AssetLink seed data. Street names, coordinates,
and distributions are modeled on real Springfield IL infrastructure.

Usage:
    python scripts/generate_test_signs.py
    # Output: data/springfield_signs_2000.csv
"""

import csv
import os
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
# Build a weighted list: (code, count_target)
DISTRIBUTION = [
    ("R1-1", 500),    # Stop signs — 25%
    ("R2-1", 300),    # Speed Limit — 15%
    ("D1-1", 120),    # Street Name — 6%
    ("D3-1", 80),     # Distance — 4%
    ("W1-1", 55),     # Turn warning
    ("W1-2", 50),     # Curve warning
    ("W2-1", 50),     # Intersection Ahead
    ("W3-1", 45),     # Stop Ahead
    ("R1-2", 60),     # Yield — 3%
    ("S1-1", 40),     # School Zone
    ("S3-1", 15),     # School Speed Limit
    ("S4-3", 5),      # School Crossing
    ("R3-1", 30),     # No Right Turn
    ("R3-2", 30),     # No Left Turn
    ("R1-3", 40),     # Multi-Way Stop Plaque
    ("R5-1", 35),     # Do Not Enter
    ("R6-1", 30),     # One Way (arrow)
    ("R6-2", 15),     # One Way (word)
    ("W11-2", 30),    # Pedestrian Crossing warning
    ("R9-7", 20),     # Pedestrian Crossing regulatory
    ("W3-3", 25),     # Signal Ahead
    ("R7-1", 20),     # No Parking (symbol)
    ("R7-8", 20),     # No Parking Any Time
    ("W14-1", 20),    # Dead End
    ("W14-2", 15),    # No Outlet
    ("D11-1", 20),    # Route Marker
    ("W10-1", 15),    # Railroad Crossing
    ("W8-17", 15),    # Speed Hump
    ("W1-6", 12),     # Large Arrow (chevron)
    ("W1-8", 12),     # Chevron Alignment
    ("R4-7", 12),     # Keep Right
    ("W4-1", 10),     # Merge
    ("W4-2", 10),     # Lane Ends
    ("R10-1", 10),    # Traffic Signal Ahead (reg)
    ("W11-1", 10),    # Bicycle Warning
    ("W11-3", 8),     # Deer Crossing
    ("R2-5", 8),      # End Speed Limit
    ("W8-5", 8),      # Slippery When Wet
    ("R3-4", 8),      # No U-Turn
    ("D9-4", 6),      # Hospital
    ("D9-7", 4),      # Library
    ("D9-8", 3),      # Airport
    ("W6-1", 6),      # Divided Highway Begins
    ("W6-2", 6),      # Divided Highway Ends
    ("W2-2", 8),      # Side Road
    ("W2-3", 8),      # T-Intersection
    ("W5-2", 5),      # Road Narrows
    ("W7-1", 5),      # Hill
    ("W8-1", 5),      # Dip
    ("W8-2", 5),      # Rough Road
    ("W8-3", 5),      # Bump
    ("R7-2", 5),      # No Parking
    ("R8-3", 5),      # No Parking (tow zone)
    ("R10-3", 5),     # Pedestrian Signal
    ("R4-1", 5),      # Do Not Pass
    ("R9-3", 3),      # No Pedestrian Crossing
    ("R2-2", 3),      # Night Speed Limit
    ("R2-3", 3),      # Truck Speed Limit
    ("R2-4", 2),      # Minimum Speed Limit
    ("R3-3", 3),      # No Turns
    ("R3-5a", 3),     # No Right Turn (symbol)
    ("R3-7", 3),      # No Left Turn (symbol)
    ("R3-8", 3),      # No U-Turn (symbol)
    ("W1-3", 3),      # Reverse Turn
    ("W1-4", 3),      # Reverse Curve
    ("W1-5", 2),      # Winding Road
    ("W2-4", 3),      # Y-Intersection
    ("W2-5", 3),      # Circular Intersection
    ("W3-2", 5),      # Yield Ahead
    ("W11-8", 3),     # Fire Station
    ("W11-10", 3),    # Truck Crossing
    ("W12-1", 3),     # Low Clearance
    ("W16-7p", 5),    # Arrow Plaque
    # Construction signs (small count — temporary)
    ("W20-1", 8),     # Road Work Ahead
    ("W20-2", 4),     # Detour Ahead
    ("W20-3", 3),     # Road Closed Ahead
    ("W20-4", 2),     # One Lane Road Ahead
    ("W20-5", 2),     # Lane Ends Ahead
    ("W21-1", 4),     # Worker Symbol
    ("W21-2", 2),     # Flagger Ahead
]

# Build the full list of MUTCD codes
sign_codes: list[str] = []
for code, count in DISTRIBUTION:
    sign_codes.extend([code] * count)

# Pad or trim to exactly NUM_SIGNS
if len(sign_codes) < NUM_SIGNS:
    # Fill remainder with common signs
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

# Cross streets for intersections
CROSS_STREETS = ALL_STREETS.copy()

# ---------------------------------------------------------------------------
# Coordinate zones for Springfield IL
# ---------------------------------------------------------------------------
# Downtown core: denser
DOWNTOWN_CENTER = (39.7998, -89.6440)
DOWNTOWN_SPREAD = (0.005, 0.005)

# Residential zones
RESIDENTIAL_ZONES = [
    (39.8100, -89.6600),   # NW residential
    (39.8100, -89.6300),   # NE residential
    (39.7850, -89.6600),   # SW residential
    (39.7850, -89.6300),   # SE residential
    (39.8200, -89.6500),   # North
    (39.7700, -89.6450),   # South
]
RESIDENTIAL_SPREAD = (0.012, 0.012)

# Outer corridors (arterials)
OUTER_CORRIDORS = [
    (39.8300, -89.6700),   # Far NW — MacArthur area
    (39.8300, -89.6100),   # Far NE — Dirksen area
    (39.7600, -89.6700),   # Far SW — Chatham Rd area
    (39.7600, -89.6100),   # Far SE — Dirksen south
    (39.7550, -89.6450),   # South — Stevenson Dr
]
OUTER_SPREAD = (0.015, 0.020)


def random_coord_in_zone(center: tuple, spread: tuple) -> tuple[float, float]:
    """Generate a random coordinate within a zone."""
    lat = center[0] + random.gauss(0, spread[0] / 2)
    lon = center[1] + random.gauss(0, spread[1] / 2)
    # Clamp to Springfield bounds
    lat = max(39.75, min(39.84, lat))
    lon = max(-89.72, min(-89.59, lon))
    return round(lat, 6), round(lon, 6)


def pick_location(mutcd_code: str, index: int) -> tuple[float, float, str, str | None]:
    """
    Pick a realistic location based on sign type.
    Returns (lat, lon, road_name, cross_street_or_none).
    """
    category = SIGN_TYPES[mutcd_code]["category"]

    # Downtown signs: one-way, no parking, pedestrian
    downtown_codes = {
        "R6-1", "R6-2", "R7-1", "R7-2", "R7-8", "R8-3",
        "R9-3", "R9-7", "R10-3", "W11-2",
    }

    # Outer road signs: speed limit, warning curves, merge, deer
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
        # School signs near residential areas
        zone = random.choice(RESIDENTIAL_ZONES)
        lat, lon = random_coord_in_zone(zone, (0.005, 0.005))
        road = random.choice(RESIDENTIAL_STREETS + DOWNTOWN_STREETS[:4])
        cross = random.choice(ALL_STREETS) if random.random() < 0.7 else None
    elif category == "construction":
        # Construction signs scattered on major roads
        zone = random.choice(OUTER_CORRIDORS + RESIDENTIAL_ZONES[:2])
        lat, lon = random_coord_in_zone(zone, OUTER_SPREAD)
        road = random.choice(MAJOR_ROADS)
        cross = None
    else:
        # General distribution: 40% downtown, 40% residential, 20% outer
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

        # Stop signs almost always at intersections
        if mutcd_code in ("R1-1", "R1-2", "R1-3", "W3-1"):
            cross = random.choice([s for s in ALL_STREETS if s != road])
        elif random.random() < 0.5:
            cross = random.choice([s for s in ALL_STREETS if s != road])
        else:
            cross = None

    return lat, lon, road, cross


# ---------------------------------------------------------------------------
# Date generation — weighted toward more recent
# ---------------------------------------------------------------------------
START_DATE = date(2010, 1, 1)
END_DATE = date(2026, 3, 1)
DATE_RANGE_DAYS = (END_DATE - START_DATE).days


def random_install_date() -> date:
    """Generate install date weighted toward more recent years."""
    # Use a beta distribution skewed toward recent dates
    # alpha=2, beta=1.2 gives more weight to the right (recent)
    fraction = random.betavariate(2.5, 1.3)
    days = int(fraction * DATE_RANGE_DAYS)
    return START_DATE + timedelta(days=days)


# ---------------------------------------------------------------------------
# Status distribution
# ---------------------------------------------------------------------------
STATUS_WEIGHTS = {
    "active": 85,
    "faded": 5,
    "damaged": 3,
    "missing": 2,
    "removed": 2,
    "replaced": 1,
    "obscured": 2,
}
STATUS_CHOICES = []
for status, weight in STATUS_WEIGHTS.items():
    STATUS_CHOICES.extend([status] * weight)


# ---------------------------------------------------------------------------
# Condition rating — correlated with age
# ---------------------------------------------------------------------------
def condition_for_date(install_date: date) -> int:
    """Generate condition rating correlated with install date."""
    age_years = (END_DATE - install_date).days / 365.25

    if age_years < 2:
        # Very new: mostly 5, some 4
        return random.choices([5, 4, 3], weights=[70, 25, 5])[0]
    elif age_years < 5:
        # Recent: mostly 4-5
        return random.choices([5, 4, 3, 2], weights=[30, 45, 20, 5])[0]
    elif age_years < 10:
        # Middle-aged: spread across 2-5
        return random.choices([5, 4, 3, 2, 1], weights=[10, 30, 35, 20, 5])[0]
    else:
        # Old: more 1-3
        return random.choices([5, 4, 3, 2, 1], weights=[5, 15, 30, 30, 20])[0]


# ---------------------------------------------------------------------------
# Sheeting type — correlated with age
# ---------------------------------------------------------------------------
def sheeting_for_date(install_date: date) -> tuple[str, str]:
    """Return (sheeting_type, manufacturer) correlated with install date."""
    year = install_date.year

    if year >= 2022:
        stype = random.choices(
            ["Type XI", "Type IX", "Type III"],
            weights=[40, 35, 25]
        )[0]
    elif year >= 2018:
        stype = random.choices(
            ["Type IX", "Type III", "Type XI", "Type I"],
            weights=[30, 40, 15, 15]
        )[0]
    elif year >= 2015:
        stype = random.choices(
            ["Type III", "Type I", "Type IX"],
            weights=[50, 35, 15]
        )[0]
    else:
        stype = random.choices(
            ["Type I", "Type III"],
            weights=[65, 35]
        )[0]

    # Manufacturer
    if random.random() < 0.15:
        manufacturer = ""  # Unknown/blank
    else:
        manufacturer = random.choices(
            ["3M", "Avery Dennison"],
            weights=[65, 35]
        )[0]

    return stype, manufacturer


# ---------------------------------------------------------------------------
# Speed limit legend text
# ---------------------------------------------------------------------------
SPEED_LIMITS = {
    "R2-1": ["SPEED LIMIT 25", "SPEED LIMIT 30", "SPEED LIMIT 35", "SPEED LIMIT 45"],
}
SPEED_LIMIT_WEIGHTS = [30, 35, 20, 15]  # 25 and 30 most common in city


# ---------------------------------------------------------------------------
# Retroreflectivity and compliance
# ---------------------------------------------------------------------------
def retro_reading(condition: int, sheeting_type: str, install_year: int) -> tuple[str, str]:
    """
    Generate retroreflectivity reading for ~20% of signs.
    Returns (measured_value, passes_minimum) or ("", "").
    """
    # MUTCD minimum for white sheeting: ~50 cd/lx/m2, red: ~7
    # We simplify to a general threshold of 50
    base = {
        "Type XI": 700,
        "Type IX": 500,
        "Type III": 250,
        "Type I": 100,
    }.get(sheeting_type, 150)

    age = 2026 - install_year
    # Degradation: ~5-10% per year for Type I, less for higher types
    degradation_rate = {
        "Type I": 0.08,
        "Type III": 0.05,
        "Type IX": 0.04,
        "Type XI": 0.03,
    }.get(sheeting_type, 0.06)

    current_retro = base * ((1 - degradation_rate) ** age)
    # Add noise
    current_retro *= random.gauss(1.0, 0.15)
    current_retro = max(5, current_retro)

    # Round to whole number
    measured = round(current_retro)
    passes = "true" if measured >= 50 else "false"

    return str(measured), passes


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
    ]

    rows = []
    for i in range(NUM_SIGNS):
        idx = i + 1
        asset_id = f"SGN-{idx:04d}"
        mutcd_code = sign_codes[i]
        info = SIGN_TYPES[mutcd_code]
        category = info["category"]
        description = info["description"]

        # Legend text
        legend_text = ""
        if mutcd_code == "R2-1":
            legend_text = random.choices(
                SPEED_LIMITS["R2-1"], weights=SPEED_LIMIT_WEIGHTS
            )[0]
        elif mutcd_code == "R1-1":
            legend_text = "STOP"
        elif mutcd_code == "R1-2":
            legend_text = "YIELD"
        elif mutcd_code == "R5-1":
            legend_text = "DO NOT ENTER"
        elif mutcd_code in ("R6-1", "R6-2"):
            legend_text = "ONE WAY"
        elif mutcd_code == "R7-8":
            legend_text = "NO PARKING ANY TIME"
        elif mutcd_code == "S1-1":
            legend_text = "SCHOOL ZONE"
        elif mutcd_code == "S3-1":
            legend_text = random.choice(["SCHOOL SPEED LIMIT 20", "SCHOOL SPEED LIMIT 15"])
        elif mutcd_code == "D1-1":
            # Street name sign — use the road it's on
            legend_text = ""  # Will be set after location is picked

        # Location
        lat, lon, road_name, cross_street = pick_location(mutcd_code, idx)

        # For street name signs, legend = the street name
        if mutcd_code == "D1-1":
            legend_text = road_name.upper()

        # Install date
        install_date = random_install_date()

        # Construction signs are recent
        if category == "construction":
            install_date = date(2026, random.randint(1, 3), random.randint(1, 28))

        # Condition
        condition = condition_for_date(install_date)

        # Status — correlate with condition
        if condition == 1:
            status = random.choices(
                ["active", "damaged", "faded", "missing"],
                weights=[20, 30, 30, 20]
            )[0]
        elif condition == 2:
            status = random.choices(
                ["active", "faded", "damaged", "obscured"],
                weights=[50, 25, 15, 10]
            )[0]
        else:
            status = random.choice(STATUS_CHOICES)

        # Sheeting
        sheeting_type, sheeting_mfr = sheeting_for_date(install_date)

        # Construction signs: no sheeting tracking
        if category == "construction":
            sheeting_type = ""
            sheeting_mfr = ""

        # Facing direction (cardinal: 0=N, 90=E, 180=S, 270=W)
        facing = random.choice([0, 90, 180, 270])

        # Side of road
        side_map = {0: "S", 90: "W", 180: "N", 270: "E"}  # Facing traffic
        side = side_map[facing]

        # Mount height (inches) — 72-96, most around 84
        mount_height = round(random.gauss(84, 4))
        mount_height = max(72, min(96, mount_height))

        # Retroreflectivity — ~20% of signs have readings
        measured_value = ""
        passes_minimum = ""
        if random.random() < 0.20 and category != "construction":
            measured_value, passes_minimum = retro_reading(
                condition, sheeting_type, install_date.year
            )

        # Replacement cost — for signs condition <= 2
        replacement_cost = ""
        if condition <= 2:
            replacement_cost = str(random.randint(75, 350))

        # Intersection — for stop signs always, others per pick_location
        intersection = cross_street or ""

        rows.append({
            "Asset_ID": asset_id,
            "MUTCD_Code": mutcd_code,
            "Description": description,
            "Sign_Category": category,
            "Legend_Text": legend_text,
            "Latitude": f"{lat:.6f}",
            "Longitude": f"{lon:.6f}",
            "Road_Name": road_name,
            "Intersection_With": intersection,
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
        })

    # Write CSV
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Generated {len(rows)} signs -> {output_path}")
    print(f"  Unique MUTCD codes used: {len(set(sign_codes))}")

    # Quick stats
    from collections import Counter
    code_counts = Counter(sign_codes)
    print(f"  Top 5 codes: {code_counts.most_common(5)}")
    status_counts = Counter(r['Status'] for r in rows)
    print(f"  Status distribution: {dict(status_counts)}")
    condition_counts = Counter(r['Condition_Rating'] for r in rows)
    print(f"  Condition distribution: {dict(sorted(condition_counts.items()))}")


if __name__ == "__main__":
    generate()
