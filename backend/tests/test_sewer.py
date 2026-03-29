"""
Sewer collection system API tests.

Tests the full lifecycle: create, read, update, delete, list with filters,
tenant isolation, and reference lookups for manholes, sewer mains, force mains,
lift stations, and sewer laterals.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


# ---------------------------------------------------------------------------
# Payload helpers
# ---------------------------------------------------------------------------


def _manhole_payload(**overrides):
    """Default manhole creation payload."""
    base = {
        "longitude": -89.6501,
        "latitude": 39.7817,
        "system_type": "sanitary",
        "status": "active",
    }
    base.update(overrides)
    return base


def _sewer_main_payload(**overrides):
    """Default sewer main creation payload (LineString)."""
    base = {
        "coordinates": [[-89.6501, 39.7817], [-89.6510, 39.7820], [-89.6520, 39.7825]],
        "system_type": "sanitary",
        "status": "active",
    }
    base.update(overrides)
    return base


def _force_main_payload(**overrides):
    """Default force main creation payload (LineString)."""
    base = {
        "coordinates": [[-89.6501, 39.7817], [-89.6510, 39.7820]],
        "status": "active",
    }
    base.update(overrides)
    return base


def _lift_station_payload(**overrides):
    """Default lift station creation payload."""
    base = {
        "longitude": -89.6501,
        "latitude": 39.7817,
        "station_name": "LS-001",
        "status": "active",
    }
    base.update(overrides)
    return base


def _sewer_lateral_payload(**overrides):
    """Default sewer lateral creation payload (Point geometry)."""
    base = {
        "longitude": -89.6501,
        "latitude": 39.7817,
        "status": "active",
    }
    base.update(overrides)
    return base


# ===========================================================================
# MANHOLES
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_manhole_minimal(seeded_client):
    """Create a manhole with only required fields."""
    resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["longitude"] == -89.6501
    assert data["latitude"] == 39.7817
    assert data["system_type"] == "sanitary"
    assert data["status"] == "active"
    assert "manhole_id" in data


@pytest.mark.asyncio
async def test_create_manhole_full(seeded_client):
    """Create a manhole with many fields populated."""
    resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(
            asset_tag="MH-2001",
            description="Main & Elm intersection manhole",
            material="precast_concrete",
            diameter_inches=48,
            rim_elevation_ft=612.5,
            invert_elevation_ft=600.2,
            depth_ft=12.3,
            cover_type="round",
            has_steps=True,
            step_material="polypropylene",
            system_type="sanitary",
            condition_rating=4,
            install_date="2015-06-15",
            notes="Good condition, last inspected 2025",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["asset_tag"] == "MH-2001"
    assert data["rim_elevation_ft"] == 612.5
    assert data["invert_elevation_ft"] == 600.2
    assert data["depth_ft"] == 12.3
    assert data["has_steps"] is True
    assert data["step_material"] == "polypropylene"
    assert data["condition_rating"] == 4
    assert data["install_date"] == "2015-06-15"


# --- LIST ---


@pytest.mark.asyncio
async def test_list_manholes_empty(seeded_client):
    """Empty tenant returns empty list."""
    resp = await seeded_client.get("/api/v1/manholes", headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["manholes"] == []
    assert data["total"] == 0
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_list_manholes_count(seeded_client):
    """Total count matches number created."""
    for _ in range(3):
        await seeded_client.post(
            "/api/v1/manholes",
            json=_manhole_payload(),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get("/api/v1/manholes", headers=tenant_a_headers())
    data = resp.json()
    assert data["total"] == 3
    assert len(data["manholes"]) == 3


@pytest.mark.asyncio
async def test_list_manholes_filter_by_system_type(seeded_client):
    """Filter manholes by system_type."""
    await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(system_type="sanitary"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(system_type="storm"),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/manholes?system_type=storm",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["manholes"][0]["system_type"] == "storm"


# --- READ ---


@pytest.mark.asyncio
async def test_get_manhole_by_id(seeded_client):
    """Fetch a manhole by ID and verify all fields round-trip."""
    create_resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(
            rim_elevation_ft=610.0,
            depth_ft=10.5,
            system_type="combined",
        ),
        headers=tenant_a_headers(),
    )
    manhole_id = create_resp.json()["manhole_id"]

    resp = await seeded_client.get(
        f"/api/v1/manholes/{manhole_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["manhole_id"] == manhole_id
    assert data["rim_elevation_ft"] == 610.0
    assert data["depth_ft"] == 10.5
    assert data["system_type"] == "combined"


@pytest.mark.asyncio
async def test_get_manhole_not_found(seeded_client):
    """404 for a manhole ID that doesn't exist."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/manholes/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_manhole(seeded_client):
    """Update manhole fields and verify changes."""
    create_resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(condition_rating=4, notes="Original"),
        headers=tenant_a_headers(),
    )
    manhole_id = create_resp.json()["manhole_id"]

    resp = await seeded_client.put(
        f"/api/v1/manholes/{manhole_id}",
        json={"condition_rating": 2, "notes": "Updated after inspection"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["condition_rating"] == 2
    assert data["notes"] == "Updated after inspection"
    # Unchanged fields preserved
    assert data["system_type"] == "sanitary"


@pytest.mark.asyncio
async def test_update_manhole_geometry(seeded_client):
    """Update a manhole's coordinates."""
    create_resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(),
        headers=tenant_a_headers(),
    )
    manhole_id = create_resp.json()["manhole_id"]

    resp = await seeded_client.put(
        f"/api/v1/manholes/{manhole_id}",
        json={"longitude": -90.0, "latitude": 40.0},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert abs(data["longitude"] - (-90.0)) < 0.0001
    assert abs(data["latitude"] - 40.0) < 0.0001


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_manhole(seeded_client):
    """Delete a manhole and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(),
        headers=tenant_a_headers(),
    )
    manhole_id = create_resp.json()["manhole_id"]

    resp = await seeded_client.delete(
        f"/api/v1/manholes/{manhole_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/manholes/{manhole_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_manhole_not_found(seeded_client):
    """404 for deleting a manhole that doesn't exist."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.delete(
        f"/api/v1/manholes/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_manhole_tenant_isolation(seeded_client):
    """Manholes from one tenant are not visible to another."""
    # Create manhole in tenant A
    create_resp = await seeded_client.post(
        "/api/v1/manholes",
        json=_manhole_payload(),
        headers=tenant_a_headers(),
    )
    manhole_id = create_resp.json()["manhole_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/manholes/{manhole_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B cannot update it
    put_resp = await seeded_client.put(
        f"/api/v1/manholes/{manhole_id}",
        json={"notes": "hacked"},
        headers=tenant_b_headers(),
    )
    assert put_resp.status_code == 404

    # Tenant B cannot delete it
    del_resp = await seeded_client.delete(
        f"/api/v1/manholes/{manhole_id}",
        headers=tenant_b_headers(),
    )
    assert del_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/manholes",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# SEWER MAINS
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_sewer_main(seeded_client):
    """Create a sewer main with LineString geometry."""
    resp = await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(
            material_code="PVC",
            diameter_inches=8,
            slope_pct=0.5,
            system_type="sanitary",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["material_code"] == "PVC"
    assert data["diameter_inches"] == 8
    assert data["slope_pct"] == 0.5
    assert data["system_type"] == "sanitary"
    assert data["coordinates"] is not None
    assert len(data["coordinates"]) == 3
    assert "sewer_main_id" in data


# --- LIST ---


@pytest.mark.asyncio
async def test_list_sewer_mains_count(seeded_client):
    """Total count matches number created."""
    for _ in range(2):
        await seeded_client.post(
            "/api/v1/sewer-mains",
            json=_sewer_main_payload(),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get("/api/v1/sewer-mains", headers=tenant_a_headers())
    data = resp.json()
    assert data["total"] == 2
    assert len(data["sewer_mains"]) == 2


@pytest.mark.asyncio
async def test_list_sewer_mains_filter_by_system_type(seeded_client):
    """Filter sewer mains by system_type."""
    await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(system_type="sanitary"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(system_type="storm"),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/sewer-mains?system_type=storm",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["sewer_mains"][0]["system_type"] == "storm"


# --- READ ---


@pytest.mark.asyncio
async def test_get_sewer_main_by_id(seeded_client):
    """Fetch a sewer main by ID."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(description="Main trunk line"),
        headers=tenant_a_headers(),
    )
    sm_id = create_resp.json()["sewer_main_id"]

    resp = await seeded_client.get(
        f"/api/v1/sewer-mains/{sm_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sewer_main_id"] == sm_id
    assert data["description"] == "Main trunk line"
    assert data["coordinates"] is not None


@pytest.mark.asyncio
async def test_get_sewer_main_not_found(seeded_client):
    """404 for non-existent sewer main."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/sewer-mains/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_sewer_main(seeded_client):
    """Update sewer main fields."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(diameter_inches=8, notes="Original"),
        headers=tenant_a_headers(),
    )
    sm_id = create_resp.json()["sewer_main_id"]

    resp = await seeded_client.put(
        f"/api/v1/sewer-mains/{sm_id}",
        json={"diameter_inches": 12, "notes": "Upsized"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["diameter_inches"] == 12
    assert data["notes"] == "Upsized"
    # Unchanged
    assert data["system_type"] == "sanitary"


@pytest.mark.asyncio
async def test_update_sewer_main_geometry(seeded_client):
    """Update a sewer main's LineString coordinates."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(),
        headers=tenant_a_headers(),
    )
    sm_id = create_resp.json()["sewer_main_id"]

    new_coords = [[-89.70, 39.80], [-89.71, 39.81]]
    resp = await seeded_client.put(
        f"/api/v1/sewer-mains/{sm_id}",
        json={"coordinates": new_coords},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["coordinates"]) == 2
    assert abs(data["coordinates"][0][0] - (-89.70)) < 0.0001


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_sewer_main(seeded_client):
    """Delete a sewer main and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(),
        headers=tenant_a_headers(),
    )
    sm_id = create_resp.json()["sewer_main_id"]

    resp = await seeded_client.delete(
        f"/api/v1/sewer-mains/{sm_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/sewer-mains/{sm_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_sewer_main_tenant_isolation(seeded_client):
    """Sewer mains from one tenant are not visible to another."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-mains",
        json=_sewer_main_payload(),
        headers=tenant_a_headers(),
    )
    sm_id = create_resp.json()["sewer_main_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/sewer-mains/{sm_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/sewer-mains",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# FORCE MAINS
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_force_main(seeded_client):
    """Create a force main with LineString geometry."""
    resp = await seeded_client.post(
        "/api/v1/force-mains",
        json=_force_main_payload(
            material_code="DIP",
            diameter_inches=6,
            pressure_class="Class 350",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["material_code"] == "DIP"
    assert data["diameter_inches"] == 6
    assert data["pressure_class"] == "Class 350"
    assert data["coordinates"] is not None
    assert len(data["coordinates"]) == 2
    assert "force_main_id" in data


# --- LIST ---


@pytest.mark.asyncio
async def test_list_force_mains_count(seeded_client):
    """Total count matches number created."""
    for _ in range(3):
        await seeded_client.post(
            "/api/v1/force-mains",
            json=_force_main_payload(),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get("/api/v1/force-mains", headers=tenant_a_headers())
    data = resp.json()
    assert data["total"] == 3
    assert len(data["force_mains"]) == 3


# --- READ ---


@pytest.mark.asyncio
async def test_get_force_main_by_id(seeded_client):
    """Fetch a force main by ID."""
    create_resp = await seeded_client.post(
        "/api/v1/force-mains",
        json=_force_main_payload(description="LS-001 to MH-050"),
        headers=tenant_a_headers(),
    )
    fm_id = create_resp.json()["force_main_id"]

    resp = await seeded_client.get(
        f"/api/v1/force-mains/{fm_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["force_main_id"] == fm_id
    assert data["description"] == "LS-001 to MH-050"


@pytest.mark.asyncio
async def test_get_force_main_not_found(seeded_client):
    """404 for non-existent force main."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/force-mains/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_force_main(seeded_client):
    """Update force main fields."""
    create_resp = await seeded_client.post(
        "/api/v1/force-mains",
        json=_force_main_payload(notes="Original"),
        headers=tenant_a_headers(),
    )
    fm_id = create_resp.json()["force_main_id"]

    resp = await seeded_client.put(
        f"/api/v1/force-mains/{fm_id}",
        json={"has_cathodic_protection": True, "notes": "CP installed"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_cathodic_protection"] is True
    assert data["notes"] == "CP installed"


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_force_main(seeded_client):
    """Delete a force main and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/force-mains",
        json=_force_main_payload(),
        headers=tenant_a_headers(),
    )
    fm_id = create_resp.json()["force_main_id"]

    resp = await seeded_client.delete(
        f"/api/v1/force-mains/{fm_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/force-mains/{fm_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# ===========================================================================
# LIFT STATIONS
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_lift_station(seeded_client):
    """Create a lift station with pump info, SCADA, and backup power."""
    resp = await seeded_client.post(
        "/api/v1/lift-stations",
        json=_lift_station_payload(
            station_name="Main Street LS",
            pump_count=3,
            pump_type="submersible",
            pump_hp=25.0,
            firm_capacity_gpm=500.0,
            has_scada=True,
            has_backup_power=True,
            backup_power_type="diesel_generator",
            condition_rating=4,
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["station_name"] == "Main Street LS"
    assert data["pump_count"] == 3
    assert data["pump_type"] == "submersible"
    assert data["pump_hp"] == 25.0
    assert data["firm_capacity_gpm"] == 500.0
    assert data["has_scada"] is True
    assert data["has_backup_power"] is True
    assert data["backup_power_type"] == "diesel_generator"
    assert data["condition_rating"] == 4
    assert "lift_station_id" in data


# --- LIST ---


@pytest.mark.asyncio
async def test_list_lift_stations_count(seeded_client):
    """Total count matches number created."""
    for i in range(2):
        await seeded_client.post(
            "/api/v1/lift-stations",
            json=_lift_station_payload(station_name=f"LS-{i}"),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        "/api/v1/lift-stations", headers=tenant_a_headers()
    )
    data = resp.json()
    assert data["total"] == 2
    assert len(data["lift_stations"]) == 2


# --- READ ---


@pytest.mark.asyncio
async def test_get_lift_station_by_id(seeded_client):
    """Fetch a lift station by ID and verify pump fields."""
    create_resp = await seeded_client.post(
        "/api/v1/lift-stations",
        json=_lift_station_payload(
            pump_count=2,
            pump_type="submersible",
            pump_hp=15.0,
            has_scada=False,
            has_backup_power=True,
            backup_power_type="portable_generator",
        ),
        headers=tenant_a_headers(),
    )
    ls_id = create_resp.json()["lift_station_id"]

    resp = await seeded_client.get(
        f"/api/v1/lift-stations/{ls_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["lift_station_id"] == ls_id
    assert data["pump_count"] == 2
    assert data["pump_type"] == "submersible"
    assert data["pump_hp"] == 15.0
    assert data["has_scada"] is False
    assert data["has_backup_power"] is True
    assert data["backup_power_type"] == "portable_generator"


@pytest.mark.asyncio
async def test_get_lift_station_not_found(seeded_client):
    """404 for non-existent lift station."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/lift-stations/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_lift_station(seeded_client):
    """Update lift station fields."""
    create_resp = await seeded_client.post(
        "/api/v1/lift-stations",
        json=_lift_station_payload(has_scada=False),
        headers=tenant_a_headers(),
    )
    ls_id = create_resp.json()["lift_station_id"]

    resp = await seeded_client.put(
        f"/api/v1/lift-stations/{ls_id}",
        json={"has_scada": True, "notes": "SCADA installed 2026-03"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_scada"] is True
    assert data["notes"] == "SCADA installed 2026-03"
    # Unchanged
    assert data["station_name"] == "LS-001"


@pytest.mark.asyncio
async def test_update_lift_station_geometry(seeded_client):
    """Update a lift station's coordinates."""
    create_resp = await seeded_client.post(
        "/api/v1/lift-stations",
        json=_lift_station_payload(),
        headers=tenant_a_headers(),
    )
    ls_id = create_resp.json()["lift_station_id"]

    resp = await seeded_client.put(
        f"/api/v1/lift-stations/{ls_id}",
        json={"longitude": -90.0, "latitude": 40.0},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert abs(data["longitude"] - (-90.0)) < 0.0001
    assert abs(data["latitude"] - 40.0) < 0.0001


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_lift_station(seeded_client):
    """Delete a lift station and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/lift-stations",
        json=_lift_station_payload(),
        headers=tenant_a_headers(),
    )
    ls_id = create_resp.json()["lift_station_id"]

    resp = await seeded_client.delete(
        f"/api/v1/lift-stations/{ls_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/lift-stations/{ls_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_lift_station_not_found(seeded_client):
    """404 for deleting a lift station that doesn't exist."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.delete(
        f"/api/v1/lift-stations/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_lift_station_tenant_isolation(seeded_client):
    """Lift stations from one tenant are not visible to another."""
    create_resp = await seeded_client.post(
        "/api/v1/lift-stations",
        json=_lift_station_payload(),
        headers=tenant_a_headers(),
    )
    ls_id = create_resp.json()["lift_station_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/lift-stations/{ls_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/lift-stations",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# SEWER LATERALS
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_sewer_lateral_point(seeded_client):
    """Create a sewer lateral with Point geometry."""
    resp = await seeded_client.post(
        "/api/v1/sewer-laterals",
        json=_sewer_lateral_payload(
            service_type="residential",
            diameter_inches=4,
            address="123 Main St",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["longitude"] == -89.6501
    assert data["latitude"] == 39.7817
    assert data["service_type"] == "residential"
    assert data["diameter_inches"] == 4
    assert data["address"] == "123 Main St"
    assert data["coordinates"] is None
    assert "sewer_lateral_id" in data


@pytest.mark.asyncio
async def test_create_sewer_lateral_linestring(seeded_client):
    """Create a sewer lateral with LineString geometry."""
    resp = await seeded_client.post(
        "/api/v1/sewer-laterals",
        json={
            "coordinates": [[-89.65, 39.78], [-89.651, 39.781]],
            "service_type": "commercial",
            "status": "active",
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["coordinates"] is not None
    assert len(data["coordinates"]) == 2
    assert data["longitude"] is None
    assert data["latitude"] is None


@pytest.mark.asyncio
async def test_create_sewer_lateral_both_geom_types_rejected(seeded_client):
    """Providing both Point and LineString geometry is rejected."""
    resp = await seeded_client.post(
        "/api/v1/sewer-laterals",
        json={
            "longitude": -89.65,
            "latitude": 39.78,
            "coordinates": [[-89.65, 39.78], [-89.651, 39.781]],
            "status": "active",
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_sewer_lateral_no_geometry_rejected(seeded_client):
    """Creating a lateral with no geometry is rejected."""
    resp = await seeded_client.post(
        "/api/v1/sewer-laterals",
        json={"status": "active"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 400


# --- LIST ---


@pytest.mark.asyncio
async def test_list_sewer_laterals_count(seeded_client):
    """Total count matches number created."""
    for _ in range(3):
        await seeded_client.post(
            "/api/v1/sewer-laterals",
            json=_sewer_lateral_payload(),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        "/api/v1/sewer-laterals", headers=tenant_a_headers()
    )
    data = resp.json()
    assert data["total"] == 3
    assert len(data["sewer_laterals"]) == 3


# --- READ ---


@pytest.mark.asyncio
async def test_get_sewer_lateral_by_id(seeded_client):
    """Fetch a sewer lateral by ID."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-laterals",
        json=_sewer_lateral_payload(address="456 Oak Ave"),
        headers=tenant_a_headers(),
    )
    sl_id = create_resp.json()["sewer_lateral_id"]

    resp = await seeded_client.get(
        f"/api/v1/sewer-laterals/{sl_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["sewer_lateral_id"] == sl_id
    assert data["address"] == "456 Oak Ave"


@pytest.mark.asyncio
async def test_get_sewer_lateral_not_found(seeded_client):
    """404 for non-existent sewer lateral."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/sewer-laterals/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_sewer_lateral(seeded_client):
    """Delete a sewer lateral and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/sewer-laterals",
        json=_sewer_lateral_payload(),
        headers=tenant_a_headers(),
    )
    sl_id = create_resp.json()["sewer_lateral_id"]

    resp = await seeded_client.delete(
        f"/api/v1/sewer-laterals/{sl_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/sewer-laterals/{sl_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# ===========================================================================
# REFERENCE LOOKUPS
# ===========================================================================


@pytest.mark.asyncio
async def test_list_sewer_material_types(seeded_client):
    """Sewer material types endpoint returns seeded data."""
    resp = await seeded_client.get("/api/v1/sewer-material-types")
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) > 0
    # Verify structure
    first = types[0]
    assert "code" in first
    assert "description" in first
    assert "is_active" in first


@pytest.mark.asyncio
async def test_list_sewer_pipe_shapes(seeded_client):
    """Sewer pipe shapes endpoint returns seeded data."""
    resp = await seeded_client.get("/api/v1/sewer-pipe-shapes")
    assert resp.status_code == 200
    shapes = resp.json()
    assert len(shapes) > 0
    first = shapes[0]
    assert "code" in first
    assert "description" in first


@pytest.mark.asyncio
async def test_list_manhole_types(seeded_client):
    """Manhole types endpoint returns seeded data."""
    resp = await seeded_client.get("/api/v1/manhole-types")
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) > 0
    first = types[0]
    assert "code" in first
    assert "description" in first
