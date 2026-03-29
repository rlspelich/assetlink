#!/usr/bin/env python3
"""
Generate signs, sign supports, work orders, and inspections for Springfield, IL.

Creates:
  ~200 sign supports with ~500 signs (1-4 signs per support)
  ~40 work orders with multi-asset links
  ~60 inspections with multi-asset links

Run:  docker compose exec -e PYTHONPATH=/app api python scripts/generate_signs_wo_insp.py
"""

import asyncio
import random
import uuid
from datetime import date, timedelta, datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

CENTER_LAT = 39.7990
CENTER_LON = -89.6440
BLOCK_LON = 0.0025
BLOCK_LAT = 0.0018
GRID_EW = 12
GRID_NS = 10

EW_STREETS = [
    "E Capitol Ave", "E Adams St", "E Monroe St", "E Jefferson St",
    "E Washington St", "E Madison St", "E Cook St", "E Edwards St",
    "E Lawrence Ave", "E Carpenter St", "E Jackson St", "E Allen St",
]
NS_STREETS = [
    "N 1st St", "N 2nd St", "N 3rd St", "N 4th St", "N 5th St",
    "N 6th St", "N 7th St", "N 8th St", "N 9th St", "N College St",
]

# Common MUTCD codes (must exist in sign_type table)
REGULATORY_CODES = ["R1-1", "R1-2", "R2-1", "R3-1", "R3-2", "R3-4", "R4-7", "R5-1", "R6-1", "R7-1", "R7-8"]
WARNING_CODES = ["W1-1", "W1-2", "W2-1", "W3-1", "W3-3", "W11-2"]
GUIDE_CODES = ["D1-1", "D3-1"]
SCHOOL_CODES = ["S1-1"]

ALL_CODES = REGULATORY_CODES * 3 + WARNING_CODES * 2 + GUIDE_CODES + SCHOOL_CODES

SUPPORT_TYPES = ["u_channel", "u_channel", "u_channel", "square_tube", "square_tube", "round_tube", "wood"]
SUPPORT_MATERIALS = ["aluminum", "steel", "galvanized_steel", "wood"]
SHEETING_TYPES = ["Type I", "Type I", "Type III", "Type III", "Type IX", "Type XI"]
STATUS_OPTIONS = ["active", "active", "active", "active", "active", "damaged", "faded", "missing"]

WO_TYPES = ["repair", "replacement", "inspection", "installation", "removal"]
WO_PRIORITIES = ["emergency", "urgent", "routine", "routine", "routine", "planned", "planned"]
WO_STATUSES = ["open", "assigned", "in_progress", "completed", "completed", "completed"]

INSP_TYPES = ["sign_condition", "sign_condition", "sign_retroreflectivity", "support_condition", "general"]


def grid_point(ew, ns):
    lon = CENTER_LON + (ns - GRID_NS / 2) * BLOCK_LON
    lat = CENTER_LAT + (ew - GRID_EW / 2) * BLOCK_LAT
    return (lon, lat)


def jitter(lon, lat, amount=0.00008):
    return (lon + random.uniform(-amount, amount), lat + random.uniform(-amount, amount))


def random_install_date():
    years_ago = random.choices(range(0, 25), weights=[4]*5 + [3]*5 + [2]*5 + [1]*10, k=1)[0]
    return date(2026, 3, 28) - timedelta(days=years_ago * 365 + random.randint(0, 364))


def random_condition(age_years):
    if age_years < 3: return random.choices([5, 4, 3], weights=[6, 3, 1], k=1)[0]
    if age_years < 8: return random.choices([5, 4, 3, 2], weights=[2, 5, 2, 1], k=1)[0]
    if age_years < 15: return random.choices([4, 3, 2, 1], weights=[2, 4, 3, 1], k=1)[0]
    return random.choices([3, 2, 1], weights=[2, 4, 4], k=1)[0]


