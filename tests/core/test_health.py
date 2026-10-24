"""Integration test for health check probe and RequestIdMiddleware."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_returns_ok_and_propagates_request_id(async_client: AsyncClient) -> None:
    """Verifies that /health returns 200 with status healthy and sets X-Request-ID header."""
    custom_request_id = "test-corr-id-12345"
    response = await async_client.get("/health", headers={"X-Request-ID": custom_request_id})

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "team-management-base"
    assert response.headers.get("X-Request-ID") == custom_request_id


@pytest.mark.asyncio
async def test_health_check_generates_request_id_when_not_provided(async_client: AsyncClient) -> None:
    """Verifies that X-Request-ID is automatically generated if not supplied."""
    response = await async_client.get("/health")

    assert response.status_code == 200
    generated_id = response.headers.get("X-Request-ID")
    assert generated_id is not None
    assert len(generated_id) > 10
