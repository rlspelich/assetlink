"""
Inspection API tests.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, tenant_a_headers


@pytest.mark.asyncio
async def test_create_inspection(seeded_client):
    resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "visual",
        "inspection_date": "2026-03-21",
        "status": "completed",
        "condition_rating": 3,
        "findings": "Sign fading, still legible",
        "recommendations": "Schedule replacement within 12 months",
        "follow_up_required": True,
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    data = resp.json()
    assert data["inspection_type"] == "visual"
    assert data["condition_rating"] == 3
    assert data["follow_up_required"] is True
    assert data["tenant_id"] == str(TENANT_A_ID)


@pytest.mark.asyncio
async def test_create_inspection_with_retroreflectivity(seeded_client):
    """Retroreflectivity reading inspection."""
    resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "retroreflectivity",
        "inspection_date": "2026-03-21",
        "status": "completed",
        "retroreflectivity_value": 45.5,
        "passes_minimum_retro": False,
        "findings": "Below minimum retroreflectivity threshold",
        "follow_up_required": True,
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    data = resp.json()
    assert data["retroreflectivity_value"] == 45.5
    assert data["passes_minimum_retro"] is False


@pytest.mark.asyncio
async def test_create_inspection_with_defects(seeded_client):
    """Inspection with structured defects in JSONB."""
    resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "visual",
        "inspection_date": "2026-03-21",
        "status": "completed",
        "condition_rating": 2,
        "defects": {
            "fading": True,
            "graffiti": False,
            "bent": True,
            "visibility_obstruction": "tree branch",
        },
        "follow_up_required": True,
    }, headers=tenant_a_headers())
    assert resp.status_code == 201
    data = resp.json()
    assert data["defects"]["fading"] is True
    assert data["defects"]["visibility_obstruction"] == "tree branch"


@pytest.mark.asyncio
async def test_create_inspection_with_geometry(seeded_client):
    resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "visual",
        "inspection_date": "2026-03-21",
        "status": "completed",
        "follow_up_required": False,
        "longitude": -89.65,
        "latitude": 39.78,
    }, headers=tenant_a_headers())
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_create_inspection_missing_required(seeded_client):
    """inspection_type and inspection_date are required."""
    resp = await seeded_client.post("/api/v1/inspections", json={
        "status": "completed",
        "condition_rating": 3,
    }, headers=tenant_a_headers())
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_inspection_invalid_condition_rating(seeded_client):
    resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "visual",
        "inspection_date": "2026-03-21",
        "condition_rating": 6,
    }, headers=tenant_a_headers())
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_get_inspection(seeded_client):
    create_resp = await seeded_client.post("/api/v1/inspections", json={
        "inspection_type": "retroreflectivity",
        "inspection_date": "2026-03-21",
        "status": "completed",
        "retroreflectivity_value": 120.0,
        "passes_minimum_retro": True,
        "follow_up_required": False,
    }, headers=tenant_a_headers())
    insp_id = create_resp.json()["inspection_id"]

    resp = await seeded_client.get(f"/api/v1/inspections/{insp_id}", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["inspection_id"] == insp_id
    assert resp.json()["retroreflectivity_value"] == 120.0


@pytest.mark.asyncio
async def test_get_nonexistent_inspection(seeded_client):
    resp = await seeded_client.get(
        f"/api/v1/inspections/{uuid.uuid4()}", headers=tenant_a_headers()
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_inspections_empty(seeded_client):
    resp = await seeded_client.get("/api/v1/inspections", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_list_inspections_filter_by_type(seeded_client):
    for itype in ("visual", "visual", "retroreflectivity"):
        await seeded_client.post("/api/v1/inspections", json={
            "inspection_type": itype,
            "inspection_date": "2026-03-21",
            "status": "completed",
            "follow_up_required": False,
        }, headers=tenant_a_headers())

    resp = await seeded_client.get(
        "/api/v1/inspections?inspection_type=retroreflectivity",
        headers=tenant_a_headers(),
    )
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_list_inspections_filter_by_status(seeded_client):
    for status in ("completed", "completed", "in_progress"):
        await seeded_client.post("/api/v1/inspections", json={
            "inspection_type": "visual",
            "inspection_date": "2026-03-21",
            "status": status,
            "follow_up_required": False,
        }, headers=tenant_a_headers())

    resp = await seeded_client.get(
        "/api/v1/inspections?status=in_progress",
        headers=tenant_a_headers(),
    )
    assert resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_list_inspections_pagination(seeded_client):
    for i in range(5):
        await seeded_client.post("/api/v1/inspections", json={
            "inspection_type": "visual",
            "inspection_date": "2026-03-21",
            "status": "completed",
            "follow_up_required": False,
        }, headers=tenant_a_headers())

    resp = await seeded_client.get(
        "/api/v1/inspections?page=1&page_size=2",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 5
    assert len(data["inspections"]) == 2
