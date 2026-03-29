#!/usr/bin/env python3
"""
Generate work orders and inspections for water and sewer assets in Springfield, IL.

Creates:
  ~50 water work orders  (valve exercise, main break, hydrant repair, service leak, etc.)
  ~40 sewer work orders  (main blockage, manhole rehab, lift station, CCTV, lateral issue)
  ~60 water inspections  (valve exercise, hydrant flow test, main condition, service line)
  ~50 sewer inspections  (CCTV, manhole inspection, lift station check, PACP coding)

Assumes generate_water_sewer.py has already been run to create the base assets.

Run:  docker compose exec -e PYTHONPATH=/app api python scripts/generate_water_sewer_wo_insp.py
Prod: docker compose exec -e PYTHONPATH=/app \\
        -e DATABASE_URL="postgresql+asyncpg://..." \\
        -e DATABASE_URL_SYNC="postgresql://..." \\
        api python scripts/generate_water_sewer_wo_insp.py
"""

import asyncio
import random
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# ---- Configuration ----
PROD_TENANT_ID = "22222222-2222-2222-2222-222222222222"
DEV_TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

# Springfield IL
EW_STREETS = [
    "E Capitol Ave", "E Adams St", "E Monroe St", "E Jefferson St",
    "E Washington St", "E Madison St", "E Cook St", "E Edwards St",
    "E Lawrence Ave", "E Carpenter St", "E Jackson St", "E Allen St",
]
NS_STREETS = [
    "N 1st St", "N 2nd St", "N 3rd St", "N 4th St", "N 5th St",
    "N 6th St", "N 7th St", "N 8th St", "N 9th St", "N College St",
]

# ---- Work order templates ----
WATER_WO_TEMPLATES = [
    {
        "work_type": "repair",
        "priority": "emergency",
        "descriptions": [
            "Water main break — {street}",
            "Emergency main break, water surfacing at {street}",
            "6-inch main break, road flooding near {street}",
        ],
        "instructions": [
            "Isolate break with upstream/downstream valves. Repair with full-circle clamp or cut-and-replace. Notify customers of shutoff.",
            "Close valves on both sides. Excavate and assess. Install repair sleeve or replace section.",
        ],
        "asset_types": ["water_main"],
        "categories": ["Main Break"],
        "resolution_options": ["Full-circle repair clamp installed", "6ft section replaced with DI", "Sleeve repair completed", "Joint repacked and sealed"],
        "labor_hours_range": (4, 16),
        "material_cost_range": (500, 5000),
    },
    {
        "work_type": "repair",
        "priority": "urgent",
        "descriptions": [
            "Hydrant leaking at base — {street}",
            "Fire hydrant damaged by vehicle — {street}",
            "Hydrant won't shut off completely — {street}",
        ],
        "instructions": [
            "Isolate hydrant. Replace drain valve and nozzle gaskets. Flow test after repair.",
            "Replace breakaway flange and upper barrel. Verify operation.",
        ],
        "asset_types": ["fire_hydrant"],
        "categories": ["Hydrant Repair"],
        "resolution_options": ["Drain valve replaced", "New breakaway flange installed", "Nozzle caps and gaskets replaced", "Hydrant replaced — Mueller Super Centurion"],
        "labor_hours_range": (2, 8),
        "material_cost_range": (150, 3500),
    },
    {
        "work_type": "inspection",
        "priority": "routine",
        "descriptions": [
            "Annual valve exercising — {street} corridor",
            "Valve exercise program — {street} zone",
            "Quarterly valve turn — {street}",
        ],
        "instructions": [
            "Exercise valve per SOP: turn full open to full close and back. Record turns and direction. Note any difficulty.",
            "Operate valve and record number of turns. Check valve box condition. Update GIS if position changed.",
        ],
        "asset_types": ["water_valve"],
        "categories": ["Valve Exercise"],
        "resolution_options": ["Valve exercised — operates freely", "Valve stiff, penetrating oil applied, exercised after 15min", "Valve box adjusted to grade", "Valve inoperable — scheduled for replacement"],
        "labor_hours_range": (0.5, 2),
        "material_cost_range": (0, 50),
    },
    {
        "work_type": "repair",
        "priority": "routine",
        "descriptions": [
            "Service line leak at curb stop — {street}",
            "Water service leaking at meter pit — {street}",
            "Copper service line pinhole leak — {street}",
        ],
        "instructions": [
            "Locate curb stop and shutoff. Excavate to find leak. Repair or replace service line section.",
            "Check meter pit for water. Replace meter setter or coupling as needed.",
        ],
        "asset_types": ["water_service"],
        "categories": ["Service Repair"],
        "resolution_options": ["Compression coupling installed at leak", "Service line replaced — curb to meter", "Curb stop replaced", "Meter setter replaced"],
        "labor_hours_range": (2, 8),
        "material_cost_range": (100, 2000),
    },
    {
        "work_type": "replacement",
        "priority": "planned",
        "descriptions": [
            "Replace aging CI water main — {street}",
            "Main replacement — {street} (1940s cast iron)",
            "Planned main upgrade 6\" to 8\" — {street}",
        ],
        "instructions": [
            "Open-cut replacement. Install 8\" DI Class 52. Reconnect services and hydrants. Chlorinate and pressure test before activation.",
            "Coordinate with traffic control. Replace main, transfer all service taps. Bacteriological testing required before return to service.",
        ],
        "asset_types": ["water_main"],
        "categories": ["Main Replacement"],
        "resolution_options": ["300 LF of 8\" DI installed", "Main replaced and pressure tested to 200 PSI", "150 LF replaced, 12 services reconnected"],
        "labor_hours_range": (16, 80),
        "material_cost_range": (5000, 40000),
    },
    {
        "work_type": "installation",
        "priority": "planned",
        "descriptions": [
            "New hydrant installation — {street}",
            "Install fire hydrant at new development — {street}",
        ],
        "instructions": [
            "Install hydrant assembly per city standard detail. Minimum 6\" branch. Set to grade. Flow test.",
        ],
        "asset_types": ["fire_hydrant"],
        "categories": ["Hydrant Installation"],
        "resolution_options": ["Hydrant installed and flow tested at 1200 GPM", "Mueller Super Centurion installed, painted safety yellow"],
        "labor_hours_range": (6, 16),
        "material_cost_range": (2500, 6000),
    },
    {
        "work_type": "repair",
        "priority": "urgent",
        "descriptions": [
            "PRV malfunction — pressure complaints on {street}",
            "Pressure reducing valve failed open — {street} zone",
        ],
        "instructions": [
            "Check downstream pressure. Disassemble PRV, inspect diaphragm and seat. Replace internals or entire valve.",
        ],
        "asset_types": ["water_valve"],
        "categories": ["Valve Repair"],
        "resolution_options": ["PRV diaphragm and seat replaced", "Valve replaced — Watts 223", "Pilot valve adjusted, pressure restored to 55 PSI"],
        "labor_hours_range": (2, 6),
        "material_cost_range": (200, 3000),
    },
]

