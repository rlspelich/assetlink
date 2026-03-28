"""
Integration tests for the Estimator module.

Tests cover:
- Pay item search (catalog)
- Award price history (from 1.4M-row award_item table)
- Price statistics (weighted, inflation-adjusted)
- Confidence scoring
- Estimate CRUD (create, read, update, delete, duplicate)
- Estimate items (add, update price, delete)
- Recalculate
- Regional factors
- Cost index seeding
- Tenant isolation for estimates
"""
import pytest
from httpx import AsyncClient

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


# ===========================================================================
# PAY ITEM SEARCH
# ===========================================================================


@pytest.mark.asyncio
async def test_pay_item_search_returns_results(estimator_seeded_client: AsyncClient):
    """Search the pay item catalog by description."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items",
        params={"search": "mobilization", "page_size": 5},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0
    assert len(data["pay_items"]) > 0
    assert any("MOBILIZATION" in p["description"].upper() for p in data["pay_items"])


@pytest.mark.asyncio
async def test_pay_item_search_no_results(estimator_seeded_client: AsyncClient):
    """Search with a term that has no matches."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items",
        params={"search": "xyznonexistent99999"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["pay_items"] == []


@pytest.mark.asyncio
async def test_pay_item_search_pagination(estimator_seeded_client: AsyncClient):
    """Pay item search respects pagination."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items",
        params={"search": "excavation", "page_size": 3, "page": 1},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["page"] == 1
    assert data["page_size"] == 3
    assert len(data["pay_items"]) <= 3


# ===========================================================================
# AWARD PRICE HISTORY
# ===========================================================================


@pytest.mark.asyncio
async def test_award_price_history(estimator_seeded_client: AsyncClient):
    """Get price history from the shared award_item table."""
    # Use a common pay item code — check what exists
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/award-items/20200100/price-history",
        params={"limit": 10},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pay_item_code"] == "20200100"
    # May or may not have data depending on test DB state
    assert "data_points" in data
    assert "total_records" in data


@pytest.mark.asyncio
async def test_award_price_history_no_tenant_required(estimator_seeded_client: AsyncClient):
    """Award price history is reference data — no tenant header needed."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/award-items/20200100/price-history",
        params={"limit": 5},
        # Note: no X-Tenant-ID header
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_award_price_history_with_filters(estimator_seeded_client: AsyncClient):
    """Award price history supports district and date filters."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/award-items/20200100/price-history",
        params={"district": "1", "min_date": "2020-01-01", "limit": 10},
    )
    assert resp.status_code == 200


# ===========================================================================
# PRICE STATS
# ===========================================================================


@pytest.mark.asyncio
async def test_price_stats(estimator_seeded_client: AsyncClient):
    """Get weighted price statistics for a pay item."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items/20200100/price-stats",
        params={"years_back": 10},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pay_item_code"] == "20200100"
    assert "weighted_avg" in data
    assert "median" in data
    assert "p25" in data
    assert "p75" in data
    assert "data_points" in data


@pytest.mark.asyncio
async def test_price_stats_with_state(estimator_seeded_client: AsyncClient):
    """Price stats accept a target state for regional adjustment."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items/20200100/price-stats",
        params={"target_state": "CA", "years_back": 5},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pay_item_code"] == "20200100"


@pytest.mark.asyncio
async def test_price_stats_no_data(estimator_seeded_client: AsyncClient):
    """Price stats for a nonexistent code returns zeros."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items/ZZZZZZZZ/price-stats",
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["data_points"] == 0
    assert float(data["weighted_avg"]) == 0


# ===========================================================================
# CONFIDENCE SCORING
# ===========================================================================


@pytest.mark.asyncio
async def test_confidence_scoring(estimator_seeded_client: AsyncClient):
    """Score a proposed unit price against historical data."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items/20200100/confidence",
        params={"unit_price": 50.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "percentile" in data
    assert "label" in data
    assert "color" in data
    assert data["label"] in ("very_low", "low", "fair", "high", "very_high", "no_data")


@pytest.mark.asyncio
async def test_confidence_no_data(estimator_seeded_client: AsyncClient):
    """Confidence for a nonexistent code returns no_data."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items/ZZZZZZZZ/confidence",
        params={"unit_price": 100.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["label"] == "no_data"
    assert data["percentile"] is None


@pytest.mark.asyncio
async def test_confidence_percentile_capped(estimator_seeded_client: AsyncClient):
    """Confidence percentile should never exceed 100."""
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items/20200100/confidence",
        params={"unit_price": 999999.0},
    )
    assert resp.status_code == 200
    data = resp.json()
    if data["percentile"] is not None:
        assert data["percentile"] <= 100


# ===========================================================================
# ESTIMATE CRUD
# ===========================================================================


@pytest.mark.asyncio
async def test_create_estimate(estimator_seeded_client: AsyncClient):
    """Create a new estimate."""
    resp = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "I-55 Resurfacing", "target_state": "IL"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "I-55 Resurfacing"
    assert data["target_state"] == "IL"
    assert data["status"] == "draft"
    assert data["item_count"] == 0
    assert float(data["total_nominal"]) == 0


@pytest.mark.asyncio
async def test_list_estimates(estimator_seeded_client: AsyncClient):
    """List estimates for a tenant."""
    # Create two estimates
    await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Estimate A"}, headers=tenant_a_headers(),
    )
    await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Estimate B"}, headers=tenant_a_headers(),
    )

    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/estimates", headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    assert len(data["estimates"]) == 2


