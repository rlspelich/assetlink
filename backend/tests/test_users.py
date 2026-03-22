"""
Tests for the Users & Roles management API.
"""

import pytest
from httpx import AsyncClient

from tests.conftest import TENANT_A_ID, TENANT_B_ID, tenant_a_headers, tenant_b_headers


# --- List users ---


@pytest.mark.asyncio
async def test_list_users_empty(seeded_client: AsyncClient):
    resp = await seeded_client.get("/api/v1/users", headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["users"] == []
    assert data["total"] == 0


@pytest.mark.asyncio
async def test_list_users_returns_created(seeded_client: AsyncClient):
    # Create two users
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "Alice", "last_name": "Smith", "email": "alice@test.gov", "role": "admin"},
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "Bob", "last_name": "Jones", "email": "bob@test.gov", "role": "crew_chief"},
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get("/api/v1/users", headers=tenant_a_headers())
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    # Sorted by last_name: Jones before Smith
    assert data["users"][0]["last_name"] == "Jones"
    assert data["users"][1]["last_name"] == "Smith"


# --- Create user ---


@pytest.mark.asyncio
async def test_create_user_basic(seeded_client: AsyncClient):
    resp = await seeded_client.post(
        "/api/v1/users",
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@township.gov",
            "role": "supervisor",
            "employee_id": "EMP-001",
            "phone": "(555) 123-4567",
        },
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["first_name"] == "John"
    assert data["last_name"] == "Doe"
    assert data["full_name"] == "John Doe"
    assert data["email"] == "john@township.gov"
    assert data["role"] == "supervisor"
    assert data["employee_id"] == "EMP-001"
    assert data["phone"] == "(555) 123-4567"
    assert data["is_active"] is True
    assert data["user_id"] is not None
    assert data["tenant_id"] == str(TENANT_A_ID)


@pytest.mark.asyncio
async def test_create_user_defaults(seeded_client: AsyncClient):
    resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "Jane", "last_name": "Doe", "email": "jane@test.gov"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["role"] == "crew_chief"  # default role
    assert data["employee_id"] is None
    assert data["phone"] is None


@pytest.mark.asyncio
async def test_create_user_duplicate_email_rejected(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "dupe@test.gov"},
        headers=tenant_a_headers(),
    )
    resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "C", "last_name": "D", "email": "dupe@test.gov"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 409
    assert "already exists" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_user_same_email_different_tenant(seeded_client: AsyncClient):
    resp1 = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "shared@test.gov"},
        headers=tenant_a_headers(),
    )
    resp2 = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "X", "last_name": "Y", "email": "shared@test.gov"},
        headers=tenant_b_headers(),
    )
    assert resp1.status_code == 201
    assert resp2.status_code == 201


@pytest.mark.asyncio
async def test_create_user_duplicate_employee_id_rejected(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "a@test.gov", "employee_id": "EMP-1"},
        headers=tenant_a_headers(),
    )
    resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "C", "last_name": "D", "email": "c@test.gov", "employee_id": "EMP-1"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 409
    assert "employee ID" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_create_user_invalid_role(seeded_client: AsyncClient):
    resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "a@test.gov", "role": "superadmin"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 422


# --- Get user ---


