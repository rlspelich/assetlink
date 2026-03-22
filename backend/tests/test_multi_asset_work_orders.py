"""
Multi-asset work order tests.

Tests the work_order_asset junction table, support_id-based creation,
explicit assets list creation, legacy sign_id backward compat,
per-asset update endpoint, and reverse lookups from signs/supports.
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


async def _create_wo(client, headers, **kwargs):
    payload = {"work_type": "repair", "priority": "routine", "status": "open"}
    payload.update(kwargs)
    resp = await client.post("/api/v1/work-orders", json=payload, headers=headers)
    return resp


# --- Test: Create with explicit assets list ---


@pytest.mark.asyncio
async def test_create_wo_with_assets_list(seeded_client):
    """Create a work order with an explicit list of asset references."""
    sign1 = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.65, lat=39.78)
    sign2 = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.66, lat=39.79)

    resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign1["sign_id"], "damage_notes": "Faded face", "action_required": "replace"},
        {"asset_type": "sign", "asset_id": sign2["sign_id"], "action_required": "inspect"},
    ])
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 2

    # Verify per-asset data
    assets_by_id = {a["asset_id"]: a for a in data["assets"]}
    assert assets_by_id[sign1["sign_id"]]["damage_notes"] == "Faded face"
    assert assets_by_id[sign1["sign_id"]]["action_required"] == "replace"
    assert assets_by_id[sign1["sign_id"]]["status"] == "pending"
    assert assets_by_id[sign2["sign_id"]]["action_required"] == "inspect"


@pytest.mark.asyncio
async def test_create_wo_with_assets_gets_labels(seeded_client):
    """Asset labels should be populated: 'R1-1 — Stop Sign' format for signs."""
    sign = await _create_sign(seeded_client, tenant_a_headers(), mutcd_code="R1-1")

    resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign["sign_id"]},
    ])
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 1
    label = data["assets"][0]["asset_label"]
    assert label is not None
    assert "R1-1" in label


# --- Test: Create with support_id ---


@pytest.mark.asyncio
async def test_create_wo_with_support_id(seeded_client):
    """Creating a WO with support_id should add WOA for the support + all attached signs."""
    support = await _create_support(seeded_client, tenant_a_headers())
    sign1 = await _create_sign(seeded_client, tenant_a_headers(), support_id=support["support_id"])
    sign2 = await _create_sign(seeded_client, tenant_a_headers(), support_id=support["support_id"])

    resp = await _create_wo(seeded_client, tenant_a_headers(), support_id=support["support_id"])
    assert resp.status_code == 201
    data = resp.json()

    # Should have 3 assets: 1 support + 2 signs
    assert len(data["assets"]) == 3
    asset_types = [a["asset_type"] for a in data["assets"]]
    assert asset_types.count("sign_support") == 1
    assert asset_types.count("sign") == 2

    # Support label should be formatted
    support_asset = [a for a in data["assets"] if a["asset_type"] == "sign_support"][0]
    assert "Support" in support_asset["asset_label"]


@pytest.mark.asyncio
async def test_create_wo_with_support_id_not_found(seeded_client):
    """Creating a WO with a nonexistent support_id should 404."""
    resp = await _create_wo(seeded_client, tenant_a_headers(), support_id=str(uuid.uuid4()))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_wo_with_support_no_signs(seeded_client):
    """Support with no attached signs should create 1 WOA (just the support)."""
    support = await _create_support(seeded_client, tenant_a_headers())

    resp = await _create_wo(seeded_client, tenant_a_headers(), support_id=support["support_id"])
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["asset_type"] == "sign_support"


# --- Test: Legacy sign_id backward compatibility ---


@pytest.mark.asyncio
async def test_create_wo_with_legacy_sign_id(seeded_client):
    """Using the deprecated sign_id field should still create a WOA row."""
    sign = await _create_sign(seeded_client, tenant_a_headers())

    resp = await _create_wo(seeded_client, tenant_a_headers(), sign_id=sign["sign_id"])
    assert resp.status_code == 201
    data = resp.json()

    # Should have legacy sign_id set AND a WOA row
    assert data["sign_id"] == sign["sign_id"]
    assert len(data["assets"]) == 1
    assert data["assets"][0]["asset_type"] == "sign"
    assert data["assets"][0]["asset_id"] == sign["sign_id"]


# --- Test: Get / List with assets ---


@pytest.mark.asyncio
async def test_get_wo_includes_assets(seeded_client):
    """GET single work order should include assets with labels."""
    sign = await _create_sign(seeded_client, tenant_a_headers())
    create_resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign["sign_id"]},
    ])
    wo_id = create_resp.json()["work_order_id"]

    resp = await seeded_client.get(f"/api/v1/work-orders/{wo_id}", headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["assets"]) == 1
    assert data["assets"][0]["asset_id"] == sign["sign_id"]


@pytest.mark.asyncio
async def test_list_wo_includes_assets(seeded_client):
    """LIST work orders should include assets on each."""
    sign = await _create_sign(seeded_client, tenant_a_headers())
    await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign["sign_id"]},
    ])

    resp = await seeded_client.get("/api/v1/work-orders", headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert len(data["work_orders"][0]["assets"]) == 1


# --- Test: Update with assets_to_add / assets_to_remove ---


@pytest.mark.asyncio
async def test_update_wo_add_assets(seeded_client):
    """Adding assets to an existing work order via assets_to_add."""
    sign1 = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.65, lat=39.78)
    sign2 = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.66, lat=39.79)

    create_resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign1["sign_id"]},
    ])
    wo_id = create_resp.json()["work_order_id"]
    assert len(create_resp.json()["assets"]) == 1

    # Add a second sign
    resp = await seeded_client.put(f"/api/v1/work-orders/{wo_id}", json={
        "assets_to_add": [{"asset_type": "sign", "asset_id": sign2["sign_id"], "action_required": "replace"}],
    }, headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["assets"]) == 2


@pytest.mark.asyncio
async def test_update_wo_remove_assets(seeded_client):
    """Removing assets from an existing work order via assets_to_remove."""
    sign1 = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.65, lat=39.78)
    sign2 = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.66, lat=39.79)

    create_resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign1["sign_id"]},
        {"asset_type": "sign", "asset_id": sign2["sign_id"]},
    ])
    wo_id = create_resp.json()["work_order_id"]
    woa_to_remove = create_resp.json()["assets"][0]["work_order_asset_id"]

    resp = await seeded_client.put(f"/api/v1/work-orders/{wo_id}", json={
        "assets_to_remove": [woa_to_remove],
    }, headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["assets"]) == 1
    remaining_ids = [a["work_order_asset_id"] for a in data["assets"]]
    assert woa_to_remove not in remaining_ids


# --- Test: PUT /work-orders/{wo_id}/assets/{woa_id} ---


@pytest.mark.asyncio
async def test_update_work_order_asset(seeded_client):
    """Update per-asset fields on a work order asset."""
    sign = await _create_sign(seeded_client, tenant_a_headers())
    create_resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign["sign_id"]},
    ])
    wo_id = create_resp.json()["work_order_id"]
    woa_id = create_resp.json()["assets"][0]["work_order_asset_id"]

    resp = await seeded_client.put(
        f"/api/v1/work-orders/{wo_id}/assets/{woa_id}",
        json={
            "damage_notes": "Sign face is cracked",
            "action_required": "replace",
            "resolution": "Replaced with new sign",
            "status": "completed",
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["damage_notes"] == "Sign face is cracked"
    assert data["action_required"] == "replace"
    assert data["resolution"] == "Replaced with new sign"
    assert data["status"] == "completed"


@pytest.mark.asyncio
async def test_update_work_order_asset_not_found(seeded_client):
    """Update a nonexistent work order asset should 404."""
    create_resp = await _create_wo(seeded_client, tenant_a_headers())
    wo_id = create_resp.json()["work_order_id"]

    resp = await seeded_client.put(
        f"/api/v1/work-orders/{wo_id}/assets/{uuid.uuid4()}",
        json={"status": "completed"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- Test: Reverse lookup — GET /signs/{id}/work-orders via junction ---


@pytest.mark.asyncio
async def test_sign_work_orders_via_junction(seeded_client):
    """GET /signs/{id}/work-orders should find WOs linked via the junction table."""
    sign = await _create_sign(seeded_client, tenant_a_headers())
    sign_id = sign["sign_id"]

    # Create WO with explicit assets (not legacy sign_id)
    resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign_id},
    ])
    assert resp.status_code == 201

    # Query via the sign's work-orders endpoint
    resp = await seeded_client.get(
        f"/api/v1/signs/{sign_id}/work-orders", headers=tenant_a_headers()
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_sign_work_orders_legacy_still_works(seeded_client):
    """GET /signs/{id}/work-orders should still find WOs linked via legacy sign_id."""
    sign = await _create_sign(seeded_client, tenant_a_headers())
    sign_id = sign["sign_id"]

    # Create WO with legacy sign_id
    resp = await _create_wo(seeded_client, tenant_a_headers(), sign_id=sign_id)
    assert resp.status_code == 201

    resp = await seeded_client.get(
        f"/api/v1/signs/{sign_id}/work-orders", headers=tenant_a_headers()
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1


# --- Test: Reverse lookup — GET /supports/{id}/work-orders ---


@pytest.mark.asyncio
async def test_support_work_orders_via_junction(seeded_client):
    """GET /supports/{id}/work-orders should find WOs linked via the junction table."""
    support = await _create_support(seeded_client, tenant_a_headers())
    support_id = support["support_id"]

    resp = await _create_wo(seeded_client, tenant_a_headers(), support_id=support_id)
    assert resp.status_code == 201

    resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}/work-orders", headers=tenant_a_headers()
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1


@pytest.mark.asyncio
async def test_support_work_orders_not_found(seeded_client):
    """GET /supports/{id}/work-orders with nonexistent support should 404."""
    resp = await seeded_client.get(
        f"/api/v1/supports/{uuid.uuid4()}/work-orders", headers=tenant_a_headers()
    )
    assert resp.status_code == 404


# --- Test: Cascade delete ---


@pytest.mark.asyncio
async def test_delete_wo_cascades_to_assets(seeded_client):
    """Deleting a work order should cascade-delete its work_order_asset rows."""
    sign = await _create_sign(seeded_client, tenant_a_headers())

    create_resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign["sign_id"]},
    ])
    wo_id = create_resp.json()["work_order_id"]

    # Delete the WO
    resp = await seeded_client.delete(f"/api/v1/work-orders/{wo_id}", headers=tenant_a_headers())
    assert resp.status_code == 204

    # Verify WO is gone
    resp = await seeded_client.get(f"/api/v1/work-orders/{wo_id}", headers=tenant_a_headers())
    assert resp.status_code == 404

    # Verify the sign's work-orders are empty
    resp = await seeded_client.get(
        f"/api/v1/signs/{sign['sign_id']}/work-orders", headers=tenant_a_headers()
    )
    assert resp.json()["total"] == 0


# --- Test: Tenant isolation on multi-asset WOs ---


@pytest.mark.asyncio
async def test_multi_asset_wo_tenant_isolation(seeded_client):
    """Work order assets should be isolated per tenant."""
    sign_a = await _create_sign(seeded_client, tenant_a_headers())
    sign_b = await _create_sign(seeded_client, tenant_b_headers())

    # Create WO for tenant A
    resp_a = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign_a["sign_id"]},
    ])
    assert resp_a.status_code == 201
    wo_a_id = resp_a.json()["work_order_id"]

    # Tenant B should not see tenant A's WO
    resp = await seeded_client.get(f"/api/v1/work-orders/{wo_a_id}", headers=tenant_b_headers())
    assert resp.status_code == 404

    # Tenant B's sign should have no work orders
    resp = await seeded_client.get(
        f"/api/v1/signs/{sign_b['sign_id']}/work-orders", headers=tenant_b_headers()
    )
    assert resp.json()["total"] == 0


# --- Test: WO without any assets (backward compat) ---


@pytest.mark.asyncio
async def test_create_wo_without_assets(seeded_client):
    """Creating a WO with no sign_id, support_id, or assets should work (empty assets list)."""
    resp = await _create_wo(seeded_client, tenant_a_headers())
    assert resp.status_code == 201
    data = resp.json()
    assert data["assets"] == []


# --- Test: Mixed signs and supports in one WO ---


@pytest.mark.asyncio
async def test_create_wo_with_mixed_asset_types(seeded_client):
    """Create a WO with both sign and sign_support assets."""
    support = await _create_support(seeded_client, tenant_a_headers())
    sign = await _create_sign(seeded_client, tenant_a_headers(), lon=-89.70, lat=39.80)

    resp = await _create_wo(seeded_client, tenant_a_headers(), assets=[
        {"asset_type": "sign", "asset_id": sign["sign_id"], "action_required": "inspect"},
        {"asset_type": "sign_support", "asset_id": support["support_id"], "action_required": "replace"},
    ])
    assert resp.status_code == 201
    data = resp.json()
    assert len(data["assets"]) == 2

    types = {a["asset_type"] for a in data["assets"]}
    assert types == {"sign", "sign_support"}