SEWER_WO_TEMPLATES = [
    {
        "work_type": "repair",
        "priority": "emergency",
        "descriptions": [
            "Sewer main blockage — backup reported at {street}",
            "Emergency sewer overflow — {street}",
            "Main collapsed, sewage surfacing at {street}",
        ],
        "instructions": [
            "Jet main to clear blockage. CCTV to assess root cause. Report SSO to IEPA if overflow reaches waterway.",
            "Deploy vac truck. Isolate and bypass. Assess for structural failure.",
        ],
        "asset_types": ["sewer_main"],
        "categories": ["Blockage / SSO"],
        "resolution_options": ["Main jetted and cleared — grease buildup", "Root ball removed, main clear", "Bypass pumped, 20ft section replaced", "Main cleared, CCTV follow-up scheduled"],
        "labor_hours_range": (3, 12),
        "material_cost_range": (200, 8000),
    },
    {
        "work_type": "inspection",
        "priority": "routine",
        "descriptions": [
            "CCTV inspection — {street} sewer main",
            "Annual CCTV — {street} between MH-{mh1} and MH-{mh2}",
            "Post-cleaning CCTV — {street}",
        ],
        "instructions": [
            "CCTV per NASSCO PACP standards. Log all defects with distance and clock position. Submit video to GIS.",
            "Run camera both directions. Grade all joints, cracks, and intrusions per PACP coding.",
        ],
        "asset_types": ["sewer_main", "manhole"],
        "categories": ["CCTV Inspection"],
        "resolution_options": ["CCTV complete — no significant defects", "Multiple joint offsets noted, rehab recommended", "Root intrusion at 3 joints, cutting recommended", "CCTV complete — PACP score 2, monitoring only"],
        "labor_hours_range": (2, 8),
        "material_cost_range": (0, 200),
    },
    {
        "work_type": "repair",
        "priority": "routine",
        "descriptions": [
            "Manhole frame & cover adjustment — {street}",
            "Manhole rehab — cone section deterioration at {street}",
            "Manhole lid rattling, needs grade adjustment — {street}",
        ],
        "instructions": [
            "Raise or lower frame to match finished grade. Replace cover if damaged. Seal frame with non-shrink grout.",
            "Install internal chimney seal or reline cone. Replace steps if corroded.",
        ],
        "asset_types": ["manhole"],
        "categories": ["Manhole Repair"],
        "resolution_options": ["Frame raised 4\" with adjustment rings", "Cone relined with cementitious liner", "Cover replaced, sealed to grade", "Internal chimney seal installed"],
        "labor_hours_range": (2, 6),
        "material_cost_range": (100, 2500),
    },
    {
        "work_type": "repair",
        "priority": "urgent",
        "descriptions": [
            "Lift station pump failure — Station #{ls}",
            "High-level alarm at lift station — {street}",
            "Lift station control panel fault — Station #{ls}",
        ],
        "instructions": [
            "Check pump operation. Pull pump if needed for impeller/seal inspection. Ensure redundant pump is running.",
            "Reset alarm. Check floats and SCADA. Deploy portable pump if both pumps are down.",
        ],
        "asset_types": ["lift_station"],
        "categories": ["Lift Station"],
        "resolution_options": ["Pump #1 pulled — impeller cleared of rags", "Float switch replaced", "Control panel relay replaced, pumps cycling normally", "Seal kit installed on pump #2"],
        "labor_hours_range": (2, 12),
        "material_cost_range": (100, 5000),
    },
    {
        "work_type": "repair",
        "priority": "routine",
        "descriptions": [
            "Sewer lateral backup — {street} (city-side)",
            "Root intrusion in sewer lateral — {street}",
            "Sewer lateral joint separation — {street}",
        ],
        "instructions": [
            "Locate cleanout. Jet lateral from cleanout to main. CCTV if repeat issue.",
            "Camera lateral to identify failure point. Coordinate with homeowner if on private side.",
        ],
        "asset_types": ["sewer_lateral"],
        "categories": ["Lateral Repair"],
        "resolution_options": ["Lateral jetted and cleared", "Root cut at 2 locations, copper sulfate applied", "Lateral replaced — cleanout to main", "CIPP liner installed in lateral"],
        "labor_hours_range": (2, 8),
        "material_cost_range": (100, 4000),
    },
    {
        "work_type": "replacement",
        "priority": "planned",
        "descriptions": [
            "CIPP lining — {street} sewer main",
            "Sewer main rehab — {street} (brick deterioration)",
            "Trenchless rehab — {street} between manholes",
        ],
        "instructions": [
            "Pre-clean and CCTV. Install CIPP liner per ASTM F1216. Post-install CCTV and cut laterals.",
            "Bypass pump during installation. Verify liner thickness and cure. Reinstate service connections.",
        ],
        "asset_types": ["sewer_main"],
        "categories": ["Rehab / Lining"],
        "resolution_options": ["CIPP liner installed — 250 LF of 8\"", "Main relined, all laterals reinstated", "Fold-and-form liner cured, CCTV passed"],
        "labor_hours_range": (8, 40),
        "material_cost_range": (5000, 30000),
    },
    {
        "work_type": "inspection",
        "priority": "routine",
        "descriptions": [
            "Lift station wet well cleaning — Station #{ls}",
            "Annual lift station maintenance — Station #{ls}",
        ],
        "instructions": [
            "Pump down wet well. Remove debris and grease. Inspect pumps, floats, and check valves. Record run times.",
            "Clean wet well, exercise valves, test SCADA alarms. Log pump hours and amp readings.",
        ],
        "asset_types": ["lift_station"],
        "categories": ["Lift Station PM"],
        "resolution_options": ["Wet well cleaned, pumps in good condition", "Floats adjusted, wet well cleaned", "Check valve rebuilt, wet well cleaned"],
        "labor_hours_range": (3, 8),
        "material_cost_range": (50, 500),
    },
    {
        "work_type": "repair",
        "priority": "urgent",
        "descriptions": [
            "Force main leak — {street}",
            "Force main joint failure — near lift station #{ls}",
        ],
        "instructions": [
            "Shut down lift station pump. Excavate and repair. HDPE fusion or mechanical coupling. Pressure test.",
        ],
        "asset_types": ["force_main"],
        "categories": ["Force Main Repair"],
        "resolution_options": ["Mechanical coupling installed at joint failure", "HDPE fusion repair completed", "Section replaced with restrained DIP"],
        "labor_hours_range": (4, 16),
        "material_cost_range": (500, 8000),
    },
]