@pytest.mark.asyncio
async def test_get_estimate_detail(estimator_seeded_client: AsyncClient):
    """Get estimate with items."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Test Detail"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    resp = await estimator_seeded_client.get(
        f"/api/v1/estimator/estimates/{est_id}", headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Detail"
    assert "items" in data
    assert data["items"] == []


@pytest.mark.asyncio
async def test_update_estimate_name(estimator_seeded_client: AsyncClient):
    """Rename an estimate."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Old Name"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    resp = await estimator_seeded_client.put(
        f"/api/v1/estimator/estimates/{est_id}",
        json={"name": "New Name"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


@pytest.mark.asyncio
async def test_delete_estimate(estimator_seeded_client: AsyncClient):
    """Delete an estimate."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "To Delete"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    resp = await estimator_seeded_client.delete(
        f"/api/v1/estimator/estimates/{est_id}", headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    # Verify it's gone
    resp = await estimator_seeded_client.get(
        f"/api/v1/estimator/estimates/{est_id}", headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_duplicate_estimate(estimator_seeded_client: AsyncClient):
    """Duplicate an estimate."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Original"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    resp = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/duplicate",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Original (Copy)"
    assert data["estimate_id"] != est_id


@pytest.mark.asyncio
async def test_estimate_not_found(estimator_seeded_client: AsyncClient):
    """Accessing a nonexistent estimate returns 404."""
    fake_id = "00000000-0000-0000-0000-000000000099"
    resp = await estimator_seeded_client.get(
        f"/api/v1/estimator/estimates/{fake_id}", headers=tenant_a_headers(),
    )
    assert resp.status_code == 404


# ===========================================================================
# ESTIMATE ITEMS
# ===========================================================================


@pytest.mark.asyncio
async def test_add_items_to_estimate(estimator_seeded_client: AsyncClient):
    """Add pay items to an estimate — should auto-price from historical data."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "With Items"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    resp = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/items",
        json=[
            {"pay_item_code": "20200100", "quantity": 1000, "description": "EARTH EXCAVATION", "unit": "CU YD"},
        ],
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    items = resp.json()
    assert len(items) == 1
    assert items[0]["pay_item_code"] == "20200100"
    assert items[0]["description"] == "EARTH EXCAVATION"
    assert float(items[0]["quantity"]) == 1000

    # Verify estimate totals updated
    detail = await estimator_seeded_client.get(
        f"/api/v1/estimator/estimates/{est_id}", headers=tenant_a_headers(),
    )
    assert detail.status_code == 200
    assert detail.json()["item_count"] == 1
    assert float(detail.json()["total_nominal"]) > 0


@pytest.mark.asyncio
async def test_add_custom_item(estimator_seeded_client: AsyncClient):
    """Add a custom item (not in the pay item catalog)."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Custom Items"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    resp = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/items",
        json=[
            {"pay_item_code": "CUSTOM_001", "quantity": 1, "description": "Traffic Control Sub", "unit": "L SUM"},
        ],
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    items = resp.json()
    assert items[0]["description"] == "Traffic Control Sub"
    assert items[0]["unit_price_source"] == "manual"  # No historical data


@pytest.mark.asyncio
async def test_update_item_price(estimator_seeded_client: AsyncClient):
    """Override an item's unit price manually."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Price Override"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    add = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/items",
        json=[{"pay_item_code": "20200100", "quantity": 100}],
        headers=tenant_a_headers(),
    )
    item_id = add.json()[0]["estimate_item_id"]

    resp = await estimator_seeded_client.put(
        f"/api/v1/estimator/estimates/{est_id}/items/{item_id}",
        json={"unit_price": 55.00, "unit_price_source": "manual"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["unit_price"]) == 55.00
    assert data["unit_price_source"] == "manual"
    assert float(data["extension"]) == 5500.00


@pytest.mark.asyncio
async def test_delete_item(estimator_seeded_client: AsyncClient):
    """Remove an item from an estimate."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Delete Item"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    add = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/items",
        json=[{"pay_item_code": "20200100", "quantity": 100}],
        headers=tenant_a_headers(),
    )
    item_id = add.json()[0]["estimate_item_id"]

    resp = await estimator_seeded_client.delete(
        f"/api/v1/estimator/estimates/{est_id}/items/{item_id}",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 204

    # Verify item count is 0
    detail = await estimator_seeded_client.get(
        f"/api/v1/estimator/estimates/{est_id}", headers=tenant_a_headers(),
    )
    assert detail.json()["item_count"] == 0


# ===========================================================================
# RECALCULATE
# ===========================================================================


@pytest.mark.asyncio
async def test_recalculate_estimate(estimator_seeded_client: AsyncClient):
    """Recalculate re-runs pricing on all items."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Recalc Test"}, headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/items",
        json=[{"pay_item_code": "20200100", "quantity": 500}],
        headers=tenant_a_headers(),
    )

    resp = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/recalculate",
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["item_count"] == 1
    assert float(data["total_nominal"]) > 0
    assert len(data["items"]) == 1


# ===========================================================================
# REGIONAL FACTORS
# ===========================================================================


@pytest.mark.asyncio
async def test_list_regional_factors(estimator_seeded_client: AsyncClient):
    """Get all state-level cost factors."""
    resp = await estimator_seeded_client.get("/api/v1/estimator/regional-factors")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    # Find Illinois
    il = next((f for f in data if f["state_code"] == "IL"), None)
    assert il is not None
    assert float(il["factor"]) == 1.0


@pytest.mark.asyncio
async def test_regional_factors_all_states(estimator_seeded_client: AsyncClient):
    """All 50 states + DC should have factors."""
    resp = await estimator_seeded_client.get("/api/v1/estimator/regional-factors")
    data = resp.json()
    assert len(data) >= 51


# ===========================================================================
# COST INDEX SEEDING
# ===========================================================================


@pytest.mark.asyncio
async def test_seed_cost_indices(estimator_seeded_client: AsyncClient):
    """Seed endpoint loads index data and mappings."""
    resp = await estimator_seeded_client.post("/api/v1/estimator/cost-indices/seed")
    assert resp.status_code == 200
    data = resp.json()
    assert data["created"] >= 0  # May already be seeded
    assert "message" in data


@pytest.mark.asyncio
async def test_seed_regional_factors(estimator_seeded_client: AsyncClient):
    """Seed endpoint loads regional factors."""
    resp = await estimator_seeded_client.post("/api/v1/estimator/regional-factors/seed")
    assert resp.status_code == 200
    data = resp.json()
    assert "created" in data


# ===========================================================================
# TENANT ISOLATION
# ===========================================================================


@pytest.mark.asyncio
async def test_estimates_tenant_isolated(estimator_seeded_client: AsyncClient):
    """Tenant A cannot see Tenant B's estimates."""
    # Create estimate as Tenant A
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Tenant A Secret Bid"},
        headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    # Tenant B cannot see it
    resp = await estimator_seeded_client.get(
        f"/api/v1/estimator/estimates/{est_id}",
        headers=tenant_b_headers(),
    )
    assert resp.status_code == 404

    # Tenant B's list doesn't include it
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/estimates",
        headers=tenant_b_headers(),
    )
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_estimates_require_tenant(estimator_seeded_client: AsyncClient):
    """Estimate endpoints require X-Tenant-ID header."""
    resp = await estimator_seeded_client.get("/api/v1/estimator/estimates")
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_tenant_b_cannot_modify_tenant_a_estimate(estimator_seeded_client: AsyncClient):
    """Tenant B cannot update or delete Tenant A's estimate."""
    create = await estimator_seeded_client.post(
        "/api/v1/estimator/estimates",
        json={"name": "Protected"},
        headers=tenant_a_headers(),
    )
    est_id = create.json()["estimate_id"]

    # Cannot update
    resp = await estimator_seeded_client.put(
        f"/api/v1/estimator/estimates/{est_id}",
        json={"name": "Hijacked"},
        headers=tenant_b_headers(),
    )
    assert resp.status_code == 404

    # Cannot delete
    resp = await estimator_seeded_client.delete(
        f"/api/v1/estimator/estimates/{est_id}",
        headers=tenant_b_headers(),
    )
    assert resp.status_code == 404

    # Cannot duplicate
    resp = await estimator_seeded_client.post(
        f"/api/v1/estimator/estimates/{est_id}/duplicate",
        headers=tenant_b_headers(),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reference_data_no_tenant_needed(estimator_seeded_client: AsyncClient):
    """Pay items, award history, price stats, and regional factors don't need tenant."""
    # Pay items
    resp = await estimator_seeded_client.get(
        "/api/v1/estimator/pay-items", params={"search": "mob"},
    )
    assert resp.status_code == 200

    # Regional factors
    resp = await estimator_seeded_client.get("/api/v1/estimator/regional-factors")
    assert resp.status_code == 200
