#!/usr/bin/env python3
"""
Generate 6 months of realistic work orders and inspections for Springfield DPW.

Creates a lived-in dataset with:
- 5 users (Admin, Supervisor, 3 Crew Chiefs)
- 200+ inspections spread over 6 months
- 150+ work orders with full lifecycle (open → in_progress → completed)
- Realistic distribution of priorities, types, and statuses
- Emergency knockdowns, routine replacements, inspection-driven WOs
- Assigned crew members and completion dates
- Support-level (multi-asset) work orders for knockdowns

Requires: 2,000 signs already imported (run generate_test_signs.py first, then import).
Uses the API directly — no database dependency.

Usage:
    python3 scripts/generate_test_wo_inspections.py
"""

import json
import os
import random
import sys
from datetime import date, datetime, timedelta

import requests

API_BASE = os.environ.get("API_BASE", "http://localhost:8000/api/v1")
TENANT_ID = "22222222-2222-2222-2222-222222222222"
HEADERS = {"X-Tenant-ID": TENANT_ID, "Content-Type": "application/json"}

random.seed(2026)

# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------
TODAY = date.today()
SIX_MONTHS_AGO = TODAY - timedelta(days=180)


def random_date_in_range(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, max(0, delta)))


def random_date_recent(days_back: int = 180) -> date:
    return random_date_in_range(TODAY - timedelta(days=days_back), TODAY)


# ---------------------------------------------------------------------------
# API helpers
# ---------------------------------------------------------------------------
def api_get(path, params=None):
    r = requests.get(f"{API_BASE}/{path}", headers=HEADERS, params=params or {})
    r.raise_for_status()
    return r.json()


def api_post(path, data):
    r = requests.post(f"{API_BASE}/{path}", headers=HEADERS, json=data)
    if r.status_code == 201:
        return r.json()
    return None


def api_put(path, data):
    r = requests.put(f"{API_BASE}/{path}", headers=HEADERS, json=data)
    if r.status_code == 200:
        return r.json()
    return None


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
USERS = [
    {"first_name": "John", "last_name": "Smith", "role": "admin", "email": "jsmith@springfield-dpw.gov", "employee_id": "DPW-001", "phone": "217-555-0101"},
    {"first_name": "Maria", "last_name": "Garcia", "role": "supervisor", "email": "mgarcia@springfield-dpw.gov", "employee_id": "DPW-002", "phone": "217-555-0102"},
    {"first_name": "James", "last_name": "Wilson", "role": "crew_chief", "email": "jwilson@springfield-dpw.gov", "employee_id": "DPW-003", "phone": "217-555-0103"},
    {"first_name": "Robert", "last_name": "Johnson", "role": "crew_chief", "email": "rjohnson@springfield-dpw.gov", "employee_id": "DPW-004", "phone": "217-555-0104"},
    {"first_name": "Sarah", "last_name": "Davis", "role": "crew_chief", "email": "sdavis@springfield-dpw.gov", "employee_id": "DPW-005", "phone": "217-555-0105"},
]

# Inspection findings templates
ROUTINE_FINDINGS = [
    "Sign in acceptable condition. Sheeting intact.",
    "No issues observed. Post stable.",
    "Minor dirt buildup, otherwise good.",
    "Sign face clean and legible.",
    "Sheeting intact, no peeling. Reflectivity adequate.",
    "Post stable, sign properly oriented at correct height.",
    "Sign in good condition. Minor vegetation encroachment noted.",
    "All signs on support in acceptable condition.",
    "Retro reading within acceptable range.",
    "Sign face clean. No damage or fading observed.",
]

MONITOR_FINDINGS = [
    "Minor fading on sign face. Monitor on next cycle.",
    "Slight lean on post — within tolerance. Re-check in 6 months.",
    "Edge rust beginning. Not yet affecting readability.",
    "Sheeting showing early wear. Still meets minimum retro.",
    "Small dent from minor impact. Sign still readable.",
    "Vegetation beginning to obscure sign. Trim needed.",
]