# ---- Inspection templates ----
WATER_INSP_TEMPLATES = [
    {
        "inspection_type": "valve_exercise",
        "descriptions": [
            "Valve exercise — {valve_type} valve at {street}",
            "Annual valve exercise — {street} & {cross}",
        ],
        "asset_types": ["water_valve"],
        "findings_options": [
            "Valve operates freely. {turns} turns to close. Direction: {dir}.",
            "Valve stiff at first but freed up after penetrating oil. {turns} turns.",
            "Valve box buried 4\" below grade. Raised and exercised.",
            "Valve inoperable — will not turn. Needs replacement.",
            "Valve operates normally. Box in good condition.",
        ],
        "recommendations_options": [
            "No action needed",
            "Schedule valve replacement — corroded stem",
            "Raise valve box to grade",
            "Replace valve box lid — broken",
            "Re-exercise in 6 months — was stiff",
        ],
    },
    {
        "inspection_type": "hydrant_flow_test",
        "descriptions": [
            "Hydrant flow test — {street}",
            "Annual hydrant inspection and flow test — {street} & {cross}",
        ],
        "asset_types": ["fire_hydrant"],
        "findings_options": [
            "Static: {static} PSI. Residual: {residual} PSI. Flow: {flow} GPM. All nozzles operational.",
            "Static: {static} PSI. Residual: {residual} PSI. Flow: {flow} GPM. Steamer cap stuck — freed with wrench.",
            "Hydrant barrel drains properly. No leaks. Painted yellow per NFPA.",
            "Low flow — possible main restriction upstream. {flow} GPM measured.",
            "Hydrant does not drain. Drain valve needs replacement.",
        ],
        "recommendations_options": [
            "No action needed — meets fire flow requirements",
            "Schedule drain valve replacement",
            "Repaint — paint peeling",
            "Low flow — investigate main. May need flushing program.",
            "Replace nozzle caps — threads damaged",
        ],
    },
    {
        "inspection_type": "main_condition",
        "descriptions": [
            "Water main condition assessment — {street}",
            "Leak survey — {street} corridor",
            "Main condition check after nearby excavation — {street}",
        ],
        "asset_types": ["water_main"],
        "findings_options": [
            "No visible leaks or surface signs of distress. Main appears in good condition.",
            "Acoustic leak detection indicates possible leak between {addr1} and {addr2}.",
            "Tuberculation observed during tap. Flow capacity may be reduced.",
            "Main exposed during utility work — external corrosion noted on CI pipe.",
            "No issues found. Cathodic protection test points reading normal.",
        ],
        "recommendations_options": [
            "No action needed",
            "Schedule leak detection pinpoint survey",
            "Add to capital plan for replacement — heavy corrosion",
            "Monitor — re-inspect in 12 months",
            "Consider cleaning and lining or replacement",
        ],
    },
    {
        "inspection_type": "service_line_inspection",
        "descriptions": [
            "Service line material verification — {street}",
            "Lead service line inventory — {street} block",
            "Service line inspection at meter — {street}",
        ],
        "asset_types": ["water_service"],
        "findings_options": [
            "Service line material: copper. No lead detected.",
            "Service line material: lead (city-side). Flagged for LCRR compliance.",
            "Service line material: galvanized steel. Connection to main appears intact.",
            "Meter pit dry, no leaks. Service line copper from main to meter.",
            "Unknown material — line buried, no visual access. Potholing recommended.",
        ],
        "recommendations_options": [
            "No action needed — copper service confirmed",
            "Schedule lead service line replacement per LCRR",
            "Add to lead inventory — notify customer",
            "Pothole to verify material — report to IEPA inventory",
            "Replace galvanized service at next main replacement",
        ],
    },
]

