"""
Sign Support CRUD API tests.

Tests the full lifecycle: create, read, update, delete, list with filters,
sign attachment, geometry inheritance, and delete conflict protection.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


# --- Helpers ---


def _support_payload(**overrides):
    """Default support creation payload."""
    base = {
        "support_type": "u_channel",
        "longitude": -89.6501,
        "latitude": 39.7817,
    }
    base.update(overrides)
    return base


def _sign_payload(**overrides):
    """Default sign creation payload."""
    base = {
        "status": "active",
        "longitude": -89.6501,
        "latitude": 39.7817,
    }
    base.update(overrides)
    return base


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_support_minimal(seeded_client):
    """Create a support with only required fields."""
    resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["support_type"] == "u_channel"
    assert data["longitude"] == -89.6501
    assert data["latitude"] == 39.7817
    assert data["status"] == "active"
    assert data["sign_count"] == 0
    assert "support_id" in data


@pytest.mark.asyncio
async def test_create_support_full(seeded_client):
    """Create a support with all fields populated."""
    resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(
            support_type="square_tube",
            support_material="galvanized_steel",
            install_date="2022-06-15",
            condition_rating=4,
            height_inches=84.0,
            status="active",
            notes="Corner of Main & Elm",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["support_type"] == "square_tube"
    assert data["support_material"] == "galvanized_steel"
    assert data["install_date"] == "2022-06-15"
    assert data["condition_rating"] == 4
    assert data["height_inches"] == 84.0
    assert data["notes"] == "Corner of Main & Elm"


@pytest.mark.asyncio
async def test_create_support_missing_type(seeded_client):
    """support_type is required."""
    resp = await seeded_client.post(
        "/api/v1/supports",
        json={"longitude": -89.65, "latitude": 39.78},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_support_missing_coordinates(seeded_client):
    """Longitude and latitude are required."""
    resp = await seeded_client.post(
        "/api/v1/supports",
        json={"support_type": "u_channel"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_support_invalid_condition_rating(seeded_client):
    """Condition rating must be 1-5."""
    resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(condition_rating=6),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


# --- READ ---


@pytest.mark.asyncio
async def test_get_support_by_id(seeded_client):
    """Fetch a support by ID and verify all fields round-trip."""
    create_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(support_material="aluminum", notes="Test post"),
        headers=tenant_a_headers(),
    )
    support_id = create_resp.json()["support_id"]

    resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["support_id"] == support_id
    assert data["support_material"] == "aluminum"
    assert data["notes"] == "Test post"
    # Detail response includes signs list
    assert "signs" in data
    assert data["signs"] == []


@pytest.mark.asyncio
async def test_get_support_not_found(seeded_client):
    """404 for non-existent support."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/supports/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_support_detail_with_signs(seeded_client):
    """Get support detail includes attached signs."""
    # Create support
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    # Create two signs on the support
    for desc in ["Sign A", "Sign B"]:
        await seeded_client.post(
            "/api/v1/signs",
            json=_sign_payload(support_id=support_id, description=desc),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sign_count"] == 2
    assert len(data["signs"]) == 2
    descriptions = {s["description"] for s in data["signs"]}
    assert descriptions == {"Sign A", "Sign B"}


# --- LIST ---


@pytest.mark.asyncio
async def test_list_supports_empty(seeded_client):
    """Empty list when no supports exist."""
    resp = await seeded_client.get(
        "/api/v1/supports",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["supports"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_supports_with_sign_count(seeded_client):
    """List supports includes accurate sign_count."""
    # Create support
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    # Add 3 signs
    for _ in range(3):
        await seeded_client.post(
            "/api/v1/signs",
            json=_sign_payload(support_id=support_id),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        "/api/v1/supports",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["supports"][0]["sign_count"] == 3


@pytest.mark.asyncio
async def test_list_supports_filter_by_status(seeded_client):
    """Filter supports by status."""
    await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(status="active"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(status="damaged"),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/supports?status=damaged",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["supports"][0]["status"] == "damaged"


@pytest.mark.asyncio
async def test_list_supports_filter_by_type(seeded_client):
    """Filter supports by support_type."""
    await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(support_type="u_channel"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(support_type="mast_arm"),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/supports?support_type=mast_arm",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["supports"][0]["support_type"] == "mast_arm"


@pytest.mark.asyncio
async def test_list_supports_pagination(seeded_client):
    """Pagination works correctly."""
    for i in range(5):
        await seeded_client.post(
            "/api/v1/supports",
            json=_support_payload(longitude=-89.65 + i * 0.001),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        "/api/v1/supports?page=1&page_size=2",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 5
    assert len(data["supports"]) == 2
    assert data["page"] == 1
    assert data["page_size"] == 2

    resp2 = await seeded_client.get(
        "/api/v1/supports?page=3&page_size=2",
        headers=tenant_a_headers(),
    )
    data2 = resp2.json()
    assert len(data2["supports"]) == 1


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_support(seeded_client):
    """Update a support's fields."""
    create_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = create_resp.json()["support_id"]

    resp = await seeded_client.put(
        f"/api/v1/supports/{support_id}",
        json={"status": "damaged", "notes": "Leaning 15 degrees"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "damaged"
    assert data["notes"] == "Leaning 15 degrees"
    # Original fields preserved
    assert data["support_type"] == "u_channel"


@pytest.mark.asyncio
async def test_update_support_geometry(seeded_client):
    """Update a support's coordinates."""
    create_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = create_resp.json()["support_id"]

    resp = await seeded_client.put(
        f"/api/v1/supports/{support_id}",
        json={"longitude": -90.0, "latitude": 40.0},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert abs(data["longitude"] - (-90.0)) < 0.0001
    assert abs(data["latitude"] - 40.0) < 0.0001


@pytest.mark.asyncio
async def test_update_support_not_found(seeded_client):
    """404 for updating non-existent support."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.put(
        f"/api/v1/supports/{fake_id}",
        json={"status": "removed"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_support_empty(seeded_client):
    """Delete a support with no signs attached."""
    create_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = create_resp.json()["support_id"]

    resp = await seeded_client.delete(
        f"/api/v1/supports/{support_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}",
        headers=tenant_a_headers(),
    )
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_support_with_signs_409(seeded_client):
    """Cannot delete a support that has signs attached."""
    # Create support
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    # Attach a sign
    await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(support_id=support_id),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.delete(
        f"/api/v1/supports/{support_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 409
    assert "attached sign" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_delete_support_not_found(seeded_client):
    """404 for deleting non-existent support."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.delete(
        f"/api/v1/supports/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- SUPPORT SIGNS ENDPOINT ---


@pytest.mark.asyncio
async def test_list_support_signs(seeded_client):
    """GET /supports/{id}/signs returns signs on that support."""
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    # Create signs on this support
    await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(support_id=support_id, description="Top sign"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(support_id=support_id, description="Bottom sign"),
        headers=tenant_a_headers(),
    )

    # Create a sign NOT on this support
    await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(description="Unrelated sign"),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}/signs",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    descriptions = {s["description"] for s in data}
    assert descriptions == {"Top sign", "Bottom sign"}


@pytest.mark.asyncio
async def test_list_support_signs_not_found(seeded_client):
    """404 when support doesn't exist."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/supports/{fake_id}/signs",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_support_tenant_isolation(seeded_client):
    """Supports from one tenant are not visible to another."""
    # Create support in tenant A
    resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(),
        headers=tenant_a_headers(),
    )
    support_id = resp.json()["support_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/supports/{support_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B cannot update it
    put_resp = await seeded_client.put(
        f"/api/v1/supports/{support_id}",
        json={"status": "removed"},
        headers=tenant_b_headers(),
    )
    assert put_resp.status_code == 404

    # Tenant B cannot delete it
    del_resp = await seeded_client.delete(
        f"/api/v1/supports/{support_id}",
        headers=tenant_b_headers(),
    )
    assert del_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/supports",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# --- SIGN GEOMETRY INHERITANCE ---


@pytest.mark.asyncio
async def test_create_sign_inherits_support_geometry(seeded_client):
    """A sign created with support_id but no coords inherits support location."""
    # Create support at known location
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(longitude=-88.2434, latitude=40.1164),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    # Create sign with support_id but NO coordinates
    sign_resp = await seeded_client.post(
        "/api/v1/signs",
        json={"status": "active", "support_id": support_id, "description": "Inherited loc"},
        headers=tenant_a_headers(),
    )
    assert sign_resp.status_code == 201
    data = sign_resp.json()
    assert abs(data["longitude"] - (-88.2434)) < 0.0001
    assert abs(data["latitude"] - 40.1164) < 0.0001
    assert data["support_id"] == support_id


@pytest.mark.asyncio
async def test_create_sign_overrides_support_geometry(seeded_client):
    """A sign with explicit coords uses those even with support_id."""
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(longitude=-88.2434, latitude=40.1164),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    sign_resp = await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(
            support_id=support_id,
            longitude=-89.0,
            latitude=41.0,
        ),
        headers=tenant_a_headers(),
    )
    assert sign_resp.status_code == 201
    data = sign_resp.json()
    assert abs(data["longitude"] - (-89.0)) < 0.0001
    assert abs(data["latitude"] - 41.0) < 0.0001


@pytest.mark.asyncio
async def test_create_sign_invalid_support_id(seeded_client):
    """404 when support_id doesn't exist."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.post(
        "/api/v1/signs",
        json={"status": "active", "support_id": fake_id, "longitude": -89.65, "latitude": 39.78},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sign_response_includes_support_info(seeded_client):
    """Sign response includes support_type and support_status."""
    support_resp = await seeded_client.post(
        "/api/v1/supports",
        json=_support_payload(support_type="mast_arm", status="active"),
        headers=tenant_a_headers(),
    )
    support_id = support_resp.json()["support_id"]

    sign_resp = await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(support_id=support_id),
        headers=tenant_a_headers(),
    )
    assert sign_resp.status_code == 201
    data = sign_resp.json()
    assert data["support_type"] == "mast_arm"
    assert data["support_status"] == "active"


@pytest.mark.asyncio
async def test_sign_without_support_has_null_support_info(seeded_client):
    """Sign without support_id has null support_type/support_status."""
    sign_resp = await seeded_client.post(
        "/api/v1/signs",
        json=_sign_payload(),
        headers=tenant_a_headers(),
    )
    assert sign_resp.status_code == 201
    data = sign_resp.json()
    assert data["support_type"] is None
    assert data["support_status"] is None