async def generate_all():
    from app.db.session import async_session_factory
    from app.db.seed import seed_sign_types

    async with async_session_factory() as db:
        # Ensure tenant exists
        result = await db.execute(text(f"SELECT tenant_id FROM tenant WHERE tenant_id = '{TENANT_ID}'"))
        if not result.fetchone():
            await db.execute(text(
                f"INSERT INTO tenant (tenant_id, name, subdomain, tenant_type, isolation_model, "
                f"modules_enabled, subscription_tier, is_active) VALUES "
                f"('{TENANT_ID}', 'City of Springfield', 'springfield', 'municipality', 'shared', "
                f"'[\"signs\", \"water\", \"sewer\"]', 'basic', true)"
            ))
            await db.commit()
            print("Created Springfield tenant")

        # Seed MUTCD sign types
        count = await seed_sign_types(db)
        print(f"Seeded {count} new sign types")

        # Create users (upsert by email)
        user_ids = []
        users = [
            ("Mike", "Johnson", "mike.johnson@springfield.gov", "supervisor"),
            ("Sarah", "Williams", "sarah.williams@springfield.gov", "crew_chief"),
            ("Dave", "Miller", "dave.miller@springfield.gov", "crew_chief"),
            ("Lisa", "Davis", "lisa.davis@springfield.gov", "admin"),
        ]
        for first, last, email, role in users:
            # Check if user exists first
            result = await db.execute(text(
                "SELECT user_id FROM app_user WHERE tenant_id = :tid AND email = :email"
            ), {"tid": TENANT_ID, "email": email})
            row = result.fetchone()
            if row:
                user_ids.append(str(row[0]))
            else:
                uid = str(uuid.uuid4())
                user_ids.append(uid)
                await db.execute(text(
                    "INSERT INTO app_user (user_id, tenant_id, first_name, last_name, email, role, is_active) "
                    "VALUES (:id, :tid, :first, :last, :email, :role, true)"
                ), {"id": uid, "tid": TENANT_ID, "first": first, "last": last, "email": email, "role": role})
        await db.commit()
        print(f"Users ready: {len(user_ids)}")

        # Get available MUTCD codes
        result = await db.execute(text("SELECT mutcd_code FROM sign_type"))
        available_codes = [r[0] for r in result.all()]
        if not available_codes:
            print("ERROR: No sign types seeded!")
            return
        print(f"Available MUTCD codes: {len(available_codes)}")

        # =====================================================================
        # SIGN SUPPORTS + SIGNS
        # =====================================================================
        print("\n--- Sign Supports & Signs ---")
        support_ids = []
        sign_ids = []

        for ew in range(GRID_EW):
            for ns in range(GRID_NS):
                # 1-3 supports per intersection
                n_supports = random.choices([0, 1, 1, 2, 2, 3], k=1)[0]
                for s in range(n_supports):
                    pt = jitter(*grid_point(ew, ns), 0.0002)
                    idate = random_install_date()
                    age = (date(2026, 3, 28) - idate).days // 365
                    sup_id = str(uuid.uuid4())
                    sup_type = random.choice(SUPPORT_TYPES)
                    sup_mat = random.choice(SUPPORT_MATERIALS)
                    await db.execute(text(
                        "INSERT INTO sign_support (support_id, tenant_id, asset_tag, support_type, "
                        "support_material, install_date, condition_rating, height_inches, status, "
                        "geometry) VALUES "
                        "(:id, :tid, :tag, :stype, :smat, :idate, :cond, :height, :status, "
                        "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                    ), {"id": sup_id, "tid": TENANT_ID,
                        "tag": f"SUP-{ew:02d}{ns:02d}-{s}",
                        "stype": sup_type, "smat": sup_mat,
                        "idate": idate, "cond": random_condition(age),
                        "height": random.choice([84, 84, 96, 96, 108, 120, 144]),
                        "status": random.choices(["active", "active", "active", "active", "damaged", "leaning"], k=1)[0],
                        "lon": pt[0], "lat": pt[1]})
                    support_ids.append({"id": sup_id, "lon": pt[0], "lat": pt[1], "ew": ew, "ns": ns, "idate": idate})

                    # 1-4 signs per support
                    n_signs = random.choices([1, 1, 2, 2, 2, 3, 4], k=1)[0]
                    for si in range(n_signs):
                        sign_id = str(uuid.uuid4())
                        code = random.choice(available_codes)
                        sign_idate = idate + timedelta(days=random.randint(0, 365))
                        sign_age = max(0, (date(2026, 3, 28) - sign_idate).days // 365)
                        cond = random_condition(sign_age)
                        sheeting = random.choice(SHEETING_TYPES)
                        status = random.choice(STATUS_OPTIONS)
                        retro_val = round(random.uniform(20, 300), 1) if random.random() < 0.6 else None
                        passes = retro_val and retro_val >= 50 if retro_val else None
                        await db.execute(text(
                            "INSERT INTO sign (sign_id, tenant_id, asset_tag, support_id, mutcd_code, "
                            "description, sign_category, condition_rating, road_name, address, "
                            "sheeting_type, expected_life_years, install_date, "
                            "measured_value, passes_minimum, last_inspected_date, "
                            "status, facing_direction, "
                            "geometry) VALUES "
                            "(:id, :tid, :tag, :sup, :code, :desc, :cat, :cond, :road, :addr, "
                            ":sheet, :life, :idate, :retro, :passes, :last_insp, "
                            ":status, :facing, "
                            "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                        ), {"id": sign_id, "tid": TENANT_ID,
                            "tag": f"SGN-{ew:02d}{ns:02d}-{s}{si}",
                            "sup": sup_id, "code": code,
                            "desc": f"Sign on {EW_STREETS[ew]} at {NS_STREETS[ns]}",
                            "cat": random.choice(["regulatory", "warning", "guide", "school"]),
                            "cond": cond, "road": EW_STREETS[ew],
                            "addr": f"{random.randint(100, 999)} {EW_STREETS[ew]}",
                            "sheet": sheeting,
                            "life": {"Type I": 7, "Type III": 10, "Type IX": 12, "Type XI": 15}.get(sheeting, 10),
                            "idate": sign_idate,
                            "retro": retro_val, "passes": passes,
                            "last_insp": date(2026, 3, 28) - timedelta(days=random.randint(30, 700)) if random.random() < 0.5 else None,
                            "status": status,
                            "facing": random.randint(0, 359),
                            "lon": pt[0], "lat": pt[1]})
                        sign_ids.append({"id": sign_id, "sup_id": sup_id, "lon": pt[0], "lat": pt[1]})

        await db.commit()
        print(f"  Created {len(support_ids)} supports with {len(sign_ids)} signs")

        # =====================================================================
        # WORK ORDERS
        # =====================================================================
        print("\n--- Work Orders ---")
        wo_count = 0
        for i in range(45):
            wo_id = str(uuid.uuid4())
            wo_type = random.choice(WO_TYPES)
            priority = random.choice(WO_PRIORITIES)
            status = random.choice(WO_STATUSES)
            created = date(2026, 3, 28) - timedelta(days=random.randint(1, 180))
            due = created + timedelta(days=random.randint(3, 30))
            completed = created + timedelta(days=random.randint(1, 14)) if status == "completed" else None
            assigned = random.choice(user_ids[:3]) if status != "open" else None

            # Pick a random support + its signs for the WO
            sup = random.choice(support_ids)
            related_signs = [s for s in sign_ids if s["sup_id"] == sup["id"]]

            # Generate WO number
            day_str = created.strftime("%Y%m%d")
            wo_num = f"WO-{day_str}-{900 + i:03d}"

            await db.execute(text(
                "INSERT INTO work_order (work_order_id, tenant_id, work_order_number, "
                "description, work_type, priority, status, "
                "assigned_to, due_date, actual_start_date, completed_date, "
                "address, location_notes, instructions, "
                "geometry, "
                "created_at) VALUES "
                "(:id, :tid, :num, :desc, :wtype, :pri, :status, "
                ":assigned, :due, :start, :completed, "
                ":addr, :loc, :instr, "
                "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :created)"
            ), {"id": wo_id, "tid": TENANT_ID, "num": wo_num,
                "desc": f"{wo_type.title()} — {EW_STREETS[sup['ew']]} & {NS_STREETS[sup['ns']]}",
                "wtype": wo_type, "pri": priority, "status": status,
                "assigned": assigned,
                "due": due,
                "start": created + timedelta(days=1) if status in ("in_progress", "completed") else None,
                "completed": completed,
                "addr": f"{random.randint(100, 999)} {EW_STREETS[sup['ew']]}",
                "loc": f"Near {NS_STREETS[sup['ns']]}",
                "instr": f"{'Replace' if wo_type == 'replacement' else wo_type.title()} sign{'s' if len(related_signs) > 1 else ''} at this location",
                "lon": sup["lon"], "lat": sup["lat"],
                "created": datetime(created.year, created.month, created.day, 8, 0, 0)})

            # Link support as asset
            await db.execute(text(
                "INSERT INTO work_order_asset (work_order_asset_id, tenant_id, work_order_id, "
                "asset_type, asset_id, action_required, status) VALUES "
                "(:id, :tid, :woid, 'sign_support', :aid, :action, :status)"
            ), {"id": str(uuid.uuid4()), "tid": TENANT_ID, "woid": wo_id,
                "aid": sup["id"],
                "action": random.choice(["inspect", "repair", "replace"]),
                "status": "completed" if status == "completed" else "pending"})

            # Link signs as assets
            for s in related_signs[:3]:
                await db.execute(text(
                    "INSERT INTO work_order_asset (work_order_asset_id, tenant_id, work_order_id, "
                    "asset_type, asset_id, action_required, status) VALUES "
                    "(:id, :tid, :woid, 'sign', :aid, :action, :status)"
                ), {"id": str(uuid.uuid4()), "tid": TENANT_ID, "woid": wo_id,
                    "aid": s["id"],
                    "action": random.choice(["replace", "repair", "inspect"]),
                    "status": "completed" if status == "completed" else "pending"})

            wo_count += 1
        await db.commit()
        print(f"  Created {wo_count} work orders")

        # =====================================================================
        # INSPECTIONS
        # =====================================================================
        print("\n--- Inspections ---")
        insp_count = 0
        for i in range(65):
            insp_id = str(uuid.uuid4())
            insp_type = random.choice(INSP_TYPES)
            insp_date = date(2026, 3, 28) - timedelta(days=random.randint(1, 365))
            status = random.choices(["completed", "completed", "completed", "open", "in_progress"], k=1)[0]
            follow_up = random.random() < 0.25
            inspector = random.choice(user_ids[:3])

            # Pick random support + signs
            sup = random.choice(support_ids)
            related_signs = [s for s in sign_ids if s["sup_id"] == sup["id"]]

            day_str = insp_date.strftime("%Y%m%d")
            insp_num = f"INS-{day_str}-{900 + i:03d}"

            overall_cond = random.randint(1, 5)

            await db.execute(text(
                "INSERT INTO inspection (inspection_id, tenant_id, inspection_number, "
                "inspection_type, inspection_date, inspector_id, status, "
                "condition_rating, findings, recommendations, "
                "follow_up_required, "
                "geometry, "
                "created_at) VALUES "
                "(:id, :tid, :num, :itype, :idate, :inspector, :status, "
                ":cond, :findings, :recs, :follow, "
                "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), :created)"
            ), {"id": insp_id, "tid": TENANT_ID, "num": insp_num,
                "itype": insp_type, "idate": insp_date,
                "inspector": inspector, "status": status,
                "cond": overall_cond,
                "findings": random.choice([
                    "Signs in good condition, no issues",
                    "Minor fading on regulatory sign",
                    "Support leaning slightly, signs intact",
                    "Retroreflectivity below minimum on stop sign",
                    "Sign knocked down, support damaged",
                    "Graffiti on sign face",
                    "Vegetation obscuring sign",
                    "Signs properly mounted and visible",
                    None
                ]),
                "recs": random.choice([
                    "Replace faded sign within 30 days",
                    "Schedule support replacement",
                    "No action needed",
                    "Re-measure retroreflectivity in 6 months",
                    "Emergency replacement needed",
                    "Trim vegetation around sign",
                    None
                ]),
                "follow": follow_up,
                "lon": sup["lon"], "lat": sup["lat"],
                "created": datetime(insp_date.year, insp_date.month, insp_date.day, 9, 0, 0)})

            # Link support
            await db.execute(text(
                "INSERT INTO inspection_asset (inspection_asset_id, tenant_id, inspection_id, "
                "asset_type, asset_id, condition_rating, findings, "
                "action_recommended, status) VALUES "
                "(:id, :tid, :iid, 'sign_support', :aid, :cond, :findings, :action, :status)"
            ), {"id": str(uuid.uuid4()), "tid": TENANT_ID, "iid": insp_id,
                "aid": sup["id"], "cond": overall_cond,
                "findings": "Support inspected",
                "action": random.choice(["ok", "ok", "monitor", "repair", "replace"]),
                "status": "inspected"})

            # Link signs
            for s in related_signs[:3]:
                sign_cond = random.randint(max(1, overall_cond - 1), min(5, overall_cond + 1))
                retro = round(random.uniform(20, 300), 1) if insp_type == "sign_retroreflectivity" else None
                await db.execute(text(
                    "INSERT INTO inspection_asset (inspection_asset_id, tenant_id, inspection_id, "
                    "asset_type, asset_id, condition_rating, "
                    "retroreflectivity_value, passes_minimum_retro, "
                    "action_recommended, status) VALUES "
                    "(:id, :tid, :iid, 'sign', :aid, :cond, :retro, :passes, :action, :status)"
                ), {"id": str(uuid.uuid4()), "tid": TENANT_ID, "iid": insp_id,
                    "aid": s["id"], "cond": sign_cond,
                    "retro": retro, "passes": (retro >= 50) if retro else None,
                    "action": random.choice(["ok", "ok", "monitor", "repair", "replace"]),
                    "status": "inspected"})

            insp_count += 1
        await db.commit()
        print(f"  Created {insp_count} inspections")

        # =====================================================================
        # SUMMARY
        # =====================================================================
        print("\n" + "=" * 60)
        print("Springfield Signs/WO/Inspection Test Data Summary")
        print("=" * 60)
        for table in ["sign_support", "sign", "work_order", "work_order_asset",
                       "inspection", "inspection_asset", "app_user"]:
            r = await db.execute(text(f"SELECT count(*) FROM {table} WHERE tenant_id = '{TENANT_ID}'"))
            cnt = r.scalar()
            print(f"  {table:20s}: {cnt:>5}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(generate_all())
