#!/usr/bin/env python3
"""
Generate realistic work orders and inspections for Springfield DPW test data.

Requires: 2,000 signs already imported (run generate_test_signs.py first, then import).
Uses the API directly — no database dependency.

Usage:
    python3 scripts/generate_test_wo_inspections.py
"""

import json
import random
import sys
from datetime import date, timedelta

import requests

API_BASE = "http://localhost:8000/api/v1"
TENANT_ID = "22222222-2222-2222-2222-222222222222"
HEADERS = {"X-Tenant-ID": TENANT_ID, "Content-Type": "application/json"}


def get_signs(limit=200):
    """Fetch signs from the API."""
    r = requests.get(f"{API_BASE}/signs", headers=HEADERS, params={"page_size": limit})
    r.raise_for_status()
    return r.json()["signs"]


def get_supports(limit=200):
    """Fetch supports from the API."""
    r = requests.get(f"{API_BASE}/supports", headers=HEADERS, params={"page_size": limit})
    r.raise_for_status()
    return r.json()["supports"]


def create_inspection(data):
    """Create an inspection via API."""
    r = requests.post(f"{API_BASE}/inspections", headers=HEADERS, json=data)
    if r.status_code == 201:
        return r.json()
    print(f"  WARN: inspection create failed: {r.status_code} {r.text[:100]}")
    return None


def create_work_order(data):
    """Create a work order via API."""
    r = requests.post(f"{API_BASE}/work-orders", headers=HEADERS, json=data)
    if r.status_code == 201:
        return r.json()
    print(f"  WARN: work order create failed: {r.status_code} {r.text[:100]}")
    return None


def create_wo_from_inspection(inspection_id):
    """Create a work order from an inspection."""
    r = requests.post(
        f"{API_BASE}/inspections/{inspection_id}/create-work-order",
        headers=HEADERS,
    )
    if r.status_code == 201:
        return r.json()
    # 409 means WO already linked — that's ok
    if r.status_code != 409:
        print(f"  WARN: create WO from inspection failed: {r.status_code} {r.text[:80]}")
    return None


def random_date(start_days_ago=180, end_days_ago=1):
    """Random date between start_days_ago and end_days_ago."""
    days = random.randint(end_days_ago, start_days_ago)
    return (date.today() - timedelta(days=days)).isoformat()