SEWER_INSP_TEMPLATES = [
    {
        "inspection_type": "cctv_inspection",
        "descriptions": [
            "CCTV inspection — {street} from MH to MH",
            "Post-cleaning CCTV — {street}",
            "NASSCO PACP inspection — {street} sewer main",
        ],
        "asset_types": ["sewer_main"],
        "findings_options": [
            "PACP grade {pacp}. {defects} defects logged. Joints mostly tight.",
            "Heavy root intrusion at 3 joints (clock 6). Circumferential crack at 145ft.",
            "Pipe in good condition. Minor deposits. No structural defects.",
            "Multiple offset joints. Infiltration observed at 85ft and 210ft.",
            "Sag in line at 120-135ft. Standing water 2\" deep. Grease deposits throughout.",
            "Brick deterioration in bottom third. Mortar loss at joints.",
        ],
        "recommendations_options": [
            "No action needed — structural grade 1",
            "Schedule root cutting and chemical treatment",
            "CIPP lining recommended within 2 years",
            "Point repair at offset joints — 85ft and 210ft",
            "Add to capital plan — full replacement recommended",
            "Monitor — re-inspect in 12 months",
            "Clean and re-inspect after root treatment",
        ],
    },
    {
        "inspection_type": "manhole_inspection",
        "descriptions": [
            "Manhole inspection — {street}",
            "Annual manhole condition assessment — {street} & {cross}",
            "NASSCO MACP inspection — MH at {street}",
        ],
        "asset_types": ["manhole"],
        "findings_options": [
            "Frame and cover in good condition. Steps intact. No infiltration.",
            "Active infiltration at frame-cone joint. Estimated 2 GPM.",
            "Cover cracked. Cone has minor H2S corrosion. Steps corroded.",
            "Manhole in good condition. Bench channels clear. Invert smooth.",
            "Roots entering through pipe connections. Debris buildup in channel.",
            "Frame raised above grade — rocking cover. Needs adjustment rings.",
        ],
        "recommendations_options": [
            "No action needed",
            "Install internal chimney seal",
            "Replace cover and adjust frame to grade",
            "Cut roots and seal pipe penetrations",
            "Schedule cone rehabilitation",
            "Replace corroded steps with polypropylene",
        ],
    },
    {
        "inspection_type": "lift_station_inspection",
        "descriptions": [
            "Monthly lift station check — Station #{ls}",
            "Lift station PM inspection — Station #{ls}",
            "Annual lift station comprehensive inspection — Station #{ls}",
        ],
        "asset_types": ["lift_station"],
        "findings_options": [
            "Both pumps operational. Run times balanced. Wet well clean. SCADA communicating.",
            "Pump #1 amp reading elevated (18A vs 15A normal). Possible impeller wear.",
            "Wet well grease cap 4\" thick. Floats need cleaning. Both pumps cycling normally.",
            "Check valve on pump #2 leaking back. Pump short-cycling.",
            "Station running normally. Generator tested — starts in 8 seconds. Fuel tank 75%.",
            "Odor complaints from neighbors. Carbon scrubber media needs replacement.",
        ],
        "recommendations_options": [
            "No action needed — station operating normally",
            "Schedule pump #1 pull for impeller inspection",
            "Clean wet well and floats within 2 weeks",
            "Replace check valve on pump #2",
            "Replace carbon scrubber media",
            "Monitor pump #1 amps — recheck next month",
        ],
    },
    {
        "inspection_type": "lateral_inspection",
        "descriptions": [
            "Sewer lateral CCTV — {street}",
            "Lateral inspection (repeat backup) — {street}",
        ],
        "asset_types": ["sewer_lateral"],
        "findings_options": [
            "Lateral clear. No defects found. Good connection to main.",
            "Root intrusion at 15ft from cleanout. Partial blockage.",
            "Lateral belly at 25ft — standing water. May be causing slow drainage.",
            "Clean lateral, no defects. Previous backup likely from main.",
            "Joint separation at 30ft. Soil intrusion visible.",
        ],
        "recommendations_options": [
            "No action needed — lateral in good condition",
            "Schedule root cutting and copper sulfate treatment",
            "Lateral replacement recommended — belly and joint issues",
            "Monitor — re-inspect if backup recurs",
            "CIPP liner recommended for lateral",
        ],
    },
]


