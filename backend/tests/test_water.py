"""
Water module API tests.

Tests the full lifecycle for water mains (LineString), water valves (Point),
fire hydrants (Point), pressure zones (Polygon), and lookup endpoints.
"""

import uuid

import pytest

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


# ---------------------------------------------------------------------------
# Helpers — default payloads
# ---------------------------------------------------------------------------


def _water_main_payload(**overrides):
    """Default water main creation payload (LineString)."""
    base = {
        "description": "12-inch DI main on Main St",
        "material_code": "DI",
        "diameter_inches": 12.0,
        "length_feet": 350.0,
        "status": "active",
        "coordinates": [
            [-89.6501, 39.7817],
            [-89.6510, 39.7817],
            [-89.6520, 39.7820],
        ],
    }
    base.update(overrides)
    return base


def _water_valve_payload(**overrides):
    """Default water valve creation payload (Point)."""
    base = {
        "description": "8-inch gate valve",
        "valve_type_code": "GATE",
        "size_inches": 8.0,
        "normal_position": "open",
        "status": "active",
        "longitude": -89.6501,
        "latitude": 39.7817,
    }
    base.update(overrides)
    return base


def _hydrant_payload(**overrides):
    """Default fire hydrant creation payload (Point)."""
    base = {
        "description": "Mueller hydrant at Main & Elm",
        "make": "Mueller",
        "model": "Super Centurion 250",
        "barrel_type": "dry",
        "nozzle_count": 3,
        "nozzle_sizes": "2.5,2.5,4.5",
        "status": "active",
        "ownership": "public",
        "longitude": -89.6505,
        "latitude": 39.7820,
    }
    base.update(overrides)
    return base


def _pressure_zone_payload(**overrides):
    """Default pressure zone creation payload (Polygon)."""
    base = {
        "zone_name": "Zone 1 - Low Pressure",
        "zone_number": "Z1",
        "target_pressure_min_psi": 40.0,
        "target_pressure_max_psi": 80.0,
        "description": "Low-pressure service area downtown",
        "coordinates": [
            [-89.66, 39.78],
            [-89.65, 39.78],
            [-89.65, 39.79],
            [-89.66, 39.79],
        ],
    }
    base.update(overrides)
    return base


# ===========================================================================
# WATER MAINS (LineString)
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_water_main(seeded_client):
    """Create a water main with geometry and attributes."""
    resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["description"] == "12-inch DI main on Main St"
    assert data["material_code"] == "DI"
    assert float(data["diameter_inches"]) == 12.0
    assert float(data["length_feet"]) == 350.0
    assert data["status"] == "active"
    assert "water_main_id" in data
    assert len(data["coordinates"]) == 3
    assert data["coordinates"][0] == [-89.6501, 39.7817]


