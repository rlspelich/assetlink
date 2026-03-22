"""
Tenant isolation tests.

These are the most critical security tests in the platform. Every data
endpoint MUST enforce tenant_id filtering. A sign created by Tenant A
must NEVER be visible to Tenant B.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


@pytest.mark.asyncio
async def test_missing_tenant_header_rejected(client):
    """Requests without X-Tenant-ID must be rejected."""
    resp = await client.get("/api/v1/signs")
    assert resp.status_code == 400
    assert "X-Tenant-ID" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_invalid_tenant_header_rejected(client):
    """Requests with a non-UUID tenant ID must be rejected."""
    resp = await client.get("/api/v1/signs", headers={"X-Tenant-ID": "not-a-uuid"})
    assert resp.status_code == 400
    assert "valid UUID" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_sign_isolation_between_tenants(seeded_client):
    """A sign created by Tenant A must not appear in Tenant B's list."""
    # Tenant A creates a sign
    resp = await seeded_client.post("/api/v1/signs", json={
        "mutcd_code": "R1-1",
        "description": "Tenant A stop sign",
        "road_name": "Alpha Street",
        "status": "active",
        "longitude": -89.65,
        "latitude": 39.78,
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    sign_id = resp.json()["sign_id"]

    # Tenant A can see it
    resp = await seeded_client.get("/api/v1/signs", headers=tenant_a_headers())
    assert resp.status_code == 200
    signs_a = resp.json()["signs"]
    assert any(s["sign_id"] == sign_id for s in signs_a)

    # Tenant B cannot see it
    resp = await seeded_client.get("/api/v1/signs", headers=tenant_b_headers())
    assert resp.status_code == 200
    signs_b = resp.json()["signs"]
    assert not any(s["sign_id"] == sign_id for s in signs_b)


@pytest.mark.asyncio
async def test_sign_get_by_id_isolation(seeded_client):
    """Tenant B cannot fetch Tenant A's sign by ID."""
    # Tenant A creates a sign
    resp = await seeded_client.post("/api/v1/signs", json={
        "description": "Secret sign",
        "status": "active",
        "longitude": -89.65,
        "latitude": 39.78,
    }, headers=tenant_a_headers())
    sign_id = resp.json()["sign_id"]

    # Tenant B tries to get it by ID
    resp = await seeded_client.get(f"/api/v1/signs/{sign_id}", headers=tenant_b_headers())
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sign_update_isolation(seeded_client):
    """Tenant B cannot update Tenant A's sign."""
    resp = await seeded_client.post("/api/v1/signs", json={
        "description": "Original",
        "status": "active",
        "longitude": -89.65,
        "latitude": 39.78,
    }, headers=tenant_a_headers())
    sign_id = resp.json()["sign_id"]

    # Tenant B tries to update it
    resp = await seeded_client.put(f"/api/v1/signs/{sign_id}", json={
        "description": "Hacked",
    }, headers=tenant_b_headers())
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_sign_delete_isolation(seeded_client):
    """Tenant B cannot delete Tenant A's sign."""
    resp = await seeded_client.post("/api/v1/signs", json={
        "description": "Protected sign",
        "status": "active",
        "longitude": -89.65,
        "latitude": 39.78,
    }, headers=tenant_a_headers())
    sign_id = resp.json()["sign_id"]

    # Tenant B tries to delete it
    resp = await seeded_client.delete(f"/api/v1/signs/{sign_id}", headers=tenant_b_headers())
    assert resp.status_code == 404

    # Verify it still exists for Tenant A
    resp = await seeded_client.get(f"/api/v1/signs/{sign_id}", headers=tenant_a_headers())
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_work_order_isolation(seeded_client):
    """Work orders must be isolated between tenants."""
    # Tenant A creates a work order
    resp = await seeded_client.post("/api/v1/work-orders", json={
        "work_type": "replacement",
        "description": "Replace faded stop sign",
        "priority": "high",
        "status": "open",
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    wo_id = resp.json()["work_order_id"]

    # Tenant B cannot see it in list
    resp = await seeded_client.get("/api/v1/work-orders", headers=tenant_b_headers())
    assert resp.json()["total"] == 0

    # Tenant B cannot fetch it by ID
    resp = await seeded_client.get(f"/api/v1/work-orders/{wo_id}", headers=tenant_b_headers())
    assert resp.status_code == 404

    # Tenant B cannot update it
    resp = await seeded_client.put(f"/api/v1/work-orders/{wo_id}", json={
        "status": "closed",
    }, headers=tenant_b_headers())
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_inspection_isolation(seeded_client):
    """Inspections must be isolated between tenants."""
    resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "visual",
        "inspection_date": "2026-03-21",
        "status": "completed",
        "condition_rating": 3,
        "findings": "Sign fading",
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    insp_id = resp.json()["inspection_id"]

    # Tenant B cannot see it
    resp = await seeded_client.get("/api/v1/inspections", headers=tenant_b_headers())
    assert resp.json()["total"] == 0

    resp = await seeded_client.get(f"/api/v1/inspections/{insp_id}", headers=tenant_b_headers())
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_nonexistent_tenant_gets_empty_results(seeded_client):
    """A valid UUID that doesn't match any tenant gets empty results (not errors)."""
    fake_tenant = {"X-Tenant-ID": str(uuid.uuid4())}
    resp = await seeded_client.get("/api/v1/signs", headers=fake_tenant)
    assert resp.status_code == 200
    assert resp.json()["total"] == 0