@pytest.mark.asyncio
async def test_get_user(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "Get", "last_name": "Test", "email": "get@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]

    resp = await seeded_client.get(f"/api/v1/users/{user_id}", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["user_id"] == user_id
    assert resp.json()["full_name"] == "Get Test"


@pytest.mark.asyncio
async def test_get_user_cross_tenant_forbidden(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "a@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]

    # Tenant B cannot see Tenant A's user
    resp = await seeded_client.get(f"/api/v1/users/{user_id}", headers=tenant_b_headers())
    assert resp.status_code == 404


# --- Update user ---


@pytest.mark.asyncio
async def test_update_user(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "Old", "last_name": "Name", "email": "old@test.gov", "role": "crew_chief"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]

    resp = await seeded_client.put(
        f"/api/v1/users/{user_id}",
        json={"first_name": "New", "last_name": "Name", "role": "supervisor"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["first_name"] == "New"
    assert data["full_name"] == "New Name"
    assert data["role"] == "supervisor"


@pytest.mark.asyncio
async def test_update_user_email_uniqueness(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "taken@test.gov"},
        headers=tenant_a_headers(),
    )
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "C", "last_name": "D", "email": "free@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]

    resp = await seeded_client.put(
        f"/api/v1/users/{user_id}",
        json={"email": "taken@test.gov"},
        headers=tenant_a_headers(),
    )
    assert resp.status_code == 409


# --- Delete (soft) ---


@pytest.mark.asyncio
async def test_delete_user_soft(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "Del", "last_name": "User", "email": "del@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]

    resp = await seeded_client.delete(f"/api/v1/users/{user_id}", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # User no longer appears in active-only list
    list_resp = await seeded_client.get("/api/v1/users?is_active=true", headers=tenant_a_headers())
    assert list_resp.json()["total"] == 0

    # User still appears if we don't filter
    all_resp = await seeded_client.get("/api/v1/users", headers=tenant_a_headers())
    assert all_resp.json()["total"] == 1


@pytest.mark.asyncio
async def test_delete_already_inactive(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "a@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]
    await seeded_client.delete(f"/api/v1/users/{user_id}", headers=tenant_a_headers())

    # Second delete should fail
    resp = await seeded_client.delete(f"/api/v1/users/{user_id}", headers=tenant_a_headers())
    assert resp.status_code == 400


# --- Reactivate ---


@pytest.mark.asyncio
async def test_reactivate_user(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "React", "last_name": "User", "email": "react@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]
    await seeded_client.delete(f"/api/v1/users/{user_id}", headers=tenant_a_headers())

    resp = await seeded_client.put(f"/api/v1/users/{user_id}/reactivate", headers=tenant_a_headers())
    assert resp.status_code == 200
    assert resp.json()["is_active"] is True


@pytest.mark.asyncio
async def test_reactivate_already_active(seeded_client: AsyncClient):
    create_resp = await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "B", "email": "a@test.gov"},
        headers=tenant_a_headers(),
    )
    user_id = create_resp.json()["user_id"]

    resp = await seeded_client.put(f"/api/v1/users/{user_id}/reactivate", headers=tenant_a_headers())
    assert resp.status_code == 400


# --- Filter by role ---


@pytest.mark.asyncio
async def test_list_users_filter_by_role(seeded_client: AsyncClient):
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "Admin", "email": "admin@test.gov", "role": "admin"},
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "S", "last_name": "Super", "email": "super@test.gov", "role": "supervisor"},
        headers=tenant_a_headers(),
    )
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "C", "last_name": "Crew", "email": "crew@test.gov", "role": "crew_chief"},
        headers=tenant_a_headers(),
    )

    resp = await seeded_client.get("/api/v1/users?role=admin", headers=tenant_a_headers())
    assert resp.json()["total"] == 1
    assert resp.json()["users"][0]["role"] == "admin"

    resp = await seeded_client.get("/api/v1/users?role=supervisor", headers=tenant_a_headers())
    assert resp.json()["total"] == 1


# --- Tenant isolation ---


@pytest.mark.asyncio
async def test_tenant_isolation(seeded_client: AsyncClient):
    """Users in tenant A are not visible to tenant B."""
    await seeded_client.post(
        "/api/v1/users",
        json={"first_name": "A", "last_name": "User", "email": "a@test.gov"},
        headers=tenant_a_headers(),
    )

    # Tenant B should see no users
    resp = await seeded_client.get("/api/v1/users", headers=tenant_b_headers())
    assert resp.json()["total"] == 0

    # Tenant A should see one user
    resp = await seeded_client.get("/api/v1/users", headers=tenant_a_headers())
    assert resp.json()["total"] == 1