PROBLEM_FINDINGS = {
    "damaged": [
        "Sign face cracked from vehicle impact.",
        "Sign bent at 45 degrees, not readable from roadway.",
        "Sign knocked off post, lying on ground.",
        "Vandalism — graffiti covering sign face.",
        "Post sheared at base from vehicle impact.",
        "Multiple signs on support displaced by impact.",
    ],
    "faded": [
        "Sheeting severely deteriorated. Legend barely visible.",
        "Background color faded beyond recognition.",
        "Retro reading {retro} mcd/lux/m² — below MUTCD minimum of 50.",
        "Sign face peeling, sheeting delaminating.",
        "Color shift — red faded to pink, not compliant.",
    ],
    "poor": [
        "Sign face peeling, legend visibility impaired.",
        "Significant rust on sign edges and mounting hardware.",
        "Post leaning 15+ degrees, sign below required height.",
        "Background color faded, contrast insufficient.",
        "Multiple areas of sheeting failure.",
    ],
}

WO_DESCRIPTIONS = {
    "knockdown": [
        "Vehicle knockdown at {road}. Support and {n} signs down.",
        "Hit-and-run knocked down sign assembly at {road} & {cross}.",
        "Truck mirror clipped sign support at {road}. Post bent, signs displaced.",
    ],
    "replacement": [
        "Replace {code} — {desc} on {road}. Failed retro reading.",
        "Replace faded {code} on {road}. Legend not readable.",
        "Scheduled replacement of {code} at {road} — past expected life.",
        "Replace damaged {code} at {road} & {cross}.",
    ],
    "repair": [
        "Straighten leaning post at {road} & {cross}.",
        "Repair mounting hardware on {code} at {road}.",
        "Re-attach {code} sign face to existing post at {road}.",
        "Trim vegetation obscuring {code} on {road}.",
    ],
    "new_install": [
        "Install new {code} at {road} & {cross} per traffic study.",
        "Add {code} to existing support at {road}.",
        "New sign installation requested by city council — {road}.",
    ],
}


