#!/usr/bin/env python3
"""
Generate realistic water and sewer test data for Springfield, IL.

Creates a connected municipal utility network with:
  Water: ~60 mains, ~80 valves, ~120 hydrants, 3 pressure zones, ~40 services, ~30 fittings
  Sewer: ~50 gravity mains, ~70 manholes, 3 lift stations, 3 force mains, ~40 laterals, ~20 fittings

Run:  docker compose exec api python scripts/generate_water_sewer.py
"""

import asyncio
import random
import uuid
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Springfield IL downtown grid — real street layout
# Center: ~39.7990, -89.6440
CENTER_LAT = 39.7990
CENTER_LON = -89.6440

# Street grid spacing (approximate Springfield IL block size)
BLOCK_LON = 0.0025  # ~200m E-W
BLOCK_LAT = 0.0018  # ~200m N-S

# Grid: 12 E-W streets x 10 N-S streets
GRID_EW = 12  # east-west streets
GRID_NS = 10  # north-south streets

TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

# Springfield IL street names
EW_STREETS = [
    "E Capitol Ave", "E Adams St", "E Monroe St", "E Jefferson St",
    "E Washington St", "E Madison St", "E Cook St", "E Edwards St",
    "E Lawrence Ave", "E Carpenter St", "E Jackson St", "E Allen St",
]
NS_STREETS = [
    "N 1st St", "N 2nd St", "N 3rd St", "N 4th St", "N 5th St",
    "N 6th St", "N 7th St", "N 8th St", "N 9th St", "N College St",
]

# Material distributions (weighted)
WATER_MATERIALS = ["DI", "DI", "DI", "PVC", "PVC", "CI", "CI", "AC", "HDPE"]
SEWER_MATERIALS = ["VCP", "VCP", "VCP", "PVC", "PVC", "RCP", "CI", "CONC", "HDPE"]
SEWER_SHAPES = ["CIRC", "CIRC", "CIRC", "CIRC", "EGG", "BOX"]
MANHOLE_TYPES = ["PRECAST", "PRECAST", "PRECAST", "BRICK", "BRICK", "BLOCK"]
VALVE_TYPES = ["GATE", "GATE", "GATE", "GATE", "BUTTERFLY", "BUTTERFLY", "CHECK", "PRV"]

# Common install date ranges
def random_install_date(bias_recent=False):
    if bias_recent:
        years_ago = random.choices(range(0, 30), weights=[5]*5 + [3]*10 + [1]*15, k=1)[0]
    else:
        years_ago = random.choices(range(0, 80), weights=[3]*10 + [2]*20 + [1]*50, k=1)[0]
    return date(2026, 3, 28) - timedelta(days=years_ago * 365 + random.randint(0, 364))

def random_condition(age_years):
    """Condition correlates with age."""
    if age_years < 5: return random.choices([5, 4, 3], weights=[6, 3, 1], k=1)[0]
    if age_years < 15: return random.choices([5, 4, 3, 2], weights=[2, 5, 2, 1], k=1)[0]
    if age_years < 30: return random.choices([4, 3, 2, 1], weights=[2, 4, 3, 1], k=1)[0]
    if age_years < 50: return random.choices([3, 2, 1], weights=[3, 4, 3], k=1)[0]
    return random.choices([3, 2, 1], weights=[1, 3, 6], k=1)[0]

def grid_point(ew_idx, ns_idx):
    """Get lon, lat for a grid intersection."""
    lon = CENTER_LON + (ns_idx - GRID_NS / 2) * BLOCK_LON
    lat = CENTER_LAT + (ew_idx - GRID_EW / 2) * BLOCK_LAT
    return (lon, lat)

def jitter(lon, lat, amount=0.00005):
    return (lon + random.uniform(-amount, amount), lat + random.uniform(-amount, amount))

def interp(p1, p2, t):
    return (p1[0] + (p2[0] - p1[0]) * t, p1[1] + (p2[1] - p1[1]) * t)