WO_STATUSES_WEIGHTED = ["open", "assigned", "in_progress", "completed", "completed", "completed"]


async def generate_all():
    from app.db.session import async_session_factory

    async with async_session_factory() as db:
        # Detect which tenant to use
        result = await db.execute(text(
            f"SELECT tenant_id FROM tenant WHERE tenant_id = '{PROD_TENANT_ID}'"
        ))
        if result.fetchone():
            tenant_id = PROD_TENANT_ID
            print(f"Using production tenant: {tenant_id}")
        else:
            result = await db.execute(text(
                f"SELECT tenant_id FROM tenant WHERE tenant_id = '{DEV_TENANT_ID}'"
            ))
            if result.fetchone():
                tenant_id = DEV_TENANT_ID
                print(f"Using dev tenant: {tenant_id}")
            else:
                print("ERROR: No tenant found. Run generate_water_sewer.py first.")
                return

        # Get or create users
        result = await db.execute(text(
            "SELECT user_id, first_name, last_name FROM app_user WHERE tenant_id = :tid AND is_active = true"
        ), {"tid": tenant_id})
        users = result.fetchall()
        if not users:
            # Create utility crew users
            user_data = [
                ("Tom", "Kowalski", "tom.kowalski@springfield.gov", "supervisor"),
                ("Rachel", "Chen", "rachel.chen@springfield.gov", "crew_chief"),
                ("Marcus", "Torres", "marcus.torres@springfield.gov", "crew_chief"),
                ("Amy", "Patel", "amy.patel@springfield.gov", "crew_chief"),
            ]
            user_ids = []
            for first, last, email, role in user_data:
                uid = str(uuid.uuid4())
                user_ids.append(uid)
                await db.execute(text(
                    "INSERT INTO app_user (user_id, tenant_id, first_name, last_name, email, role, is_active) "
                    "VALUES (:id, :tid, :first, :last, :email, :role, true)"
                ), {"id": uid, "tid": tenant_id, "first": first, "last": last, "email": email, "role": role})
            await db.commit()
            user_names = {uid: f"{first} {last}" for uid, (first, last, _, _) in zip(user_ids, user_data)}
            print(f"Created {len(user_ids)} users")
        else:
            user_ids = [str(u[0]) for u in users]
            user_names = {str(u[0]): f"{u[1]} {u[2]}" for u in users}
            print(f"Found {len(user_ids)} existing users")

        # Load existing water assets
        water_mains = await _load_assets(db, tenant_id, "water_main", "water_main_id")
        water_valves = await _load_assets(db, tenant_id, "water_valve", "water_valve_id")
        hydrants = await _load_assets(db, tenant_id, "fire_hydrant", "hydrant_id")
        water_services = await _load_assets(db, tenant_id, "water_service", "water_service_id")
        manholes = await _load_assets(db, tenant_id, "manhole", "manhole_id")
        sewer_mains = await _load_assets(db, tenant_id, "sewer_main", "sewer_main_id")
        lift_stations = await _load_assets(db, tenant_id, "lift_station", "lift_station_id")
        sewer_laterals = await _load_assets(db, tenant_id, "sewer_lateral", "sewer_lateral_id")
        force_mains = await _load_assets(db, tenant_id, "force_main", "force_main_id")

        asset_pools = {
            "water_main": water_mains,
            "water_valve": water_valves,
            "fire_hydrant": hydrants,
            "water_service": water_services,
            "manhole": manholes,
            "sewer_main": sewer_mains,
            "lift_station": lift_stations,
            "sewer_lateral": sewer_laterals,
            "force_main": force_mains,
        }

        print(f"\nAssets loaded:")
        for k, v in asset_pools.items():
            if v:
                print(f"  {k}: {len(v)}")

        # Check we have assets to work with
        total_water = len(water_mains) + len(water_valves) + len(hydrants) + len(water_services)
        total_sewer = len(sewer_mains) + len(manholes) + len(lift_stations) + len(sewer_laterals)
        if total_water == 0 and total_sewer == 0:
            print("ERROR: No water or sewer assets found. Run generate_water_sewer.py first.")
            return

        # =====================================================================
        # WATER WORK ORDERS
        # =====================================================================
        print("\n--- Water Work Orders ---")
        water_wo_count = await _create_work_orders(
            db, tenant_id, user_ids,
            WATER_WO_TEMPLATES, asset_pools,
            count=50, wo_start_num=1, prefix="W"
        )
        await db.commit()
        print(f"  Created {water_wo_count} water work orders")

        # =====================================================================
        # SEWER WORK ORDERS
        # =====================================================================
        print("\n--- Sewer Work Orders ---")
        sewer_wo_count = await _create_work_orders(
            db, tenant_id, user_ids,
            SEWER_WO_TEMPLATES, asset_pools,
            count=40, wo_start_num=100, prefix="S"
        )
        await db.commit()
        print(f"  Created {sewer_wo_count} sewer work orders")

        # =====================================================================
        # WATER INSPECTIONS
        # =====================================================================
        print("\n--- Water Inspections ---")
        water_insp_count = await _create_inspections(
            db, tenant_id, user_ids,
            WATER_INSP_TEMPLATES, asset_pools,
            count=60, insp_start_num=1, prefix="W"
        )
        await db.commit()
        print(f"  Created {water_insp_count} water inspections")

        # =====================================================================
        # SEWER INSPECTIONS
        # =====================================================================
        print("\n--- Sewer Inspections ---")
        sewer_insp_count = await _create_inspections(
            db, tenant_id, user_ids,
            SEWER_INSP_TEMPLATES, asset_pools,
            count=50, insp_start_num=100, prefix="S"
        )
        await db.commit()
        print(f"  Created {sewer_insp_count} sewer inspections")

        # =====================================================================
        # SUMMARY
        # =====================================================================
        print("\n" + "=" * 60)
        print("Springfield Water/Sewer WO & Inspection Summary")
        print("=" * 60)
        for table in ["work_order", "work_order_asset", "inspection", "inspection_asset"]:
            r = await db.execute(text(
                f"SELECT count(*) FROM {table} WHERE tenant_id = :tid"
            ), {"tid": tenant_id})
            cnt = r.scalar()
            print(f"  {table:25s}: {cnt:>5}")
        print("=" * 60)