def main():
    print("Fetching existing signs...")
    signs = get_signs(1000)
    if not signs:
        print("ERROR: No signs found. Import signs first (data/springfield_signs_2000.csv).")
        sys.exit(1)
    print(f"  Found {len(signs)} signs")

    supports = get_supports(200)
    print(f"  Found {len(supports)} supports")

    # --- Categorize signs by condition for realistic scenarios ---
    critical_signs = [s for s in signs if s.get("condition_rating") == 1]
    poor_signs = [s for s in signs if s.get("condition_rating") == 2]
    fair_signs = [s for s in signs if s.get("condition_rating") == 3]
    good_signs = [s for s in signs if s.get("condition_rating") == 4]
    damaged_signs = [s for s in signs if s.get("status") == "damaged"]
    faded_signs = [s for s in signs if s.get("status") == "faded"]
    missing_signs = [s for s in signs if s.get("status") == "missing"]

    print(f"\n  Critical: {len(critical_signs)}, Poor: {len(poor_signs)}, Fair: {len(fair_signs)}")
    print(f"  Damaged: {len(damaged_signs)}, Faded: {len(faded_signs)}, Missing: {len(missing_signs)}")

    inspection_count = 0
    wo_count = 0
    wo_from_insp_count = 0

    # =========================================================
    # 1. ROUTINE INSPECTIONS — inspect random signs, mostly OK
    # =========================================================
    print("\n--- Creating routine inspections (40) ---")
    routine_sample = random.sample(signs, min(40, len(signs)))
    for sign in routine_sample:
        condition = sign.get("condition_rating") or random.randint(3, 5)
        retro = round(random.uniform(30, 80), 1) if random.random() < 0.3 else None
        passes = retro is not None and retro >= 50

        actions = ["ok", "ok", "ok", "monitor"]
        action = random.choice(actions)

        findings = random.choice([
            "Sign in acceptable condition.",
            "No issues observed.",
            "Minor dirt buildup, otherwise good.",
            "Sign face clean and legible.",
            "Sheeting intact, no peeling.",
            "Post stable, sign properly oriented.",
        ]) if action == "ok" else "Minor wear observed. Monitor on next cycle."

        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "condition_rating": condition,
                "findings": findings,
                "action_recommended": action,
                **({"retroreflectivity_value": retro, "passes_minimum_retro": passes} if retro else {}),
            }],
            "inspection_type": random.choice(["sign_condition", "sign_condition", "sign_retroreflectivity"]),
            "inspection_date": random_date(180, 7),
            "condition_rating": condition,
            "findings": findings,
            "status": "completed",
            "follow_up_required": action != "ok",
        }

        result = create_inspection(data)
        if result:
            inspection_count += 1
            if inspection_count % 10 == 0:
                print(f"  Created {inspection_count} inspections...")

    # =========================================================
    # 2. PROBLEM INSPECTIONS — damaged/faded/critical signs
    # =========================================================
    print("\n--- Creating problem inspections (20) ---")
    problem_signs = (damaged_signs + faded_signs + critical_signs + poor_signs)[:30]
    problem_sample = random.sample(problem_signs, min(20, len(problem_signs)))

    problem_inspections = []
    for sign in problem_sample:
        status = sign.get("status", "active")
        condition = sign.get("condition_rating") or random.randint(1, 2)

        if status == "damaged":
            findings = random.choice([
                "Sign face cracked from vehicle impact.",
                "Sign bent at 45 degrees, not readable.",
                "Sign knocked off post, lying on ground.",
                "Vandalism damage — graffiti covering sign face.",
            ])
            action = "replace"
        elif status == "faded":
            retro_val = round(random.uniform(10, 35), 1)
            findings = f"Sheeting severely deteriorated. Retro reading {retro_val} mcd/lux/m² — below MUTCD minimum."
            action = "replace"
        elif condition <= 2:
            findings = random.choice([
                "Sign face peeling, legend barely visible.",
                "Significant rust on sign edges.",
                "Post leaning, sign not at proper height.",
                "Background color faded beyond recognition.",
            ])
            action = random.choice(["replace", "repair"])
        else:
            findings = "Wear observed, recommend monitoring."
            action = "monitor"

        recommendations = {
            "replace": f"Replace {sign.get('mutcd_code', 'sign')} sign face. Priority: {'urgent' if condition <= 2 else 'routine'}.",
            "repair": f"Repair {sign.get('mutcd_code', 'sign')} — straighten post and clean face.",
            "monitor": "Re-inspect in 6 months.",
        }.get(action, "")

        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "condition_rating": condition,
                "findings": findings,
                "action_recommended": action,
            }],
            "inspection_type": "sign_condition",
            "inspection_date": random_date(90, 1),
            "condition_rating": condition,
            "findings": findings,
            "recommendations": recommendations,
            "status": "completed",
            "follow_up_required": action in ("replace", "repair"),
        }

        result = create_inspection(data)
        if result:
            inspection_count += 1
            if action in ("replace", "repair"):
                problem_inspections.append(result)

    # =========================================================
    # 3. CREATE WORK ORDERS FROM PROBLEM INSPECTIONS
    # =========================================================
    print(f"\n--- Creating work orders from {len(problem_inspections)} problem inspections ---")
    for insp in problem_inspections[:12]:
        wo = create_wo_from_inspection(insp["inspection_id"])
        if wo:
            wo_from_insp_count += 1
            print(f"  {wo.get('work_order_number', '?')} from {insp.get('inspection_number', '?')}")

    # =========================================================
    # 4. STANDALONE WORK ORDERS — knockdowns, complaints, etc.
    # =========================================================
    print("\n--- Creating standalone work orders (15) ---")

    # Emergency knockdowns
    for i in range(3):
        sign = random.choice(damaged_signs) if damaged_signs else random.choice(signs)
        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "action_required": "replace",
                "damage_notes": "Vehicle impact — sign knocked down.",
            }],
            "description": f"Vehicle knockdown — {sign.get('mutcd_code', 'sign')} at {sign.get('road_name', 'unknown')}",
            "work_type": "replacement",
            "priority": "emergency",
            "address": sign.get("road_name", ""),
        }
        wo = create_work_order(data)
        if wo:
            wo_count += 1
            print(f"  {wo.get('work_order_number', '?')} — EMERGENCY knockdown")

    # Urgent replacements
    for i in range(5):
        sign = random.choice(critical_signs + poor_signs) if (critical_signs + poor_signs) else random.choice(signs)
        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "action_required": "replace",
                "damage_notes": random.choice([
                    "Sign face illegible",
                    "Failed retro reading",
                    "Sheeting peeling off",
                    "Rust damage",
                ]),
            }],
            "description": f"Replace {sign.get('mutcd_code', 'sign')} — {sign.get('description', '')} on {sign.get('road_name', '')}",
            "work_type": "replacement",
            "priority": "urgent",
            "address": sign.get("road_name", ""),
            "due_date": (date.today() + timedelta(days=random.randint(7, 30))).isoformat(),
        }
        wo = create_work_order(data)
        if wo:
            wo_count += 1

    # Routine maintenance
    for i in range(5):
        sign = random.choice(fair_signs) if fair_signs else random.choice(signs)
        work_type = random.choice(["repair", "replacement", "inspection"])
        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "action_required": random.choice(["repair", "replace", "inspect"]),
            }],
            "description": f"Scheduled {work_type} — {sign.get('mutcd_code', '')} on {sign.get('road_name', '')}",
            "work_type": work_type,
            "priority": "routine",
            "address": sign.get("road_name", ""),
            "due_date": (date.today() + timedelta(days=random.randint(14, 60))).isoformat(),
        }
        wo = create_work_order(data)
        if wo:
            wo_count += 1

    # Planned work
    for i in range(2):
        sign = random.choice(good_signs) if good_signs else random.choice(signs)
        data = {
            "assets": [{
                "asset_type": "sign",
                "asset_id": sign["sign_id"],
                "action_required": "inspect",
            }],
            "description": f"Scheduled retro reading — {sign.get('mutcd_code', '')} on {sign.get('road_name', '')}",
            "work_type": "inspection",
            "priority": "planned",
            "address": sign.get("road_name", ""),
            "due_date": (date.today() + timedelta(days=random.randint(30, 90))).isoformat(),
        }
        wo = create_work_order(data)
        if wo:
            wo_count += 1

    # =========================================================
    # SUMMARY
    # =========================================================
    print("\n" + "=" * 50)
    print("TEST DATA GENERATION COMPLETE")
    print("=" * 50)
    print(f"  Inspections created:           {inspection_count}")
    print(f"  Work orders from inspections:  {wo_from_insp_count}")
    print(f"  Standalone work orders:        {wo_count}")
    print(f"  Total work orders:             {wo_count + wo_from_insp_count}")
    print()


if __name__ == "__main__":
    main()