async def generate_all():
    from app.db.session import async_session_factory
    from app.db.seed_water_sewer import seed_all_water_sewer

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

        # Seed reference data
        counts = await seed_all_water_sewer(db)
        print(f"Seeded reference data: {counts}")

        # =====================================================================
        # PRESSURE ZONES (3 zones covering the grid)
        # =====================================================================
        print("\n--- Pressure Zones ---")
        zones = []
        zone_defs = [
            ("Zone 1 — Downtown", "Z1", 55, 75, 0, 0, 5, 6),     # left half, lower
            ("Zone 2 — North Hill", "Z2", 60, 80, 0, 5, 5, 10),   # left half, upper
            ("Zone 3 — East Side", "Z3", 50, 70, 5, 0, 10, 10),   # right half
        ]
        for name, number, pmin, pmax, ns_lo, ew_lo, ns_hi, ew_hi in zone_defs:
            sw = grid_point(ew_lo, ns_lo)
            ne = grid_point(ew_hi, ns_hi)
            zone_id = str(uuid.uuid4())
            await db.execute(text(
                "INSERT INTO pressure_zone (pressure_zone_id, tenant_id, zone_name, zone_number, "
                "target_pressure_min_psi, target_pressure_max_psi, geometry) VALUES "
                "(:id, :tid, :name, :num, :pmin, :pmax, "
                "ST_SetSRID(ST_MakePolygon(ST_MakeLine(ARRAY["
                "ST_MakePoint(:x1,:y1), ST_MakePoint(:x2,:y1), ST_MakePoint(:x2,:y2), "
                "ST_MakePoint(:x1,:y2), ST_MakePoint(:x1,:y1)])), 4326))"
            ), {"id": zone_id, "tid": TENANT_ID, "name": name, "num": number,
                "pmin": pmin, "pmax": pmax,
                "x1": sw[0], "y1": sw[1], "x2": ne[0], "y2": ne[1]})
            zones.append({"id": zone_id, "ns_lo": ns_lo, "ns_hi": ns_hi, "ew_lo": ew_lo, "ew_hi": ew_hi})
            print(f"  Created {name}")
        await db.commit()

        def get_zone_for_point(ns_idx, ew_idx):
            for z in zones:
                if z["ns_lo"] <= ns_idx <= z["ns_hi"] and z["ew_lo"] <= ew_idx <= z["ew_hi"]:
                    return z["id"]
            return None

        # =====================================================================
        # WATER MAINS — along every street segment
        # =====================================================================
        print("\n--- Water Mains ---")
        water_main_ids = {}  # (ew_start, ns_start, ew_end, ns_end) → id
        wm_count = 0

        # E-W mains (along east-west streets)
        for ew in range(GRID_EW):
            for ns in range(GRID_NS - 1):
                p1 = grid_point(ew, ns)
                p2 = grid_point(ew, ns + 1)
                mid_ns = (ns + ns + 1) / 2
                idate = random_install_date()
                age = (date(2026, 3, 28) - idate).days // 365
                wm_id = str(uuid.uuid4())
                water_main_ids[(ew, ns, ew, ns + 1)] = wm_id
                mat = random.choice(WATER_MATERIALS)
                diam = random.choice([6, 8, 8, 8, 12, 12, 16])
                zone_id = get_zone_for_point(ns, ew)
                await db.execute(text(
                    "INSERT INTO water_main (water_main_id, tenant_id, asset_tag, description, "
                    "material_code, diameter_inches, length_feet, status, install_date, "
                    "condition_rating, pressure_zone_id, owner, flow_direction, break_count, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :mat, :diam, :len, 'active', :idate, :cond, :zone, "
                    "'public', :flow, :breaks, "
                    "ST_SetSRID(ST_MakeLine(ST_MakePoint(:x1,:y1), ST_MakePoint(:x2,:y2)), 4326))"
                ), {"id": wm_id, "tid": TENANT_ID,
                    "tag": f"WM-{EW_STREETS[ew][:3].upper()}-{ns:02d}",
                    "desc": f"{diam}\" {mat} on {EW_STREETS[ew]} ({NS_STREETS[ns]} to {NS_STREETS[ns+1]})",
                    "mat": mat, "diam": diam, "len": random.randint(180, 250),
                    "idate": idate, "cond": random_condition(age),
                    "zone": zone_id, "flow": random.choice(["east", "west"]),
                    "breaks": random.choices([0, 0, 0, 0, 1, 1, 2, 3], k=1)[0],
                    "x1": p1[0], "y1": p1[1], "x2": p2[0], "y2": p2[1]})
                wm_count += 1

        # N-S mains (along north-south streets, fewer — not every street has water)
        for ns in range(GRID_NS):
            if random.random() < 0.3:  # skip ~30% of N-S streets
                continue
            for ew in range(GRID_EW - 1):
                p1 = grid_point(ew, ns)
                p2 = grid_point(ew + 1, ns)
                idate = random_install_date()
                age = (date(2026, 3, 28) - idate).days // 365
                wm_id = str(uuid.uuid4())
                water_main_ids[(ew, ns, ew + 1, ns)] = wm_id
                mat = random.choice(WATER_MATERIALS)
                diam = random.choice([6, 8, 8, 12])
                zone_id = get_zone_for_point(ns, ew)
                await db.execute(text(
                    "INSERT INTO water_main (water_main_id, tenant_id, asset_tag, description, "
                    "material_code, diameter_inches, length_feet, status, install_date, "
                    "condition_rating, pressure_zone_id, owner, flow_direction, break_count, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :mat, :diam, :len, 'active', :idate, :cond, :zone, "
                    "'public', :flow, :breaks, "
                    "ST_SetSRID(ST_MakeLine(ST_MakePoint(:x1,:y1), ST_MakePoint(:x2,:y2)), 4326))"
                ), {"id": wm_id, "tid": TENANT_ID,
                    "tag": f"WM-{NS_STREETS[ns][:3].upper()}-{ew:02d}",
                    "desc": f"{diam}\" {mat} on {NS_STREETS[ns]} ({EW_STREETS[ew]} to {EW_STREETS[ew+1]})",
                    "mat": mat, "diam": diam, "len": random.randint(160, 220),
                    "idate": idate, "cond": random_condition(age),
                    "zone": zone_id, "flow": random.choice(["north", "south"]),
                    "breaks": random.choices([0, 0, 0, 0, 1, 1, 2], k=1)[0],
                    "x1": p1[0], "y1": p1[1], "x2": p2[0], "y2": p2[1]})
                wm_count += 1

        await db.commit()
        print(f"  Created {wm_count} water mains")

        # =====================================================================
        # WATER VALVES — at most intersections
        # =====================================================================
        print("\n--- Water Valves ---")
        valve_count = 0
        for ew in range(GRID_EW):
            for ns in range(GRID_NS):
                if random.random() < 0.25:  # skip ~25%
                    continue
                pt = jitter(*grid_point(ew, ns), 0.00008)
                idate = random_install_date()
                age = (date(2026, 3, 28) - idate).days // 365
                vtype = random.choice(VALVE_TYPES)
                size = random.choice([6, 8, 8, 12])
                zone_id = get_zone_for_point(ns, ew)
                is_crit = vtype in ("PRV", "BUTTERFLY") and random.random() < 0.4
                last_ex = idate + timedelta(days=random.randint(100, 800)) if random.random() < 0.6 else None
                await db.execute(text(
                    "INSERT INTO water_valve (water_valve_id, tenant_id, asset_tag, description, "
                    "valve_type_code, size_inches, material, turns_to_close, turn_direction, "
                    "normal_position, is_critical, is_operable, status, install_date, "
                    "condition_rating, last_exercised_date, pressure_zone_id, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :vtype, :size, :mat, :turns, :dir, 'open', :crit, "
                    ":operable, 'active', :idate, :cond, :lastex, :zone, "
                    "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                ), {"id": str(uuid.uuid4()), "tid": TENANT_ID,
                    "tag": f"V-{ew:02d}{ns:02d}",
                    "desc": f"{size}\" {vtype} at {EW_STREETS[ew]} & {NS_STREETS[ns]}",
                    "vtype": vtype, "size": size, "mat": random.choice(["DI", "CI", "brass"]),
                    "turns": random.randint(8, 24) if vtype == "GATE" else None,
                    "dir": random.choice(["CW", "CCW"]) if vtype == "GATE" else None,
                    "crit": is_crit, "operable": random.choice(["yes", "yes", "yes", "partial", "no"]),
                    "idate": idate, "cond": random_condition(age),
                    "lastex": last_ex, "zone": zone_id,
                    "lon": pt[0], "lat": pt[1]})
                valve_count += 1
        await db.commit()
        print(f"  Created {valve_count} water valves")

        # =====================================================================
        # FIRE HYDRANTS — along E-W mains, every 2-3 blocks
        # =====================================================================
        print("\n--- Fire Hydrants ---")
        hydrant_count = 0
        flow_colors = ["blue", "green", "green", "orange", "orange", "red"]
        for ew in range(GRID_EW):
            for ns in range(GRID_NS - 1):
                if random.random() < 0.35:  # skip some segments
                    continue
                # Place hydrant along the main, offset slightly
                t = random.uniform(0.3, 0.7)
                p1 = grid_point(ew, ns)
                p2 = grid_point(ew, ns + 1)
                pt = interp(p1, p2, t)
                pt = jitter(pt[0], pt[1] + 0.00015, 0.00003)  # offset north of street
                idate = random_install_date(bias_recent=True)
                age = (date(2026, 3, 28) - idate).days // 365
                color = random.choice(flow_colors)
                flow_gpm = {"blue": random.randint(1500, 2500), "green": random.randint(1000, 1499),
                            "orange": random.randint(500, 999), "red": random.randint(200, 499)}[color]
                has_test = random.random() < 0.7
                static_p = round(random.uniform(55, 85), 1) if has_test else None
                residual_p = round(random.uniform(20, 50), 1) if has_test else None
                wm_key = (ew, ns, ew, ns + 1)
                connected_main = water_main_ids.get(wm_key)
                zone_id = get_zone_for_point(ns, ew)
                flush_date = date(2026, 3, 28) - timedelta(days=random.randint(30, 400)) if random.random() < 0.5 else None
                await db.execute(text(
                    "INSERT INTO fire_hydrant (hydrant_id, tenant_id, asset_tag, description, "
                    "make, model, year_manufactured, barrel_type, nozzle_count, nozzle_sizes, "
                    "flow_test_date, static_pressure_psi, residual_pressure_psi, flow_gpm, "
                    "flow_class_color, last_flush_date, flush_interval_days, "
                    "status, install_date, condition_rating, ownership, "
                    "connected_main_id, lateral_size_inches, pressure_zone_id, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :make, :model, :year, :barrel, :nozzles, :sizes, "
                    ":ftest, :static, :resid, :flow, :color, :flush, :fint, "
                    "'active', :idate, :cond, 'public', "
                    ":main_id, :lat_size, :zone, "
                    "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                ), {"id": str(uuid.uuid4()), "tid": TENANT_ID,
                    "tag": f"HYD-{ew:02d}{ns:02d}",
                    "desc": f"Hydrant on {EW_STREETS[ew]} near {NS_STREETS[ns]}",
                    "make": random.choice(["Mueller", "American Flow Control", "Waterous", "Kennedy"]),
                    "model": random.choice(["Super Centurion", "B-62-B", "Pacer", "Guardian"]),
                    "year": idate.year if idate.year > 1980 else None,
                    "barrel": random.choice(["dry", "dry", "dry", "wet"]),
                    "nozzles": random.choice([2, 3, 3]), "sizes": "2.5,2.5,4.5",
                    "ftest": date(2026, 3, 28) - timedelta(days=random.randint(60, 700)) if has_test else None,
                    "static": static_p, "resid": residual_p,
                    "flow": flow_gpm if has_test else None, "color": color if has_test else None,
                    "flush": flush_date, "fint": 365,
                    "idate": idate, "cond": random_condition(age),
                    "main_id": connected_main, "lat_size": 6.0, "zone": zone_id,
                    "lon": pt[0], "lat": pt[1]})
                hydrant_count += 1
        await db.commit()
        print(f"  Created {hydrant_count} fire hydrants")

        # =====================================================================
        # WATER SERVICES — scattered along mains
        # =====================================================================
        print("\n--- Water Services ---")
        svc_count = 0
        for ew in range(GRID_EW):
            for ns in range(GRID_NS - 1):
                # 2-4 services per block
                n_services = random.randint(1, 4)
                wm_key = (ew, ns, ew, ns + 1)
                main_id = water_main_ids.get(wm_key)
                for s in range(n_services):
                    t = (s + 1) / (n_services + 1)
                    p1 = grid_point(ew, ns)
                    p2 = grid_point(ew, ns + 1)
                    pt = interp(p1, p2, t)
                    side = random.choice([-1, 1])
                    pt = (pt[0], pt[1] + side * 0.0003 + random.uniform(-0.00005, 0.00005))
                    stype = random.choices(["domestic", "commercial", "industrial", "irrigation"],
                                           weights=[8, 2, 0.5, 0.5], k=1)[0]
                    await db.execute(text(
                        "INSERT INTO water_service (water_service_id, tenant_id, asset_tag, "
                        "service_type, meter_number, meter_size_inches, meter_type, "
                        "service_line_material, service_line_size_inches, tap_main_id, "
                        "address, account_number, status, install_date, "
                        "geometry) VALUES "
                        "(:id, :tid, :tag, :stype, :meter, :msize, :mtype, :slmat, :slsize, "
                        ":main, :addr, :acct, 'active', :idate, "
                        "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                    ), {"id": str(uuid.uuid4()), "tid": TENANT_ID,
                        "tag": f"WS-{ew:02d}{ns:02d}-{s}",
                        "stype": stype,
                        "meter": f"M{random.randint(100000, 999999)}",
                        "msize": random.choice([0.625, 0.75, 1.0, 1.5]) if stype == "domestic" else random.choice([1.5, 2.0, 3.0]),
                        "mtype": random.choice(["positive_displacement", "turbine", "compound"]),
                        "slmat": random.choice(["CU", "PE", "PVC", "GAL"]),
                        "slsize": 0.75 if stype == "domestic" else 1.5,
                        "main": main_id, "addr": f"{random.randint(100, 999)} {EW_STREETS[ew]}",
                        "acct": f"SPF-{random.randint(10000, 99999)}",
                        "idate": random_install_date(),
                        "lon": pt[0], "lat": pt[1]})
                    svc_count += 1
                    if svc_count >= 200:
                        break
            if svc_count >= 200:
                break
        await db.commit()
        print(f"  Created {svc_count} water services")

        # =====================================================================
        # MANHOLES — at every intersection on the sewer grid
        # =====================================================================
        print("\n--- Manholes ---")
        manhole_ids = {}  # (ew, ns) → id
        mh_count = 0
        # Base elevation: slopes from NW (high) to SE (low) — gravity flows SE
        def ground_elev(ew, ns):
            return 600 - ew * 0.8 - ns * 0.5 + random.uniform(-0.5, 0.5)

        for ew in range(GRID_EW):
            for ns in range(GRID_NS):
                pt = jitter(*grid_point(ew, ns), 0.00006)
                idate = random_install_date()
                age = (date(2026, 3, 28) - idate).days // 365
                rim = round(ground_elev(ew, ns), 2)
                depth = round(random.uniform(6, 14), 1)
                invert = round(rim - depth, 2)
                sys_type = "sanitary" if ns < 7 else random.choice(["sanitary", "storm", "combined"])
                mh_id = str(uuid.uuid4())
                manhole_ids[(ew, ns)] = mh_id
                macp = random_condition(age) if random.random() < 0.3 else None
                await db.execute(text(
                    "INSERT INTO manhole (manhole_id, tenant_id, asset_tag, description, "
                    "manhole_type_code, material, diameter_inches, "
                    "rim_elevation_ft, invert_elevation_ft, depth_ft, "
                    "cover_type, has_steps, step_material, cone_type, "
                    "system_type, macp_grade, status, install_date, condition_rating, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :mtype, :mat, :diam, "
                    ":rim, :inv, :depth, :cover, :steps, :stepmat, :cone, "
                    ":sys, :macp, 'active', :idate, :cond, "
                    "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                ), {"id": mh_id, "tid": TENANT_ID,
                    "tag": f"MH-{ew:02d}{ns:02d}",
                    "desc": f"Manhole at {EW_STREETS[ew]} & {NS_STREETS[ns]}",
                    "mtype": random.choice(MANHOLE_TYPES),
                    "mat": random.choice(["concrete", "brick", "precast"]),
                    "diam": random.choice([48, 48, 48, 60, 60, 72]),
                    "rim": rim, "inv": invert, "depth": depth,
                    "cover": random.choice(["standard", "watertight", "bolted"]),
                    "steps": random.choice([True, True, False]),
                    "stepmat": random.choice(["aluminum", "polypropylene", "cast_iron"]),
                    "cone": random.choice(["eccentric", "concentric", "flat_top"]),
                    "sys": sys_type, "macp": macp,
                    "idate": idate, "cond": random_condition(age),
                    "lon": pt[0], "lat": pt[1]})
                mh_count += 1
        await db.commit()
        print(f"  Created {mh_count} manholes")

        # =====================================================================
        # SEWER MAINS — connect manholes along streets (gravity flows SE)
        # =====================================================================
        print("\n--- Sewer Mains ---")
        sm_count = 0
        sewer_main_ids = {}

        # E-W sewer mains — flow east (increasing ns index)
        for ew in range(GRID_EW):
            for ns in range(GRID_NS - 1):
                if random.random() < 0.15:  # skip a few
                    continue
                up_mh = manhole_ids.get((ew, ns))
                dn_mh = manhole_ids.get((ew, ns + 1))
                if not up_mh or not dn_mh:
                    continue
                p1 = grid_point(ew, ns)
                p2 = grid_point(ew, ns + 1)
                idate = random_install_date()
                age = (date(2026, 3, 28) - idate).days // 365
                mat = random.choice(SEWER_MATERIALS)
                diam = random.choice([8, 8, 10, 12, 12, 15, 18])
                up_inv = round(ground_elev(ew, ns) - random.uniform(6, 12), 2)
                dn_inv = round(up_inv - random.uniform(0.3, 1.5), 2)
                length = random.randint(180, 250)
                slope = round((up_inv - dn_inv) / length * 100, 4)
                sys_type = "sanitary" if ns < 7 else random.choice(["sanitary", "storm", "combined"])
                pacp = random_condition(age) if random.random() < 0.25 else None
                sm_id = str(uuid.uuid4())
                sewer_main_ids[(ew, ns, ew, ns + 1)] = sm_id
                await db.execute(text(
                    "INSERT INTO sewer_main (sewer_main_id, tenant_id, asset_tag, description, "
                    "material_code, shape_code, diameter_inches, length_feet, "
                    "lining_type, slope_pct, upstream_invert_ft, downstream_invert_ft, "
                    "upstream_manhole_id, downstream_manhole_id, "
                    "system_type, owner, pacp_grade, status, install_date, condition_rating, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :mat, :shape, :diam, :len, "
                    ":lining, :slope, :up_inv, :dn_inv, :up_mh, :dn_mh, "
                    ":sys, 'public', :pacp, 'active', :idate, :cond, "
                    "ST_SetSRID(ST_MakeLine(ST_MakePoint(:x1,:y1), ST_MakePoint(:x2,:y2)), 4326))"
                ), {"id": sm_id, "tid": TENANT_ID,
                    "tag": f"SM-{ew:02d}{ns:02d}",
                    "desc": f"{diam}\" {mat} on {EW_STREETS[ew]} ({NS_STREETS[ns]} to {NS_STREETS[ns+1]})",
                    "mat": mat, "shape": random.choice(SEWER_SHAPES),
                    "diam": diam, "len": length,
                    "lining": random.choice([None, None, None, "CIPP", "slip_line"]),
                    "slope": slope, "up_inv": up_inv, "dn_inv": dn_inv,
                    "up_mh": up_mh, "dn_mh": dn_mh,
                    "sys": sys_type, "pacp": pacp,
                    "idate": idate, "cond": random_condition(age),
                    "x1": p1[0], "y1": p1[1], "x2": p2[0], "y2": p2[1]})
                sm_count += 1

        # N-S sewer mains — flow south (increasing ew index)
        for ns in range(GRID_NS):
            if random.random() < 0.4:  # fewer N-S sewers
                continue
            for ew in range(GRID_EW - 1):
                up_mh = manhole_ids.get((ew, ns))
                dn_mh = manhole_ids.get((ew + 1, ns))
                if not up_mh or not dn_mh:
                    continue
                p1 = grid_point(ew, ns)
                p2 = grid_point(ew + 1, ns)
                idate = random_install_date()
                age = (date(2026, 3, 28) - idate).days // 365
                mat = random.choice(SEWER_MATERIALS)
                diam = random.choice([8, 10, 12, 15])
                sm_id = str(uuid.uuid4())
                sewer_main_ids[(ew, ns, ew + 1, ns)] = sm_id
                up_inv = round(ground_elev(ew, ns) - random.uniform(6, 12), 2)
                dn_inv = round(up_inv - random.uniform(0.3, 1.5), 2)
                length = random.randint(160, 220)
                slope = round((up_inv - dn_inv) / length * 100, 4)
                await db.execute(text(
                    "INSERT INTO sewer_main (sewer_main_id, tenant_id, asset_tag, description, "
                    "material_code, shape_code, diameter_inches, length_feet, "
                    "slope_pct, upstream_invert_ft, downstream_invert_ft, "
                    "upstream_manhole_id, downstream_manhole_id, "
                    "system_type, owner, status, install_date, condition_rating, "
                    "geometry) VALUES "
                    "(:id, :tid, :tag, :desc, :mat, :shape, :diam, :len, "
                    ":slope, :up_inv, :dn_inv, :up_mh, :dn_mh, "
                    "'sanitary', 'public', 'active', :idate, :cond, "
                    "ST_SetSRID(ST_MakeLine(ST_MakePoint(:x1,:y1), ST_MakePoint(:x2,:y2)), 4326))"
                ), {"id": sm_id, "tid": TENANT_ID,
                    "tag": f"SM-{ns:02d}{ew:02d}N",
                    "desc": f"{diam}\" {mat} on {NS_STREETS[ns]} ({EW_STREETS[ew]} to {EW_STREETS[ew+1]})",
                    "mat": mat, "shape": "CIRC", "diam": diam, "len": length,
                    "slope": slope, "up_inv": up_inv, "dn_inv": dn_inv,
                    "up_mh": up_mh, "dn_mh": dn_mh,
                    "idate": idate, "cond": random_condition(age),
                    "x1": p1[0], "y1": p1[1], "x2": p2[0], "y2": p2[1]})
                sm_count += 1
        await db.commit()
        print(f"  Created {sm_count} sewer mains")

        # =====================================================================
        # LIFT STATIONS — 3 in low-lying areas (SE corner of grid)
        # =====================================================================
        print("\n--- Lift Stations ---")
        ls_ids = []
        ls_defs = [
            ("LS-1 Sugar Creek", 10, 8, 2, "submersible", 15, 350, True, True),
            ("LS-2 South Branch", 8, 7, 3, "submersible", 25, 600, True, True),
            ("LS-3 Industrial Park", 11, 5, 1, "dry_pit", 10, 200, False, False),
        ]
        for name, ew, ns, pump_ct, pump_type, hp, cap, scada, backup in ls_defs:
            pt = jitter(*grid_point(ew, ns), 0.0003)
            idate = random_install_date(bias_recent=True)
            ls_id = str(uuid.uuid4())
            ls_ids.append({"id": ls_id, "ew": ew, "ns": ns})
            await db.execute(text(
                "INSERT INTO lift_station (lift_station_id, tenant_id, asset_tag, station_name, "
                "description, wet_well_depth_ft, wet_well_diameter_ft, wet_well_material, "
                "pump_count, pump_type, pump_hp, firm_capacity_gpm, design_capacity_gpm, "
                "control_type, has_scada, has_backup_power, backup_power_type, "
                "has_alarm, alarm_type, electrical_service, voltage, "
                "owner, status, install_date, condition_rating, "
                "geometry) VALUES "
                "(:id, :tid, :tag, :name, :desc, :wwd, :wwd_diam, :wwmat, "
                ":pumps, :ptype, :hp, :firm, :design, "
                ":ctrl, :scada, :backup, :bktype, :alarm, :atype, :elec, :volt, "
                "'public', 'active', :idate, :cond, "
                "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
            ), {"id": ls_id, "tid": TENANT_ID,
                "tag": f"LS-{len(ls_ids):03d}",
                "name": name,
                "desc": f"{name} — {pump_ct}x {hp}HP {pump_type}",
                "wwd": random.uniform(12, 20), "wwd_diam": random.uniform(6, 10),
                "wwmat": "concrete",
                "pumps": pump_ct, "ptype": pump_type, "hp": hp,
                "firm": cap * 0.67, "design": cap,
                "ctrl": "transducer", "scada": scada,
                "backup": backup, "bktype": "generator" if backup else None,
                "alarm": True, "atype": "scada" if scada else "dialer",
                "elec": "three_phase", "volt": 480,
                "idate": idate, "cond": 4,
                "lon": pt[0], "lat": pt[1]})
        await db.commit()
        print(f"  Created {len(ls_ids)} lift stations")

        # =====================================================================
        # FORCE MAINS — from each lift station to a discharge manhole
        # =====================================================================
        print("\n--- Force Mains ---")
        for i, ls in enumerate(ls_ids):
            # Route force main a few blocks north/west to a manhole
            discharge_ew = max(0, ls["ew"] - random.randint(2, 4))
            discharge_ns = ls["ns"]
            discharge_mh = manhole_ids.get((discharge_ew, discharge_ns))
            ls_pt = grid_point(ls["ew"], ls["ns"])
            dis_pt = grid_point(discharge_ew, discharge_ns)
            await db.execute(text(
                "INSERT INTO force_main (force_main_id, tenant_id, asset_tag, description, "
                "material_code, diameter_inches, length_feet, pressure_class, "
                "lift_station_id, discharge_manhole_id, has_cathodic_protection, "
                "owner, status, install_date, condition_rating, "
                "geometry) VALUES "
                "(:id, :tid, :tag, :desc, :mat, :diam, :len, :pclass, "
                ":ls_id, :dm_id, :cp, 'public', 'active', :idate, :cond, "
                "ST_SetSRID(ST_MakeLine(ST_MakePoint(:x1,:y1), ST_MakePoint(:x2,:y2)), 4326))"
            ), {"id": str(uuid.uuid4()), "tid": TENANT_ID,
                "tag": f"FM-{i+1:03d}",
                "desc": f"Force main from LS-{i+1} to MH-{discharge_ew:02d}{discharge_ns:02d}",
                "mat": random.choice(["DIP", "HDPE", "PVC"]),
                "diam": random.choice([6, 8, 10]),
                "len": random.randint(800, 2000),
                "pclass": "C900",
                "ls_id": ls["id"], "dm_id": discharge_mh,
                "cp": random.choice([True, False]),
                "idate": random_install_date(bias_recent=True),
                "cond": random.choice([4, 4, 5]),
                "x1": ls_pt[0], "y1": ls_pt[1], "x2": dis_pt[0], "y2": dis_pt[1]})
        await db.commit()
        print(f"  Created {len(ls_ids)} force mains")

        # =====================================================================
        # SEWER LATERALS — scattered along sewer mains
        # =====================================================================
        print("\n--- Sewer Laterals ---")
        lat_count = 0
        for ew in range(GRID_EW):
            for ns in range(GRID_NS - 1):
                sm_key = (ew, ns, ew, ns + 1)
                sm_id = sewer_main_ids.get(sm_key)
                if not sm_id:
                    continue
                n_lats = random.randint(1, 3)
                for s in range(n_lats):
                    t = (s + 1) / (n_lats + 1)
                    p1 = grid_point(ew, ns)
                    p2 = grid_point(ew, ns + 1)
                    pt = interp(p1, p2, t)
                    side = random.choice([-1, 1])
                    pt = (pt[0], pt[1] + side * 0.0003)
                    await db.execute(text(
                        "INSERT INTO sewer_lateral (sewer_lateral_id, tenant_id, asset_tag, "
                        "service_type, material_code, diameter_inches, "
                        "connected_main_id, tap_location, has_cleanout, "
                        "address, account_number, status, install_date, "
                        "geometry) VALUES "
                        "(:id, :tid, :tag, :stype, :mat, :diam, :main, :tap, :co, "
                        ":addr, :acct, 'active', :idate, "
                        "ST_SetSRID(ST_MakePoint(:lon, :lat), 4326))"
                    ), {"id": str(uuid.uuid4()), "tid": TENANT_ID,
                        "tag": f"SL-{ew:02d}{ns:02d}-{s}",
                        "stype": random.choices(["residential", "commercial", "industrial"],
                                                weights=[8, 1.5, 0.5], k=1)[0],
                        "mat": random.choice(["PVC", "VCP", "CI"]),
                        "diam": random.choice([4, 4, 6, 6]),
                        "main": sm_id,
                        "tap": random.choice(["top", "side", "saddle"]),
                        "co": random.choice([True, True, False]),
                        "addr": f"{random.randint(100, 999)} {EW_STREETS[ew]}",
                        "acct": f"SPF-{random.randint(10000, 99999)}",
                        "idate": random_install_date(),
                        "lon": pt[0], "lat": pt[1]})
                    lat_count += 1
                    if lat_count >= 200:
                        break
            if lat_count >= 200:
                break
        await db.commit()
        print(f"  Created {lat_count} sewer laterals")

        # =====================================================================
        # SUMMARY
        # =====================================================================
        print("\n" + "=" * 60)
        print("Springfield Water & Sewer Test Data Summary")
        print("=" * 60)
        for table in ["pressure_zone", "water_main", "water_valve", "fire_hydrant",
                       "water_service", "manhole", "sewer_main", "lift_station",
                       "force_main", "sewer_lateral"]:
            r = await db.execute(text(f"SELECT count(*) FROM {table} WHERE tenant_id = '{TENANT_ID}'"))
            cnt = r.scalar()
            print(f"  {table:20s}: {cnt:>5}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(generate_all())
