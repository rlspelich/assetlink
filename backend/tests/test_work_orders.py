"""
Work order CRUD API tests.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, tenant_a_headers


@pytest.mark.asyncio
async def test_create_work_order(seeded_client):
    resp = await seeded_client.post("/api/v1/work-orders", json={
        "work_type": "replacement",
        "description": "Replace faded stop sign",
        "priority": "high",
        "status": "open",
        "address": "100 Main St",
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    data = resp.json()
    assert data["work_type"] == "replacement"
    assert data["priority"] == "high"
    assert data["status"] == "open"
    assert data["tenant_id"] == str(TENANT_A_ID)


@pytest.mark.asyncio
async def test_create_work_order_with_geometry(seeded_client):
    resp = await seeded_client.post("/api/v1/work-orders", json={
        "work_type": "repair",
        "priority": "routine",
        "status": "open",
        "longitude": -89.65,
        "latitude": 39.78,
    }, headers=tenant_a_headers())
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_work_order_missing_required(seeded_client):
    """work_type is required."""
    resp = await seeded_client.post("/api/v1/work-orders", json={
        "priority": "high",
        "status": "open",
    }, headers=tenant_a_headers())
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_work_order(seeded_client):
    create_resp = await seeded_client.post("/api/v1/work-orders", json={
        "work_type": "inspection",
        "description": "Annual sign check",
        "priority": "routine",
        "status": "open",
    }, headers=tenant_a_headers())
    wo_id = create_resp.json()["work_order_id"]

    resp = await seeded_client.get(f"/api/v1/work-orders/{wo_id}", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["work_order_id"] == wo_id
    assert resp.json()["description"] == "Annual sign check"


@pytest.mark.asyncio
async def test_get_nonexistent_work_order(seeded_client):
    resp = await seeded_client.get(
        f"/api/v1/work-orders/{uuid.uuid4()}", headers=tenant_a_headers()
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_work_order(seeded_client):
    create_resp = await seeded_client.post("/api/v1/work-orders", json={
        "work_type": "replacement",
        "priority": "routine",
        "status": "open",
    }, headers=tenant_a_headers())
    wo_id = create_resp.json()["work_order_id"]

    resp = await seeded_client.put(f"/api/v1/work-orders/{wo_id}", json={
        "status": "in_progress",
        "priority": "high",
        "notes": "Parts ordered",
    }, headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "in_progress"
    assert data["priority"] == "high"
    assert data["notes"] == "Parts ordered"


@pytest.mark.asyncio
async def test_update_nonexistent_work_order(seeded_client):
    resp = await seeded_client.put(
        f"/api/v1/work-orders/{uuid.uuid4()}",
        json={"status": "closed"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_work_orders_empty(seeded_client):
    resp = await seeded_client.get("/api/v1/work-orders", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_work_orders_filter_by_status(seeded_client):
    for status in ("open", "open", "in_progress", "closed"):
        await seeded_client.post("/api/v1/work-orders", json={
            "work_type": "repair",
            "priority": "routine",
            "status": status,
        }, headers=tenant_a_headers())

    resp = await seeded_client.get("/api/v1/work-orders?status=open", headers=tenant_a_headers())
    assert resp.json()["total"] == 2

    resp = await seeded_client.get("/api/v1/work-orders?status=closed", headers=tenant_a_headers())
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_list_work_orders_filter_by_priority(seeded_client):
    for priority in ("routine", "high", "emergency"):
        await seeded_client.post("/api/v1/work-orders", json={
            "work_type": "repair",
            "priority": priority,
            "status": "open",
        }, headers=tenant_a_headers())

    resp = await seeded_client.get("/api/v1/work-orders?priority=emergency", headers=tenant_a_headers())
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_work_order_lifecycle(seeded_client):
    """Test the full lifecycle: open → in_progress → closed."""
    # Create
    create_resp = await seeded_client.post("/api/v1/work-orders", json={
        "work_type": "replacement",
        "description": "Replace damaged yield sign",
        "priority": "high",
        "status": "open",
    }, headers=tenant_a_headers())
    wo_id = create_resp.json()["work_order_id"]

    # Start work
    resp = await seeded_client.put(f"/api/v1/work-orders/{wo_id}", json={
        "status": "in_progress",
        "actual_start_date": "2026-03-21",
    }, headers=tenant_a_headers())
    assert resp.json()["status"] == "in_progress"

    # Complete
    resp = await seeded_client.put(f"/api/v1/work-orders/{wo_id}", json={
        "status": "closed",
        "actual_finish_date": "2026-03-22",
        "resolution": "Replaced with new Type III sheeting sign",
        "labor_hours": 2.5,
        "material_cost": 85.00,
        "total_cost": 135.00,
    }, headers=tenant_a_headers())
    data = resp.json()
    assert data["status"] == "closed"
    assert data["resolution"] == "Replaced with new Type III sheeting sign"
    assert data["labor_hours"] == 2.5
    assert data["total_cost"] == 135.00