@pytest.mark.asyncio
async def test_create_water_main_full(seeded_client):
    """Create a water main with all fields populated."""
    resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(
            asset_tag="WM-001",
            pressure_class="Class 150",
            shape="circular",
            lining_type="cement_mortar",
            lining_date="2020-01-15",
            depth_feet=5.5,
            soil_type="clay",
            owner="public",
            maintained_by="City DPW",
            install_date="2010-06-01",
            expected_life_years=100,
            replacement_cost=75000.00,
            flow_direction="east",
            break_count=2,
            condition_rating=3,
            custom_fields={"legacy_id": "PIPE-1234"},
            notes="Crosses under railroad tracks",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["asset_tag"] == "WM-001"
    assert data["condition_rating"] == 3
    assert data["break_count"] == 2
    assert data["custom_fields"] == {"legacy_id": "PIPE-1234"}
    assert data["install_date"] == "2010-06-01"
    assert data["notes"] == "Crosses under railroad tracks"


@pytest.mark.asyncio
async def test_create_water_main_too_few_coords(seeded_client):
    """LineString requires at least 2 coordinate pairs."""
    resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(coordinates=[[-89.65, 39.78]]),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 400
    assert "at least 2" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_water_main_invalid_condition_rating(seeded_client):
    """Condition rating must be 1-5."""
    resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(condition_rating=6),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


# --- LIST ---


@pytest.mark.asyncio
async def test_list_water_mains_empty(seeded_client):
    """Empty tenant returns empty list."""
    resp = await seeded_client.get(
        "/api/v1/water-mains",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["water_mains"] == []
    assert data["total"] == 0
    assert data["page"] == 1


@pytest.mark.asyncio
async def test_list_water_mains_count(seeded_client):
    """List returns correct total count."""
    for i in range(3):
        await seeded_client.post(
            "/api/v1/water-mains",
            json=_water_main_payload(
                coordinates=[
                    [-89.65 + i * 0.01, 39.78],
                    [-89.66 + i * 0.01, 39.78],
                ]
            ),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        "/api/v1/water-mains",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 3
    assert len(data["water_mains"]) == 3


@pytest.mark.asyncio
async def test_list_water_mains_filter_by_status(seeded_client):
    """Filter water mains by status."""
    await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(status="active"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(
            status="abandoned",
            coordinates=[[-89.67, 39.78], [-89.68, 39.78]],
        ),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/water-mains?status=abandoned",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["water_mains"][0]["status"] == "abandoned"


@pytest.mark.asyncio
async def test_list_water_mains_filter_by_material_code(seeded_client):
    """Filter water mains by material_code."""
    await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(material_code="DI"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(
            material_code="PVC",
            coordinates=[[-89.67, 39.78], [-89.68, 39.78]],
        ),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/water-mains?material_code=PVC",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["water_mains"][0]["material_code"] == "PVC"


# --- GET ---


@pytest.mark.asyncio
async def test_get_water_main_by_id(seeded_client):
    """Fetch a water main by ID and verify all fields round-trip."""
    create_resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(
            description="Test main",
            condition_rating=4,
        ),
        headers=tenant_a_headers(),
    )
    main_id = create_resp.json()["water_main_id"]

    resp = await seeded_client.get(
        f"/api/v1/water-mains/{main_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["water_main_id"] == main_id
    assert data["description"] == "Test main"
    assert data["condition_rating"] == 4
    assert len(data["coordinates"]) == 3


@pytest.mark.asyncio
async def test_get_water_main_not_found(seeded_client):
    """404 for non-existent water main."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/water-mains/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_water_main(seeded_client):
    """Update a water main's fields."""
    create_resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(description="Old desc", condition_rating=3),
        headers=tenant_a_headers(),
    )
    main_id = create_resp.json()["water_main_id"]

    resp = await seeded_client.put(
        f"/api/v1/water-mains/{main_id}",
        json={"description": "New desc", "condition_rating": 5, "break_count": 1},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "New desc"
    assert data["condition_rating"] == 5
    assert data["break_count"] == 1
    # Original fields preserved
    assert data["material_code"] == "DI"


@pytest.mark.asyncio
async def test_update_water_main_geometry(seeded_client):
    """Update a water main's geometry (coordinates)."""
    create_resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(),
        headers=tenant_a_headers(),
    )
    main_id = create_resp.json()["water_main_id"]

    new_coords = [[-90.0, 40.0], [-90.01, 40.0]]
    resp = await seeded_client.put(
        f"/api/v1/water-mains/{main_id}",
        json={"coordinates": new_coords},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["coordinates"]) == 2
    assert abs(data["coordinates"][0][0] - (-90.0)) < 0.0001


@pytest.mark.asyncio
async def test_update_water_main_not_found(seeded_client):
    """404 for updating non-existent water main."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.put(
        f"/api/v1/water-mains/{fake_id}",
        json={"status": "abandoned"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_water_main(seeded_client):
    """Delete a water main and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(),
        headers=tenant_a_headers(),
    )
    main_id = create_resp.json()["water_main_id"]

    resp = await seeded_client.delete(
        f"/api/v1/water-mains/{main_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/water-mains/{main_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_water_main_not_found(seeded_client):
    """Deleting a non-existent water main returns 404."""
    resp = await seeded_client.delete(
        f"/api/v1/water-mains/{uuid.uuid4()}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_water_main_tenant_isolation(seeded_client):
    """Water mains from one tenant are not visible to another."""
    # Create in tenant A
    create_resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(),
        headers=tenant_a_headers(),
    )
    main_id = create_resp.json()["water_main_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/water-mains/{main_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B cannot update it
    put_resp = await seeded_client.put(
        f"/api/v1/water-mains/{main_id}",
        json={"status": "abandoned"},
        headers=tenant_b_headers(),
    )
    assert put_resp.status_code == 404

    # Tenant B cannot delete it
    del_resp = await seeded_client.delete(
        f"/api/v1/water-mains/{main_id}",
        headers=tenant_b_headers(),
    )
    assert del_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/water-mains",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# WATER VALVES (Point)
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_water_valve(seeded_client):
    """Create a water valve with all key attributes."""
    resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["valve_type_code"] == "GATE"
    assert float(data["size_inches"]) == 8.0
    assert data["normal_position"] == "open"
    assert data["status"] == "active"
    assert data["longitude"] == -89.6501
    assert data["latitude"] == 39.7817
    assert "water_valve_id" in data


@pytest.mark.asyncio
async def test_create_water_valve_full(seeded_client):
    """Create a valve with all fields."""
    resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(
            asset_tag="VLV-001",
            manufacturer="Mueller",
            model="A-2360",
            material="ductile_iron",
            turns_to_close=12,
            turn_direction="CW",
            current_position="open",
            is_operable="yes",
            is_critical=True,
            installation_type="vault",
            depth_feet=4.5,
            install_date="2015-03-20",
            condition_rating=4,
            last_exercised_date="2025-11-01",
            exercise_interval_days=365,
            custom_fields={"vault_material": "concrete"},
            notes="Main line isolation valve",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["asset_tag"] == "VLV-001"
    assert data["is_critical"] is True
    assert data["turns_to_close"] == 12
    assert data["condition_rating"] == 4
    assert data["install_date"] == "2015-03-20"
    assert data["custom_fields"] == {"vault_material": "concrete"}


@pytest.mark.asyncio
async def test_create_water_valve_invalid_condition_rating(seeded_client):
    """Condition rating must be 1-5."""
    resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(condition_rating=0),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


# --- LIST ---


@pytest.mark.asyncio
async def test_list_water_valves_empty(seeded_client):
    """Empty tenant returns empty valve list."""
    resp = await seeded_client.get(
        "/api/v1/water-valves",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["water_valves"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_water_valves_filter_by_valve_type_code(seeded_client):
    """Filter valves by valve_type_code."""
    await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(valve_type_code="GATE"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(
            valve_type_code="BUTTERFLY",
            longitude=-89.66,
            latitude=39.79,
        ),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(
            valve_type_code="GATE",
            longitude=-89.67,
            latitude=39.80,
        ),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/water-valves?valve_type_code=BUTTERFLY",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["water_valves"][0]["valve_type_code"] == "BUTTERFLY"


@pytest.mark.asyncio
async def test_list_water_valves_filter_by_is_critical(seeded_client):
    """Filter valves by is_critical flag."""
    await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(is_critical=True),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(
            is_critical=False,
            longitude=-89.66,
            latitude=39.79,
        ),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/water-valves?is_critical=true",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["water_valves"][0]["is_critical"] is True


# --- GET ---


@pytest.mark.asyncio
async def test_get_water_valve_by_id(seeded_client):
    """Fetch a water valve by ID and verify fields."""
    create_resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(description="Test valve"),
        headers=tenant_a_headers(),
    )
    valve_id = create_resp.json()["water_valve_id"]

    resp = await seeded_client.get(
        f"/api/v1/water-valves/{valve_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["water_valve_id"] == valve_id
    assert data["description"] == "Test valve"
    assert data["longitude"] == -89.6501
    assert data["latitude"] == 39.7817


@pytest.mark.asyncio
async def test_get_water_valve_not_found(seeded_client):
    """404 for non-existent valve."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/water-valves/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_water_valve(seeded_client):
    """Update a water valve's fields."""
    create_resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(description="Old valve"),
        headers=tenant_a_headers(),
    )
    valve_id = create_resp.json()["water_valve_id"]

    resp = await seeded_client.put(
        f"/api/v1/water-valves/{valve_id}",
        json={
            "description": "Updated valve",
            "current_position": "closed",
            "condition_rating": 2,
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Updated valve"
    assert data["current_position"] == "closed"
    assert data["condition_rating"] == 2
    # Original fields preserved
    assert data["valve_type_code"] == "GATE"


@pytest.mark.asyncio
async def test_update_water_valve_geometry(seeded_client):
    """Update a valve's coordinates."""
    create_resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(),
        headers=tenant_a_headers(),
    )
    valve_id = create_resp.json()["water_valve_id"]

    resp = await seeded_client.put(
        f"/api/v1/water-valves/{valve_id}",
        json={"longitude": -90.0, "latitude": 40.0},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert abs(data["longitude"] - (-90.0)) < 0.0001
    assert abs(data["latitude"] - 40.0) < 0.0001


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_water_valve(seeded_client):
    """Delete a water valve and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(),
        headers=tenant_a_headers(),
    )
    valve_id = create_resp.json()["water_valve_id"]

    resp = await seeded_client.delete(
        f"/api/v1/water-valves/{valve_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/water-valves/{valve_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- VALVE TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_water_valve_tenant_isolation(seeded_client):
    """Valves from one tenant are not visible to another."""
    create_resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(),
        headers=tenant_a_headers(),
    )
    valve_id = create_resp.json()["water_valve_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/water-valves/{valve_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/water-valves",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# FIRE HYDRANTS (Point)
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_hydrant(seeded_client):
    """Create a fire hydrant with key attributes."""
    resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["make"] == "Mueller"
    assert data["model"] == "Super Centurion 250"
    assert data["barrel_type"] == "dry"
    assert data["nozzle_count"] == 3
    assert data["status"] == "active"
    assert data["ownership"] == "public"
    assert data["longitude"] == -89.6505
    assert data["latitude"] == 39.7820
    assert "hydrant_id" in data


@pytest.mark.asyncio
async def test_create_hydrant_with_flow_test(seeded_client):
    """Create a hydrant with flow test data."""
    resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(
            flow_test_date="2025-06-15",
            static_pressure_psi=65.0,
            residual_pressure_psi=48.0,
            pitot_pressure_psi=22.0,
            flow_gpm=1250.0,
            flow_class_color="green",
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["flow_test_date"] == "2025-06-15"
    assert float(data["static_pressure_psi"]) == 65.0
    assert float(data["residual_pressure_psi"]) == 48.0
    assert float(data["pitot_pressure_psi"]) == 22.0
    assert float(data["flow_gpm"]) == 1250.0
    assert data["flow_class_color"] == "green"


@pytest.mark.asyncio
async def test_create_hydrant_invalid_condition_rating(seeded_client):
    """Condition rating must be 1-5."""
    resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(condition_rating=6),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


# --- LIST ---


@pytest.mark.asyncio
async def test_list_hydrants_empty(seeded_client):
    """Empty tenant returns empty hydrant list."""
    resp = await seeded_client.get(
        "/api/v1/hydrants",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["hydrants"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_hydrants_count(seeded_client):
    """List returns correct total count."""
    for i in range(4):
        await seeded_client.post(
            "/api/v1/hydrants",
            json=_hydrant_payload(
                longitude=-89.65 + i * 0.001,
                latitude=39.78 + i * 0.001,
            ),
            headers=tenant_a_headers(),
        )

    resp = await seeded_client.get(
        "/api/v1/hydrants",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 4
    assert len(data["hydrants"]) == 4


@pytest.mark.asyncio
async def test_list_hydrants_filter_by_status(seeded_client):
    """Filter hydrants by status."""
    await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(status="active"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(
            status="out_of_service",
            longitude=-89.66,
            latitude=39.79,
        ),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/hydrants?status=out_of_service",
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["total"] == 1
    assert data["hydrants"][0]["status"] == "out_of_service"


# --- GET ---


@pytest.mark.asyncio
async def test_get_hydrant_by_id(seeded_client):
    """Fetch a hydrant by ID and verify flow test fields."""
    create_resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(
            flow_test_date="2025-06-15",
            static_pressure_psi=65.0,
            flow_gpm=1250.0,
            flow_class_color="green",
            condition_rating=4,
        ),
        headers=tenant_a_headers(),
    )
    hydrant_id = create_resp.json()["hydrant_id"]

    resp = await seeded_client.get(
        f"/api/v1/hydrants/{hydrant_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["hydrant_id"] == hydrant_id
    assert data["flow_test_date"] == "2025-06-15"
    assert float(data["static_pressure_psi"]) == 65.0
    assert float(data["flow_gpm"]) == 1250.0
    assert data["flow_class_color"] == "green"
    assert data["condition_rating"] == 4


@pytest.mark.asyncio
async def test_get_hydrant_not_found(seeded_client):
    """404 for non-existent hydrant."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/hydrants/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- UPDATE ---


@pytest.mark.asyncio
async def test_update_hydrant(seeded_client):
    """Update a hydrant's fields."""
    create_resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(description="Old hydrant"),
        headers=tenant_a_headers(),
    )
    hydrant_id = create_resp.json()["hydrant_id"]

    resp = await seeded_client.put(
        f"/api/v1/hydrants/{hydrant_id}",
        json={
            "description": "Updated hydrant",
            "condition_rating": 2,
            "flow_class_color": "red",
            "status": "out_of_service",
            "out_of_service_reason": "Broken nozzle cap",
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Updated hydrant"
    assert data["condition_rating"] == 2
    assert data["flow_class_color"] == "red"
    assert data["status"] == "out_of_service"
    assert data["out_of_service_reason"] == "Broken nozzle cap"
    # Original fields preserved
    assert data["make"] == "Mueller"


@pytest.mark.asyncio
async def test_update_hydrant_geometry(seeded_client):
    """Update a hydrant's coordinates."""
    create_resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(),
        headers=tenant_a_headers(),
    )
    hydrant_id = create_resp.json()["hydrant_id"]

    resp = await seeded_client.put(
        f"/api/v1/hydrants/{hydrant_id}",
        json={"longitude": -90.0, "latitude": 40.0},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert abs(data["longitude"] - (-90.0)) < 0.0001
    assert abs(data["latitude"] - 40.0) < 0.0001


# --- DELETE ---


@pytest.mark.asyncio
async def test_delete_hydrant(seeded_client):
    """Delete a hydrant and verify it's gone."""
    create_resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(),
        headers=tenant_a_headers(),
    )
    hydrant_id = create_resp.json()["hydrant_id"]

    resp = await seeded_client.delete(
        f"/api/v1/hydrants/{hydrant_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    resp = await seeded_client.get(
        f"/api/v1/hydrants/{hydrant_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- HYDRANT TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_hydrant_tenant_isolation(seeded_client):
    """Hydrants from one tenant are not visible to another."""
    create_resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(),
        headers=tenant_a_headers(),
    )
    hydrant_id = create_resp.json()["hydrant_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/hydrants/{hydrant_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/hydrants",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# PRESSURE ZONES (Polygon)
# ===========================================================================


# --- CREATE ---


@pytest.mark.asyncio
async def test_create_pressure_zone(seeded_client):
    """Create a pressure zone with polygon geometry."""
    resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["tenant_id"] == str(TENANT_A_ID)
    assert data["zone_name"] == "Zone 1 - Low Pressure"
    assert data["zone_number"] == "Z1"
    assert float(data["target_pressure_min_psi"]) == 40.0
    assert float(data["target_pressure_max_psi"]) == 80.0
    assert data["description"] == "Low-pressure service area downtown"
    assert "pressure_zone_id" in data
    # Coordinates should be present (auto-closed polygon = 5 points from 4 input)
    assert data["coordinates"] is not None


@pytest.mark.asyncio
async def test_create_pressure_zone_no_geometry(seeded_client):
    """Create a pressure zone without geometry (allowed)."""
    resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json={
            "zone_name": "Zone 2 - High Pressure",
            "zone_number": "Z2",
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["zone_name"] == "Zone 2 - High Pressure"
    assert data["coordinates"] is None


@pytest.mark.asyncio
async def test_create_pressure_zone_too_few_coords(seeded_client):
    """Polygon requires at least 3 coordinate pairs."""
    resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(coordinates=[[-89.65, 39.78], [-89.66, 39.78]]),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 400
    assert "at least 3" in resp.json()["detail"]


# --- LIST ---


@pytest.mark.asyncio
async def test_list_pressure_zones(seeded_client):
    """List returns correct count."""
    await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(zone_name="Zone A"),
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(zone_name="Zone B"),
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get(
        "/api/v1/pressure-zones",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["pressure_zones"]) == 2


@pytest.mark.asyncio
async def test_list_pressure_zones_empty(seeded_client):
    """Empty tenant returns empty pressure zone list."""
    resp = await seeded_client.get(
        "/api/v1/pressure-zones",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pressure_zones"] == []
    assert data["total"] == 0


# --- GET ---


@pytest.mark.asyncio
async def test_get_pressure_zone_by_id(seeded_client):
    """Fetch a pressure zone by ID and verify zone_name and geometry."""
    create_resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(),
        headers=tenant_a_headers(),
    )
    zone_id = create_resp.json()["pressure_zone_id"]

    resp = await seeded_client.get(
        f"/api/v1/pressure-zones/{zone_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pressure_zone_id"] == zone_id
    assert data["zone_name"] == "Zone 1 - Low Pressure"
    assert data["zone_number"] == "Z1"
    assert data["coordinates"] is not None
    # Polygon should be auto-closed (5 points from 4 input)
    assert len(data["coordinates"]) == 5
    assert data["coordinates"][0] == data["coordinates"][-1]


@pytest.mark.asyncio
async def test_get_pressure_zone_not_found(seeded_client):
    """404 for non-existent pressure zone."""
    fake_id = str(uuid.uuid4())
    resp = await seeded_client.get(
        f"/api/v1/pressure-zones/{fake_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# --- PRESSURE ZONE TENANT ISOLATION ---


@pytest.mark.asyncio
async def test_pressure_zone_tenant_isolation(seeded_client):
    """Pressure zones from one tenant are not visible to another."""
    create_resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(),
        headers=tenant_a_headers(),
    )
    zone_id = create_resp.json()["pressure_zone_id"]

    # Tenant B cannot see it
    get_resp = await seeded_client.get(
        f"/api/v1/pressure-zones/{zone_id}",
        headers=tenant_b_headers(),
    )
    assert get_resp.status_code == 404

    # Tenant B list is empty
    list_resp = await seeded_client.get(
        "/api/v1/pressure-zones",
        headers=tenant_b_headers(),
    )
    assert list_resp.json()["total"] == 0


# ===========================================================================
# LOOKUP ENDPOINTS (Reference data)
# ===========================================================================


@pytest.mark.asyncio
async def test_list_water_material_types(seeded_client):
    """GET /water-material-types returns seeded reference data."""
    resp = await seeded_client.get(
        "/api/v1/water-material-types",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) == 15
    # Verify structure
    first = types[0]
    assert "code" in first
    assert "description" in first
    assert "expected_life_years" in first
    assert "is_active" in first
    # Spot-check a known type
    codes = {t["code"] for t in types}
    assert "DI" in codes
    assert "PVC" in codes
    assert "CI" in codes


@pytest.mark.asyncio
async def test_list_water_valve_types(seeded_client):
    """GET /water-valve-types returns seeded reference data."""
    resp = await seeded_client.get(
        "/api/v1/water-valve-types",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    types = resp.json()
    assert len(types) == 15
    # Verify structure
    first = types[0]
    assert "code" in first
    assert "description" in first
    assert "exercise_interval_days" in first
    assert "is_active" in first
    # Spot-check known types
    codes = {t["code"] for t in types}
    assert "GATE" in codes
    assert "BUTTERFLY" in codes
    assert "PRV" in codes


# ===========================================================================
# CROSS-ASSET REFERENCES
# ===========================================================================


@pytest.mark.asyncio
async def test_hydrant_with_connected_main(seeded_client):
    """Create a hydrant connected to a water main."""
    # Create a water main first
    main_resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(),
        headers=tenant_a_headers(),
    )
    main_id = main_resp.json()["water_main_id"]

    # Create hydrant connected to that main
    resp = await seeded_client.post(
        "/api/v1/hydrants",
        json=_hydrant_payload(
            connected_main_id=main_id,
            main_size_inches=12.0,
            lateral_size_inches=6.0,
        ),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["connected_main_id"] == main_id
    assert float(data["main_size_inches"]) == 12.0
    assert float(data["lateral_size_inches"]) == 6.0


@pytest.mark.asyncio
async def test_water_main_with_pressure_zone(seeded_client):
    """Create a water main assigned to a pressure zone."""
    # Create pressure zone first
    zone_resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(),
        headers=tenant_a_headers(),
    )
    zone_id = zone_resp.json()["pressure_zone_id"]

    # Create water main in that zone
    resp = await seeded_client.post(
        "/api/v1/water-mains",
        json=_water_main_payload(pressure_zone_id=zone_id),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["pressure_zone_id"] == zone_id


@pytest.mark.asyncio
async def test_valve_with_pressure_zone(seeded_client):
    """Create a valve assigned to a pressure zone."""
    # Create pressure zone first
    zone_resp = await seeded_client.post(
        "/api/v1/pressure-zones",
        json=_pressure_zone_payload(),
        headers=tenant_a_headers(),
    )
    zone_id = zone_resp.json()["pressure_zone_id"]

    # Create valve in that zone
    resp = await seeded_client.post(
        "/api/v1/water-valves",
        json=_water_valve_payload(pressure_zone_id=zone_id),
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["pressure_zone_id"] == zone_id
