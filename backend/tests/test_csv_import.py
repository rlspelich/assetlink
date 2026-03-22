"""
CSV import tests.

Tests column mapping, validation, error handling, encoding, and edge cases.
"""

import io

import pytest

from tests.conftest import TENANT_A_ID, tenant_a_headers


def _make_csv(rows: list[str]) -> bytes:
    """Helper: join lines into a CSV byte string."""
    return "\n".join(rows).encode("utf-8")


# --- HAPPY PATH ---


@pytest.mark.asyncio
async def test_import_basic_csv(seeded_client):
    """Import a simple CSV with standard column names."""
    csv_data = _make_csv([
        "latitude,longitude,mutcd_code,road_name,status,condition_rating",
        "39.78,-89.65,R1-1,Main Street,active,4",
        "39.79,-89.66,W1-1,Oak Avenue,active,3",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] == 2
    assert data["skipped"] == 0
    assert data["total_rows"] == 2
    assert data["errors"] == []


@pytest.mark.asyncio
async def test_import_fuzzy_column_names(seeded_client):
    """Column names with different casing, spaces, and aliases should map correctly."""
    csv_data = _make_csv([
        "Lat,Long,MUTCD,Street,Cross Street,Condition,Status",
        "39.78,-89.65,R1-1,Main St,Elm Ave,4,active",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 1
    mapping = data["column_mapping"]
    assert mapping["Lat"] == "latitude"
    assert mapping["Long"] == "longitude"
    assert mapping["MUTCD"] == "mutcd_code"
    assert mapping["Street"] == "road_name"
    assert mapping["Cross Street"] == "intersection_with"
    assert mapping["Condition"] == "condition_rating"


@pytest.mark.asyncio
async def test_import_unmapped_columns_go_to_custom_fields(seeded_client):
    """Columns that don't match any alias should be stored in custom_fields."""
    csv_data = _make_csv([
        "latitude,longitude,status,legacy_asset_id,department_code",
        "39.78,-89.65,active,SIGN-001,DPW-A",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    assert resp.json()["created"] == 1

    # Verify the sign has custom_fields
    signs_resp = await seeded_client.get("/api/v1/signs", headers=tenant_a_headers())
    signs = signs_resp.json()["signs"]
    assert len(signs) == 1
    cf = signs[0]["custom_fields"]
    assert cf["legacy_asset_id"] == "SIGN-001"
    assert cf["department_code"] == "DPW-A"


@pytest.mark.asyncio
async def test_import_date_formats(seeded_client):
    """Multiple date formats should be accepted."""
    csv_data = _make_csv([
        "latitude,longitude,status,install_date",
        "39.78,-89.65,active,2020-06-15",
        "39.79,-89.66,active,06/15/2020",
        "39.80,-89.67,active,06-15-2020",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 3
    assert data["skipped"] == 0


# --- VALIDATION ERRORS ---


@pytest.mark.asyncio
async def test_import_missing_coordinates_skips_row(seeded_client):
    """Rows missing lat/lon should be skipped, not crash the import."""
    csv_data = _make_csv([
        "latitude,longitude,status,road_name",
        "39.78,-89.65,active,Good Sign",
        ",,active,No Coordinates",
        "39.80,-89.67,active,Another Good Sign",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 2
    assert data["skipped"] == 1
    assert any(e["field"] == "latitude" for e in data["errors"])


@pytest.mark.asyncio
async def test_import_invalid_coordinates(seeded_client):
    """Out-of-range coordinates should skip the row."""
    csv_data = _make_csv([
        "latitude,longitude,status",
        "999.0,-89.65,active",
        "39.78,-999.0,active",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 0
    assert data["skipped"] == 2


@pytest.mark.asyncio
async def test_import_invalid_mutcd_code_still_creates(seeded_client):
    """Invalid MUTCD codes should warn but still create the sign without a code."""
    csv_data = _make_csv([
        "latitude,longitude,mutcd_code,status",
        "39.78,-89.65,FAKE-99,active",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 1
    assert any("FAKE-99" in e["message"] for e in data["errors"])

    # Verify sign was created without mutcd_code
    signs_resp = await seeded_client.get("/api/v1/signs", headers=tenant_a_headers())
    assert signs_resp.json()["signs"][0]["mutcd_code"] is None


@pytest.mark.asyncio
async def test_import_invalid_condition_rating(seeded_client):
    """Condition rating out of 1-5 should warn and set to None."""
    csv_data = _make_csv([
        "latitude,longitude,status,condition_rating",
        "39.78,-89.65,active,0",
        "39.79,-89.66,active,6",
        "39.80,-89.67,active,abc",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 3
    assert len([e for e in data["errors"] if e["field"] == "condition_rating"]) == 3


@pytest.mark.asyncio
async def test_import_invalid_status_defaults_to_active(seeded_client):
    """Invalid status should default to 'active' with a warning."""
    csv_data = _make_csv([
        "latitude,longitude,status",
        "39.78,-89.65,bogus_status",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 1
    assert any("bogus_status" in e["message"] for e in data["errors"])


@pytest.mark.asyncio
async def test_import_bad_date_still_creates(seeded_client):
    """Unparseable dates should warn but still create the sign."""
    csv_data = _make_csv([
        "latitude,longitude,status,install_date",
        "39.78,-89.65,active,not-a-date",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 1
    assert any("install_date" in e.get("field", "") for e in data["errors"])


# --- EDGE CASES ---


@pytest.mark.asyncio
async def test_import_empty_csv(seeded_client):
    """Empty CSV (headers only) should return zero rows."""
    csv_data = _make_csv([
        "latitude,longitude,status",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 0
    assert data["total_rows"] == 0


@pytest.mark.asyncio
async def test_import_no_coordinate_columns(seeded_client):
    """CSV without lat/lon columns should fail with a clear error."""
    csv_data = _make_csv([
        "mutcd_code,road_name,status",
        "R1-1,Main St,active",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 0
    assert any("latitude and longitude" in e["message"] for e in data["errors"])


@pytest.mark.asyncio
async def test_import_rejects_non_csv(seeded_client):
    """Non-CSV files should be rejected."""
    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.xlsx", io.BytesIO(b"not csv"), "application/octet-stream")},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 400
    assert "csv" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_import_excel_bom_encoding(seeded_client):
    """CSV exported from Excel with BOM should work."""
    csv_data = b"\xef\xbb\xbflatitude,longitude,status\n39.78,-89.65,active\n"

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 1


@pytest.mark.asyncio
async def test_import_whitespace_in_values(seeded_client):
    """Values with extra whitespace should be trimmed."""
    csv_data = _make_csv([
        "latitude,longitude,status,road_name",
        " 39.78 , -89.65 , active ,  Main Street  ",
    ])

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 1

    signs_resp = await seeded_client.get("/api/v1/signs", headers=tenant_a_headers())
    assert signs_resp.json()["signs"][0]["road_name"] == "Main Street"


@pytest.mark.asyncio
async def test_import_large_batch(seeded_client):
    """Import 100 signs in one CSV."""
    header = "latitude,longitude,status,road_name"
    rows = [f"{39.78 + i * 0.001},{-89.65 + i * 0.001},active,Road {i}" for i in range(100)]
    csv_data = _make_csv([header] + rows)

    resp = await seeded_client.post(
        "/api/v1/signs/import/csv",
        files={"file": ("signs.csv", io.BytesIO(csv_data), "text/csv")},
        headers=tenant_a_headers(),
    )
    data = resp.json()
    assert data["created"] == 100
    assert data["total_rows"] == 100
    assert data["errors"] == []
