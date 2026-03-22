"""Health check and basic app tests."""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "AssetLink"


@pytest.mark.asyncio
async def test_openapi_docs_accessible(client):
    resp = await client.get("/docs")
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_openapi_json_accessible(client):
    resp = await client.get("/openapi.json")
    assert resp.status_code == 200
    schema = resp.json()
    assert "paths" in schema
    assert "/api/v1/signs" in schema["paths"]
