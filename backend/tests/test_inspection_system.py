"""
Inspection system tests.

Tests the full inspection lifecycle: CRUD, multi-asset, sign auto-update,
create-work-order-from-inspection, and tenant isolation.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


# --- Helpers ---

async def _create_sign(client, headers, lon=-89.65, lat=39.78, mutcd_code="R1-1", support_id=None):
    payload = {
        "longitude": lon,
        "latitude": lat,
        "mutcd_code": mutcd_code,
        "description": "Test sign",
        "status": "active",
    }
    if support_id:
        payload["support_id"] = str(support_id)
    resp = await client.post("/api/v1/signs", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_support(client, headers, lon=-89.65, lat=39.78, support_type="u_channel"):
    resp = await client.post("/api/v1/supports", json={
        "support_type": support_type,
        "longitude": lon,
        "latitude": lat,
        "status": "active",
    }, headers=headers)
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _create_inspection(client, headers, **kwargs):
    payload = {
        "inspection_type": "sign_condition",
        "inspection_date": "2026-03-22",
        "status": "completed",
        "follow_up_required": False,
    }
    payload.update(kwargs)
    resp = await client.post("/api/v1/inspections", json=payload, headers=headers)
    return resp


# --- CRUD Tests ---

@pytest.mark.asyncio
async def test_create_inspection_basic(seeded_client):
    resp = await _create_inspection(seeded_client, tenant_a_headers())
    assert resp.status_code == 201
    data = resp.json()
    assert data["inspection_type"] == "sign_condition"
    assert data["status"] == "completed"
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["assets"] == []


@pytest.mark.asyncio
async def test_update_inspection(seeded_client):
    create_resp = await _create_inspection(
        seeded_client, tenant_a_headers(), status="open"
    )
    assert create_resp.status_code == 201
    insp_id = create_resp.json()["inspection_id"]

    update_resp = await seeded_client.put(
        f"/api/v1/inspections/{insp_id}",
        json={
            "status": "completed",
            "condition_rating": 2,
            "findings": "Sign heavily faded",
            "recommendations": "Replace within 30 days",
        },
        headers=tenant_a_headers(),
    )
    assert update_resp.status_code == 200
    data = update_resp.json()
    assert data["status"] == "completed"
    assert data["condition_rating"] == 2
    assert data["findings"] == "Sign heavily faded"
    assert data["recommendations"] == "Replace within 30 days"


@pytest.mark.asyncio
async def test_update_inspection_not_found(seeded_client):
    resp = await seeded_client.put(
        f"/api/v1/inspections/{uuid.uuid4()}",
        json={"status": "completed"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_inspection_open(seeded_client):
    create_resp = await _create_inspection(
        seeded_client, tenant_a_headers(), status="open"
    )
    insp_id = create_resp.json()["inspection_id"]

    del_resp = await seeded_client.delete(
        f"/api/v1/inspections/{insp_id}", headers=tenant_a_headers()
    )
    assert del_resp.status_code == 204

    # Verify gone
    get_resp = await seeded_client.get(
        f"/api/v1/inspections/{insp_id}", headers=tenant_a_headers()
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_inspection_cancelled(seeded_client):
    create_resp = await _create_inspection(
        seeded_client, tenant_a_headers(), status="cancelled"
    )
    insp_id = create_resp.json()["inspection_id"]

    del_resp = await seeded_client.delete(
        f"/api/v1/inspections/{insp_id}", headers=tenant_a_headers()
    )
    assert del_resp.status_code == 204


@pytest.mark.asyncio
async def test_delete_inspection_completed_blocked(seeded_client):
    create_resp = await _create_inspection(
        seeded_client, tenant_a_headers(), status="completed"
    )
    insp_id = create_resp.json()["inspection_id"]

    del_resp = await seeded_client.delete(
        f"/api/v1/inspections/{insp_id}", headers=tenant_a_headers()
    )
    assert del_resp.status_code == 409
    assert "completed" in del_resp.json()["detail"]


@pytest.mark.asyncio
async def test_delete_inspection_not_found(seeded_client):
    del_resp = await seeded_client.delete(
        f"/api/v1/inspections/{uuid.uuid4()}", headers=tenant_a_headers()
    )
    assert del_resp.status_code == 404


# --- Multi-Asset Inspection Tests ---

@pytest.mark.asyncio
async def test_create_inspection_with_support_id(seeded_client):
    """support_id auto-attaches support + all its signs."""
    support = await _create_support(seeded_client, tenant_a_headers())
    sign1 = await _create_sign(
        seeded_client, tenant_a_headers(),
        support_id=support["support_id"], mutcd_code="R1-1",
    )
    sign2 = await _create_sign(
        seeded_client, tenant_a_headers(),
        support_id=support["support_id"], mutcd_code="W1-1",
    )

    resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        support_id=support["support_id"],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 3  # 1 support + 2 signs

    asset_types = [a["asset_type"] for a in data["assets"]]
    assert "sign_support" in asset_types
    assert asset_types.count("sign") == 2


@pytest.mark.asyncio
async def test_create_inspection_with_explicit_assets(seeded_client):
    """Explicit assets list with per-asset condition data."""
    sign = await _create_sign(seeded_client, tenant_a_headers())

    resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        assets=[{
            "asset_type": "sign",
            "asset_id": sign["sign_id"],
            "condition_rating": 2,
            "findings": "Sign faded beyond legibility",
            "retroreflectivity_value": 30.5,
            "passes_minimum_retro": False,
            "action_recommended": "replace",
            "status": "needs_action",
        }],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 1
    asset = data["assets"][0]
    assert asset["condition_rating"] == 2
    assert asset["retroreflectivity_value"] == 30.5
    assert asset["passes_minimum_retro"] is False
    assert asset["action_recommended"] == "replace"
    assert asset["status"] == "needs_action"


@pytest.mark.asyncio
async def test_create_inspection_with_sign_id_creates_ia(seeded_client):
    """Legacy sign_id creates an InspectionAsset for backward compat."""
    sign = await _create_sign(seeded_client, tenant_a_headers())

    resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        sign_id=sign["sign_id"],
        condition_rating=3,
        findings="Minor fading",
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["asset_type"] == "sign"
    assert data["assets"][0]["asset_id"] == sign["sign_id"]
    assert data["assets"][0]["condition_rating"] == 3


# --- Sign Auto-Update Tests ---

@pytest.mark.asyncio
async def test_sign_auto_update_from_inspection(seeded_client):
    """Inspection condition rating and retro values update the sign record."""
    sign = await _create_sign(seeded_client, tenant_a_headers())
    sign_id = sign["sign_id"]

    # Verify sign starts with no condition data
    get_resp = await seeded_client.get(
        f"/api/v1/signs/{sign_id}", headers=tenant_a_headers()
    )
    assert get_resp.json()["condition_rating"] is None
    assert get_resp.json()["last_inspected_date"] is None

    # Create inspection with per-asset data
    resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        assets=[{
            "asset_type": "sign",
            "asset_id": sign_id,
            "condition_rating": 3,
            "retroreflectivity_value": 85.0,
            "passes_minimum_retro": True,
        }],
    )
    assert resp.status_code == 201

    # Verify sign was updated
    get_resp = await seeded_client.get(
        f"/api/v1/signs/{sign_id}", headers=tenant_a_headers()
    )
    updated_sign = get_resp.json()
    assert updated_sign["condition_rating"] == 3
    assert updated_sign["last_inspected_date"] == "2026-03-22"
    assert updated_sign["measured_value"] == 85.0
    assert updated_sign["passes_minimum"] is True


# --- Create Work Order from Inspection Tests ---

@pytest.mark.asyncio
async def test_create_wo_from_inspection(seeded_client):
    """Full data passthrough from inspection to work order."""
    sign = await _create_sign(
        seeded_client, tenant_a_headers(),
        mutcd_code="R1-1",
    )
    sign_id = sign["sign_id"]

    # Create inspection with actionable findings
    insp_resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        findings="Sign completely faded, no longer legible",
        recommendations="Replace immediately",
        condition_rating=1,
        assets=[{
            "asset_type": "sign",
            "asset_id": sign_id,
            "condition_rating": 1,
            "findings": "Faded beyond legibility",
            "action_recommended": "replace",
            "status": "needs_action",
        }],
    )
    assert insp_resp.status_code == 201
    insp_id = insp_resp.json()["inspection_id"]

    # Create work order from inspection
    wo_resp = await seeded_client.post(
        f"/api/v1/inspections/{insp_id}/create-work-order",
        headers=tenant_a_headers(),
    )
    assert wo_resp.status_code == 201
    wo = wo_resp.json()

    # Verify WO data was carried forward
    assert wo["work_type"] == "replacement"  # Because action_recommended was "replace"
    assert wo["priority"] == "urgent"  # Because condition_rating was 1
    assert "faded" in wo["description"].lower()
    assert str(insp_id) in wo["notes"]
    assert wo["work_order_number"] is not None

    # Verify WO has the sign asset
    assert len(wo["assets"]) == 1
    assert wo["assets"][0]["asset_type"] == "sign"
    assert wo["assets"][0]["asset_id"] == sign_id
    assert wo["assets"][0]["action_required"] == "replace"
    assert wo["assets"][0]["damage_notes"] == "Faded beyond legibility"

    # Verify inspection was updated with follow-up link
    insp_get = await seeded_client.get(
        f"/api/v1/inspections/{insp_id}", headers=tenant_a_headers()
    )
    insp_data = insp_get.json()
    assert insp_data["follow_up_required"] is True
    assert insp_data["follow_up_work_order_id"] == wo["work_order_id"]


@pytest.mark.asyncio
async def test_create_wo_from_inspection_priority_mapping(seeded_client):
    """Verify condition rating -> priority mapping."""
    sign = await _create_sign(seeded_client, tenant_a_headers())

    # Condition 4 = planned
    insp_resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        condition_rating=4,
        assets=[{
            "asset_type": "sign",
            "asset_id": sign["sign_id"],
            "condition_rating": 4,
            "action_recommended": "monitor",
        }],
    )
    insp_id = insp_resp.json()["inspection_id"]

    wo_resp = await seeded_client.post(
        f"/api/v1/inspections/{insp_id}/create-work-order",
        headers=tenant_a_headers(),
    )
    assert wo_resp.status_code == 201
    assert wo_resp.json()["priority"] == "planned"


@pytest.mark.asyncio
async def test_create_wo_from_inspection_already_linked(seeded_client):
    """Cannot create a second WO from the same inspection."""
    insp_resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        findings="Test",
    )
    insp_id = insp_resp.json()["inspection_id"]

    # First WO creation succeeds
    wo_resp = await seeded_client.post(
        f"/api/v1/inspections/{insp_id}/create-work-order",
        headers=tenant_a_headers(),
    )
    assert wo_resp.status_code == 201

    # Second attempt fails
    wo_resp2 = await seeded_client.post(
        f"/api/v1/inspections/{insp_id}/create-work-order",
        headers=tenant_a_headers(),
    )
    assert wo_resp2.status_code == 409


@pytest.mark.asyncio
async def test_create_wo_from_inspection_not_found(seeded_client):
    resp = await seeded_client.post(
        f"/api/v1/inspections/{uuid.uuid4()}/create-work-order",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- Sign/Support Inspection List Endpoints ---

@pytest.mark.asyncio
async def test_list_sign_inspections(seeded_client):
    sign = await _create_sign(seeded_client, tenant_a_headers())
    sign_id = sign["sign_id"]

    # Create 2 inspections linked to this sign via assets
    for _ in range(2):
        resp = await _create_inspection(
            seeded_client, tenant_a_headers(),
            assets=[{"asset_type": "sign", "asset_id": sign_id}],
        )
        assert resp.status_code == 201

    # Create 1 unrelated inspection
    await _create_inspection(seeded_client, tenant_a_headers())

    # List inspections for this sign
    list_resp = await seeded_client.get(
        f"/api/v1/signs/{sign_id}/inspections", headers=tenant_a_headers()
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_list_support_inspections(seeded_client):
    support = await _create_support(seeded_client, tenant_a_headers())
    support_id = support["support_id"]

    # Create inspection linked via support_id
    resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        support_id=support_id,
    )
    assert resp.status_code == 201

    # List inspections for this support
    list_resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}/inspections",
        headers=tenant_a_headers(),
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 1


# --- Tenant Isolation Tests ---

@pytest.mark.asyncio
async def test_inspection_tenant_isolation(seeded_client):
    """Tenant A cannot see or modify Tenant B's inspections."""
    resp_a = await _create_inspection(seeded_client, tenant_a_headers())
    insp_id = resp_a.json()["inspection_id"]

    # Tenant B cannot get it
    get_b = await seeded_client.get(
        f"/api/v1/inspections/{insp_id}", headers=tenant_b_headers()
    )
    assert get_b.status_code == 404

    # Tenant B cannot update it
    put_b = await seeded_client.put(
        f"/api/v1/inspections/{insp_id}",
        json={"status": "cancelled"},
        headers=tenant_b_headers(),
    )
    assert put_b.status_code == 404

    # Tenant B list is empty
    list_b = await seeded_client.get(
        "/api/v1/inspections", headers=tenant_b_headers()
    )
    assert list_b.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_inspections_filter_follow_up(seeded_client):
    """Filter inspections by follow_up_required."""
    await _create_inspection(
        seeded_client, tenant_a_headers(), follow_up_required=True
    )
    await _create_inspection(
        seeded_client, tenant_a_headers(), follow_up_required=False
    )
    await _create_inspection(
        seeded_client, tenant_a_headers(), follow_up_required=True
    )

    resp = await seeded_client.get(
        "/api/v1/inspections?follow_up_required=true",
        headers=tenant_a_headers(),
    )
    assert resp.json()["total"] == 2


@pytest.mark.asyncio
async def test_inspection_with_asset_labels(seeded_client):
    """Verify asset labels are populated in responses."""
    sign = await _create_sign(
        seeded_client, tenant_a_headers(), mutcd_code="R1-1"
    )

    resp = await _create_inspection(
        seeded_client, tenant_a_headers(),
        assets=[{
            "asset_type": "sign",
            "asset_id": sign["sign_id"],
            "condition_rating": 4,
        }],
    )
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 1
    # Asset label should be populated with MUTCD code
    label = data["assets"][0]["asset_label"]
    assert label is not None
    assert "R1-1" in label