LINE_TABLES = {"water_main", "sewer_main", "force_main"}


async def _load_assets(db: AsyncSession, tenant_id: str, table: str, id_col: str) -> list[dict]:
    """Load assets with their coordinates for linking to WOs/inspections."""
    if table in LINE_TABLES:
        # LineString geometry — use centroid
        result = await db.execute(text(
            f"SELECT {id_col}, "
            f"ST_X(ST_Centroid(geometry::geometry)) as lon, "
            f"ST_Y(ST_Centroid(geometry::geometry)) as lat, "
            f"asset_tag "
            f"FROM {table} WHERE tenant_id = :tid AND geometry IS NOT NULL"
        ), {"tid": tenant_id})
    else:
        # Point geometry
        result = await db.execute(text(
            f"SELECT {id_col}, ST_X(geometry::geometry) as lon, ST_Y(geometry::geometry) as lat, "
            f"asset_tag "
            f"FROM {table} WHERE tenant_id = :tid AND geometry IS NOT NULL"
        ), {"tid": tenant_id})
    return [{"id": str(r[0]), "lon": r[1], "lat": r[2], "tag": r[3]} for r in result.all()]


async def _create_work_orders(
    db: AsyncSession,
    tenant_id: str,
    user_ids: list[str],
    templates: list[dict],
    asset_pools: dict[str, list[dict]],
    count: int,
    wo_start_num: int,
    prefix: str,
) -> int:
    created = 0
    for i in range(count):
        template = random.choice(templates)
        # Find a valid asset for this template
        primary_asset_type = template["asset_types"][0]
        pool = asset_pools.get(primary_asset_type, [])
        if not pool:
            continue

        asset = random.choice(pool)
        status = random.choice(WO_STATUSES_WEIGHTED)
        created_date = date(2026, 3, 29) - timedelta(days=random.randint(1, 270))
        due = created_date + timedelta(days=random.randint(3, 45))
        completed_dt = None
        if status == "completed":
            comp_date = created_date + timedelta(days=random.randint(1, 21))
            completed_dt = datetime(comp_date.year, comp_date.month, comp_date.day,
                                   random.randint(8, 16), 0, 0)

        street = random.choice(EW_STREETS)
        cross = random.choice(NS_STREETS)
        ls_num = random.randint(1, 3)
        mh1 = random.randint(100, 300)
        mh2 = mh1 + random.randint(1, 5)

        desc = random.choice(template["descriptions"]).format(
            street=street, cross=cross, ls=ls_num, mh1=mh1, mh2=mh2
        )
        instr = random.choice(template["instructions"])

        day_str = created_date.strftime("%Y%m%d")
        wo_num = f"WO-{day_str}-{prefix}{wo_start_num + i:03d}"
        wo_id = str(uuid.uuid4())

        assigned = random.choice(user_ids) if status != "open" else None

        # Cost tracking for completed WOs
        labor_hours = None
        labor_cost = None
        material_cost = None
        total_cost = None
        resolution = None
        if status == "completed":
            lh_min, lh_max = template.get("labor_hours_range", (1, 8))
            labor_hours = round(random.uniform(lh_min, lh_max), 1)
            labor_cost = round(labor_hours * random.uniform(55, 85), 2)
            mc_min, mc_max = template.get("material_cost_range", (0, 500))
            material_cost = round(random.uniform(mc_min, mc_max), 2)
            total_cost = round(labor_cost + material_cost, 2)
            resolution = random.choice(template.get("resolution_options", ["Completed"]))

        category = random.choice(template.get("categories", [None]))

        await db.execute(text(
            "INSERT INTO work_order (work_order_id, tenant_id, work_order_number, "
            "description, work_type, priority, status, category, resolution, "
            "assigned_to, due_date, actual_start_date, completed_date, "
            "address, location_notes, instructions, "
            "labor_hours, labor_cost, material_cost, total_cost, "
            "geometry, created_at) VALUES "
            "(:id, :tid, :num, :desc, :wtype, :pri, :status, :cat, :res, "
            ":assigned, :due, :start, :completed, "
            ":addr, :loc, :instr, "
            ":lhrs, :lcost, :mcost, :tcost, "
            "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :created)"
        ), {
            "id": wo_id, "tid": tenant_id, "num": wo_num,
            "desc": desc, "wtype": template["work_type"],
            "pri": template["priority"], "status": status,
            "cat": category, "res": resolution,
            "assigned": assigned, "due": due,
            "start": created_date + timedelta(days=1) if status in ("in_progress", "completed") else None,
            "completed": completed_dt,
            "addr": f"{random.randint(100, 999)} {street}",
            "loc": f"Near {cross}",
            "instr": instr,
            "lhrs": labor_hours, "lcost": labor_cost,
            "mcost": material_cost, "tcost": total_cost,
            "lon": asset["lon"], "lat": asset["lat"],
            "created": datetime(created_date.year, created_date.month, created_date.day, 8, 0, 0),
        })

        # Link primary asset
        await db.execute(text(
            "INSERT INTO work_order_asset (work_order_asset_id, tenant_id, work_order_id, "
            "asset_type, asset_id, action_required, status) VALUES "
            "(:id, :tid, :woid, :atype, :aid, :action, :status)"
        ), {
            "id": str(uuid.uuid4()), "tid": tenant_id, "woid": wo_id,
            "atype": primary_asset_type, "aid": asset["id"],
            "action": random.choice(["inspect", "repair", "replace"]),
            "status": "completed" if status == "completed" else "pending",
        })

        # Sometimes link a second related asset
        if len(template["asset_types"]) > 1 and random.random() < 0.6:
            second_type = template["asset_types"][1]
            second_pool = asset_pools.get(second_type, [])
            if second_pool:
                second_asset = random.choice(second_pool)
                await db.execute(text(
                    "INSERT INTO work_order_asset (work_order_asset_id, tenant_id, work_order_id, "
                    "asset_type, asset_id, action_required, status) VALUES "
                    "(:id, :tid, :woid, :atype, :aid, :action, :status)"
                ), {
                    "id": str(uuid.uuid4()), "tid": tenant_id, "woid": wo_id,
                    "atype": second_type, "aid": second_asset["id"],
                    "action": random.choice(["inspect", "monitor"]),
                    "status": "completed" if status == "completed" else "pending",
                })

        created += 1
    return created