def main():
    print("=" * 60)
    print("SPRINGFIELD DPW — TEST DATA GENERATOR")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # Step 1: Create users
    # -----------------------------------------------------------------------
    print("\n--- Creating users ---")
    user_ids = []
    for u in USERS:
        result = api_post("users", u)
        if result:
            user_ids.append(result["user_id"])
            print(f"  ✓ {u['first_name']} {u['last_name']} ({u['role']})")
        else:
            # User may already exist — try to find them
            existing = api_get("users")
            for eu in existing.get("users", []):
                if eu.get("email") == u["email"]:
                    user_ids.append(eu["user_id"])
                    print(f"  ○ {u['first_name']} {u['last_name']} (already exists)")
                    break
            else:
                print(f"  ✗ Failed to create {u['first_name']} {u['last_name']}")

    if not user_ids:
        print("WARNING: No users created. WOs/inspections won't have assignees.")

    crew_chief_ids = user_ids[2:] if len(user_ids) >= 3 else user_ids
    supervisor_id = user_ids[1] if len(user_ids) >= 2 else (user_ids[0] if user_ids else None)
    all_inspector_ids = user_ids[1:] if len(user_ids) >= 2 else user_ids

    # -----------------------------------------------------------------------
    # Step 2: Fetch signs and supports
    # -----------------------------------------------------------------------
    print("\n--- Fetching sign inventory ---")
    signs = api_get("signs", {"page_size": 1000})["signs"]
    supports = api_get("supports", {"page_size": 500})["supports"]
    print(f"  Signs: {len(signs)}")
    print(f"  Supports: {len(supports)}")

    if not signs:
        print("ERROR: No signs found. Import signs first.")
        sys.exit(1)

    # Categorize
    critical = [s for s in signs if s.get("condition_rating") == 1]
    poor = [s for s in signs if s.get("condition_rating") == 2]
    fair = [s for s in signs if s.get("condition_rating") == 3]
    good = [s for s in signs if s.get("condition_rating", 0) >= 4]
    damaged = [s for s in signs if s.get("status") == "damaged"]
    faded = [s for s in signs if s.get("status") == "faded"]
    missing = [s for s in signs if s.get("status") == "missing"]

    # Multi-sign supports (for knockdown scenarios)
    multi_supports = [sp for sp in supports if sp.get("sign_count", 0) >= 2]

    print(f"  Critical: {len(critical)}, Poor: {len(poor)}, Fair: {len(fair)}, Good: {len(good)}")
    print(f"  Damaged: {len(damaged)}, Faded: {len(faded)}, Missing: {len(missing)}")
    print(f"  Multi-sign supports: {len(multi_supports)}")

    inspection_count = 0
    wo_count = 0
    wo_statuses = {"open": 0, "in_progress": 0, "completed": 0, "closed": 0}

    # -----------------------------------------------------------------------
    # Step 3: Generate 6 months of inspections (200+)
    # -----------------------------------------------------------------------
    print("\n--- Creating inspections (6 months of history) ---")

    # Monthly inspection batches — simulate a real program
    for month_offset in range(6):
        month_start = TODAY - timedelta(days=(6 - month_offset) * 30)
        month_end = month_start + timedelta(days=29)
        month_name = month_start.strftime("%B %Y")

        # Routine inspections: 25-35 per month
        n_routine = random.randint(25, 35)
        routine_sample = random.sample(signs, min(n_routine, len(signs)))

        for sign in routine_sample:
            condition = sign.get("condition_rating") or random.randint(3, 5)
            inspector = random.choice(all_inspector_ids) if all_inspector_ids else None

            # 80% OK, 15% monitor, 5% need action
            roll = random.random()
            if roll < 0.80:
                findings = random.choice(ROUTINE_FINDINGS)
                action = "ok"
                follow_up = False
            elif roll < 0.95:
                findings = random.choice(MONITOR_FINDINGS)
                action = "monitor"
                follow_up = False
            else:
                # Found a problem during routine inspection
                if condition <= 2:
                    findings = random.choice(PROBLEM_FINDINGS["poor"])
                    action = random.choice(["replace", "repair"])
                else:
                    findings = random.choice(MONITOR_FINDINGS)
                    action = "monitor"
                follow_up = action in ("replace", "repair")

            retro_data = {}
            if random.random() < 0.25:
                retro_val = round(random.gauss(65, 20), 1)
                retro_val = max(5, retro_val)
                retro_data = {
                    "retroreflectivity_value": retro_val,
                    "passes_minimum_retro": retro_val >= 50,
                }

            insp_date = random_date_in_range(month_start, month_end).isoformat()

            data = {
                "assets": [{
                    "asset_type": "sign",
                    "asset_id": sign["sign_id"],
                    "condition_rating": condition,
                    "findings": findings,
                    "action_recommended": action,
                    **retro_data,
                }],
                "inspection_type": "sign_retroreflectivity" if retro_data else "sign_condition",
                "inspection_date": insp_date,
                "condition_rating": condition,
                "findings": findings,
                "status": "completed",
                "follow_up_required": follow_up,
                **({"inspector_id": inspector} if inspector else {}),
            }

            result = api_post("inspections", data)
            if result:
                inspection_count += 1

                # If follow-up needed, create a WO (70% chance)
                if follow_up and random.random() < 0.70:
                    wo = api_post(f"inspections/{result['inspection_id']}/create-work-order", {})
                    if wo:
                        wo_count += 1
                        # Age the WO status based on how old it is
                        days_old = (TODAY - date.fromisoformat(insp_date)).days
                        if days_old > 60:
                            status = random.choices(["completed", "closed"], weights=[60, 40])[0]
                        elif days_old > 30:
                            status = random.choices(["completed", "in_progress", "open"], weights=[50, 30, 20])[0]
                        elif days_old > 14:
                            status = random.choices(["in_progress", "open", "completed"], weights=[40, 35, 25])[0]
                        else:
                            status = random.choices(["open", "in_progress"], weights=[60, 40])[0]

                        update_data = {"status": status}
                        if crew_chief_ids:
                            update_data["assigned_to"] = random.choice(crew_chief_ids)
                        if status in ("completed", "closed"):
                            completion_date = date.fromisoformat(insp_date) + timedelta(days=random.randint(3, 30))
                            if completion_date > TODAY:
                                completion_date = TODAY
                            update_data["completed_date"] = completion_date.isoformat()
                            update_data["notes"] = random.choice([
                                "Sign replaced. New Type III sheeting installed.",
                                "Post straightened and re-set in concrete.",
                                "Sign face replaced. Old face recycled.",
                                "Completed as directed. Sign meets MUTCD standards.",
                                "Replacement installed. Old sign was 12+ years old.",
                            ])

                        api_put(f"work-orders/{wo['work_order_id']}", update_data)
                        wo_statuses[status] = wo_statuses.get(status, 0) + 1

        print(f"  {month_name}: {n_routine} inspections")

    # -----------------------------------------------------------------------
    # Step 4: Problem inspections on damaged/faded signs
    # -----------------------------------------------------------------------
    print("\n--- Creating targeted problem inspections ---")
    problem_pool = damaged + faded + critical[:20]
    problem_sample = random.sample(problem_pool, min(30, len(problem_pool)))

    for sign in problem_sample:
        status_type = sign.get("status", "active")
        condition = sign.get("condition_rating") or 2
        inspector = random.choice(all_inspector_ids) if all_inspector_ids else None

        if status_type == "damaged":
            findings = random.choice(PROBLEM_FINDINGS["damaged"])
            action = "replace"
        elif status_type == "faded":
            retro_val = round(random.uniform(10, 35), 1)
            template = random.choice(PROBLEM_FINDINGS["faded"])
            findings = template.format(retro=retro_val) if "{retro}" in template else template
            action = "replace"
        else:
            findings = random.choice(PROBLEM_FINDINGS["poor"])
            action = random.choice(["replace", "repair"])

        insp_date = random_date_recent(90).isoformat()
        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "condition_rating": min(condition, 2),
                "findings": findings,
                "action_recommended": action,
            }],
            "inspection_type": "sign_condition",
            "inspection_date": insp_date,
            "condition_rating": min(condition, 2),
            "findings": findings,
            "recommendations": f"{'Replace' if action == 'replace' else 'Repair'} {sign.get('mutcd_code', 'sign')} — {action} priority.",
            "status": "completed",
            "follow_up_required": True,
            **({"inspector_id": inspector} if inspector else {}),
        }

        result = api_post("inspections", data)
        if result:
            inspection_count += 1

    # -----------------------------------------------------------------------
    # Step 5: Standalone work orders — knockdowns, complaints, routine
    # -----------------------------------------------------------------------
    print("\n--- Creating standalone work orders ---")

    # Emergency knockdowns (1-2 per month for 6 months)
    for month_offset in range(6):
        month_start = TODAY - timedelta(days=(6 - month_offset) * 30)
        n_knockdowns = random.randint(1, 3)

        for _ in range(n_knockdowns):
            # Prefer multi-sign supports for knockdowns
            if multi_supports and random.random() < 0.6:
                support = random.choice(multi_supports)
                support_signs = api_get(f"supports/{support['support_id']}/signs")
                if support_signs:
                    road = support_signs[0].get("road_name", "Unknown")
                    cross = support_signs[0].get("intersection_with", "")
                    desc = random.choice(WO_DESCRIPTIONS["knockdown"]).format(
                        road=road, cross=cross or "unknown", n=len(support_signs)
                    )
                    data = {
                        "support_id": support["support_id"],
                        "description": desc,
                        "work_type": "replacement",
                        "priority": "emergency",
                        "address": f"{road}{' & ' + cross if cross else ''}",
                    }
                else:
                    continue
            else:
                sign = random.choice(damaged) if damaged else random.choice(signs)
                desc = f"Vehicle knockdown — {sign.get('mutcd_code', 'sign')} at {sign.get('road_name', 'unknown')}"
                data = {
                    "assets": [{
                        "asset_type": "sign",
                        "asset_id": sign["sign_id"],
                        "action_required": "replace",
                        "damage_notes": "Vehicle impact — sign knocked down.",
                    }],
                    "description": desc,
                    "work_type": "replacement",
                    "priority": "emergency",
                    "address": sign.get("road_name", ""),
                }

            wo = api_post("work-orders", data)
            if wo:
                wo_count += 1
                wo_date = random_date_in_range(month_start, month_start + timedelta(days=29))
                days_old = (TODAY - wo_date).days

                # Emergencies get resolved fast
                if days_old > 7:
                    status = "completed"
                elif days_old > 2:
                    status = random.choices(["completed", "in_progress"], weights=[70, 30])[0]
                else:
                    status = random.choices(["open", "in_progress"], weights=[40, 60])[0]

                update = {"status": status}
                if crew_chief_ids:
                    update["assigned_to"] = random.choice(crew_chief_ids)
                if status == "completed":
                    completion = wo_date + timedelta(days=random.randint(1, 5))
                    if completion > TODAY:
                        completion = TODAY
                    update["completed_date"] = completion.isoformat()
                    update["notes"] = random.choice([
                        "Post replaced. All signs reinstalled.",
                        "Emergency response — signs up within 24 hours.",
                        "Post and signs replaced. Temporary signs removed.",
                        "Knockdown repaired. Post reset in new concrete base.",
                    ])

                api_put(f"work-orders/{wo['work_order_id']}", update)
                wo_statuses[status] = wo_statuses.get(status, 0) + 1

    print(f"  Emergency knockdowns: ~{6 * 2}")

    # Urgent replacements (3-5 per month)
    for month_offset in range(6):
        month_start = TODAY - timedelta(days=(6 - month_offset) * 30)
        n_urgent = random.randint(3, 5)

        for _ in range(n_urgent):
            sign = random.choice(critical + poor) if (critical + poor) else random.choice(signs)
            cross = sign.get("intersection_with", "")
            desc = random.choice(WO_DESCRIPTIONS["replacement"]).format(
                code=sign.get("mutcd_code", "sign"),
                desc=sign.get("description", ""),
                road=sign.get("road_name", ""),
                cross=cross or "unknown",
            )
            data = {
                "assets": [{
                    "asset_type": "sign",
                    "asset_id": sign["sign_id"],
                    "action_required": "replace",
                    "damage_notes": random.choice([
                        "Failed retro reading", "Sign face illegible",
                        "Sheeting delaminating", "Rust damage extensive",
                    ]),
                }],
                "description": desc,
                "work_type": "replacement",
                "priority": "urgent",
                "address": sign.get("road_name", ""),
            }

            wo = api_post("work-orders", data)
            if wo:
                wo_count += 1
                wo_date = random_date_in_range(month_start, month_start + timedelta(days=29))
                days_old = (TODAY - wo_date).days

                if days_old > 30:
                    status = random.choices(["completed", "closed", "in_progress"], weights=[50, 30, 20])[0]
                elif days_old > 14:
                    status = random.choices(["in_progress", "completed", "open"], weights=[40, 35, 25])[0]
                else:
                    status = random.choices(["open", "in_progress"], weights=[50, 50])[0]

                update = {"status": status}
                if crew_chief_ids:
                    update["assigned_to"] = random.choice(crew_chief_ids)
                if status in ("completed", "closed"):
                    completion = wo_date + timedelta(days=random.randint(5, 21))
                    if completion > TODAY:
                        completion = TODAY
                    update["completed_date"] = completion.isoformat()
                    update["notes"] = random.choice([
                        "Sign replaced with Type IX sheeting.",
                        "Replacement installed. New retro reading: 320 mcd/lux/m².",
                        "Completed. Old sign was past expected life by 3 years.",
                        "Replaced sign face. Post reused — good condition.",
                    ])

                api_put(f"work-orders/{wo['work_order_id']}", update)
                wo_statuses[status] = wo_statuses.get(status, 0) + 1

    print(f"  Urgent replacements: ~{6 * 4}")

    # Routine maintenance (5-8 per month)
    for month_offset in range(6):
        month_start = TODAY - timedelta(days=(6 - month_offset) * 30)
        n_routine = random.randint(5, 8)

        for _ in range(n_routine):
            sign = random.choice(fair + good) if (fair + good) else random.choice(signs)
            work_type = random.choices(["repair", "replacement", "new_install"], weights=[50, 30, 20])[0]
            cross = sign.get("intersection_with", "")

            if work_type == "new_install":
                desc_templates = WO_DESCRIPTIONS["new_install"]
            elif work_type == "repair":
                desc_templates = WO_DESCRIPTIONS["repair"]
            else:
                desc_templates = WO_DESCRIPTIONS["replacement"]

            desc = random.choice(desc_templates).format(
                code=sign.get("mutcd_code", "sign"),
                desc=sign.get("description", ""),
                road=sign.get("road_name", ""),
                cross=cross or "unknown",
            )

            data = {
                "assets": [{
                    "asset_type": "sign",
                    "asset_id": sign["sign_id"],
                    "action_required": random.choice(["repair", "replace", "inspect"]),
                }],
                "description": desc,
                "work_type": work_type,
                "priority": "routine",
                "address": sign.get("road_name", ""),
            }

            wo = api_post("work-orders", data)
            if wo:
                wo_count += 1
                wo_date = random_date_in_range(month_start, month_start + timedelta(days=29))
                days_old = (TODAY - wo_date).days

                if days_old > 45:
                    status = random.choices(["completed", "closed"], weights=[60, 40])[0]
                elif days_old > 21:
                    status = random.choices(["completed", "in_progress", "open"], weights=[40, 35, 25])[0]
                elif days_old > 7:
                    status = random.choices(["in_progress", "open"], weights=[50, 50])[0]
                else:
                    status = "open"

                update = {"status": status}
                if crew_chief_ids:
                    update["assigned_to"] = random.choice(crew_chief_ids)
                if status in ("completed", "closed"):
                    completion = wo_date + timedelta(days=random.randint(7, 45))
                    if completion > TODAY:
                        completion = TODAY
                    update["completed_date"] = completion.isoformat()
                    update["notes"] = random.choice([
                        "Work completed as specified.",
                        "Repair completed. Sign back to standard.",
                        "Installed per traffic study recommendations.",
                        "Vegetation trimmed. Sign now fully visible.",
                        "Post straightened and re-anchored.",
                    ])

                api_put(f"work-orders/{wo['work_order_id']}", update)
                wo_statuses[status] = wo_statuses.get(status, 0) + 1

    print(f"  Routine maintenance: ~{6 * 6}")

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("SPRINGFIELD DPW — TEST DATA COMPLETE")
    print("=" * 60)
    print(f"  Users:         {len(user_ids)}")
    print(f"  Inspections:   {inspection_count}")
    print(f"  Work Orders:   {wo_count}")
    print(f"  WO Status Breakdown:")
    for status, count in sorted(wo_statuses.items()):
        print(f"    {status:15s} {count}")
    print()


if __name__ == "__main__":
    main()