async def _create_inspections(
    db: AsyncSession,
    tenant_id: str,
    user_ids: list[str],
    templates: list[dict],
    asset_pools: dict[str, list[dict]],
    count: int,
    insp_start_num: int,
    prefix: str,
) -> int:
    created = 0
    for i in range(count):
        template = random.choice(templates)
        primary_asset_type = template["asset_types"][0]
        pool = asset_pools.get(primary_asset_type, [])
        if not pool:
            continue

        asset = random.choice(pool)
        status = random.choices(
            ["completed", "completed", "completed", "completed", "open", "in_progress"],
            k=1
        )[0]
        insp_date = date(2026, 3, 29) - timedelta(days=random.randint(1, 365))
        follow_up = random.random() < 0.2

        street = random.choice(EW_STREETS)
        cross = random.choice(NS_STREETS)
        ls_num = random.randint(1, 3)
        valve_type = random.choice(["Gate", "Butterfly", "PRV", "Check"])
        turns = random.randint(8, 30)
        direction = random.choice(["CW", "CCW"])
        static_psi = random.randint(50, 80)
        residual_psi = random.randint(20, static_psi - 10)
        flow_gpm = random.randint(400, 1800)
        pacp_grade = random.randint(1, 5)
        defect_count = random.randint(0, 15)
        addr1 = f"{random.randint(100, 500)} {street}"
        addr2 = f"{random.randint(501, 999)} {street}"

        desc = random.choice(template["descriptions"]).format(
            street=street, cross=cross, ls=ls_num,
            valve_type=valve_type,
        )

        findings = random.choice(template["findings_options"]).format(
            turns=turns, dir=direction,
            static=static_psi, residual=residual_psi, flow=flow_gpm,
            pacp=pacp_grade, defects=defect_count,
            addr1=addr1, addr2=addr2,
        )
        recs = random.choice(template["recommendations_options"])

        day_str = insp_date.strftime("%Y%m%d")
        insp_num = f"INS-{day_str}-{prefix}{insp_start_num + i:03d}"
        insp_id = str(uuid.uuid4())
        inspector = random.choice(user_ids)

        overall_cond = random.randint(1, 5)
        if follow_up:
            overall_cond = min(overall_cond, 3)  # Follow-ups are for worse conditions

        await db.execute(text(
            "INSERT INTO inspection (inspection_id, tenant_id, inspection_number, "
            "inspection_type, inspection_date, inspector_id, status, "
            "condition_rating, findings, recommendations, "
            "follow_up_required, "
            "geometry, created_at) VALUES "
            "(:id, :tid, :num, :itype, :idate, :inspector, :status, "
            ":cond, :findings, :recs, :follow, "
            "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :created)"
        ), {
            "id": insp_id, "tid": tenant_id, "num": insp_num,
            "itype": template["inspection_type"], "idate": insp_date,
            "inspector": inspector, "status": status,
            "cond": overall_cond,
            "findings": findings, "recs": recs,
            "follow": follow_up,
            "lon": asset["lon"], "lat": asset["lat"],
            "created": datetime(insp_date.year, insp_date.month, insp_date.day, 9, 0, 0),
        })

        # Link primary asset
        await db.execute(text(
            "INSERT INTO inspection_asset (inspection_asset_id, tenant_id, inspection_id, "
            "asset_type, asset_id, condition_rating, findings, "
            "action_recommended, status) VALUES "
            "(:id, :tid, :iid, :atype, :aid, :cond, :findings, :action, :status)"
        ), {
            "id": str(uuid.uuid4()), "tid": tenant_id, "iid": insp_id,
            "atype": primary_asset_type, "aid": asset["id"],
            "cond": overall_cond,
            "findings": findings[:200] if findings else None,
            "action": random.choice(["ok", "ok", "monitor", "repair", "replace"]),
            "status": "inspected",
        })

        # Sometimes link a second related asset (e.g., manhole + sewer main for CCTV)
        if len(template["asset_types"]) > 1 and random.random() < 0.5:
            second_type = template["asset_types"][0]  # Stick with same type — inspects multiple of same asset
            second_pool = asset_pools.get(second_type, [])
            if second_pool:
                second_asset = random.choice(second_pool)
                if second_asset["id"] != asset["id"]:
                    await db.execute(text(
                        "INSERT INTO inspection_asset (inspection_asset_id, tenant_id, inspection_id, "
                        "asset_type, asset_id, condition_rating, findings, "
                        "action_recommended, status) VALUES "
                        "(:id, :tid, :iid, :atype, :aid, :cond, :findings, :action, :status)"
                    ), {
                        "id": str(uuid.uuid4()), "tid": tenant_id, "iid": insp_id,
                        "atype": second_type, "aid": second_asset["id"],
                        "cond": random.randint(max(1, overall_cond - 1), min(5, overall_cond + 1)),
                        "findings": "Inspected — see main findings",
                        "action": random.choice(["ok", "monitor"]),
                        "status": "inspected",
                    })

        created += 1
    return created


if __name__ == "__main__":
    asyncio.run(generate_all())
