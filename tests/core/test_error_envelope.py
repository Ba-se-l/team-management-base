"""Tests verifying uniform ErrorResponse envelope structure across HTTP error scenarios."""

import pytest
from httpx import AsyncClient
from src.exc import BusinessRuleViolationException, NotFoundException
from src.main import app


from fastapi import APIRouter

error_probe_router = APIRouter(prefix="/api/v1/test-error")


@error_probe_router.get("/domain-not-found")
async def _trigger_domain_not_found():
    raise NotFoundException(entity="Project", identifier=999)


@error_probe_router.get("/business-violation")
async def _trigger_business_violation():
    raise BusinessRuleViolationException(
        message="Cannot remove the sole team leader.",
        error_code="LAST_ADMIN_CANNOT_BE_REMOVED",
    )


@error_probe_router.get("/server-crash")
async def _trigger_server_crash():
    raise ZeroDivisionError("Simulated unhandled internal error")


app.include_router(error_probe_router)


@pytest.mark.parametrize(
    "path, expected_status, expected_code",
    [
        ("/api/v1/test-error/domain-not-found", 404, "PROJECT_NOT_FOUND"),
        ("/api/v1/test-error/business-violation", 422, "LAST_ADMIN_CANNOT_BE_REMOVED"),
        ("/api/v1/non-existent-endpoint-xyz", 404, "NOT_FOUND"),
        ("/api/v1/test-error/server-crash", 500, "INTERNAL_SERVER_ERROR"),
    ],
    ids=["domain_not_found", "business_violation", "unmapped_route", "unhandled_crash"],
)
@pytest.mark.asyncio
async def test_error_envelope_matrix(
    client: AsyncClient,
    path: str,
    expected_status: int,
    expected_code: str,
) -> None:
    """Verifies standard ErrorResponse envelope structure across HTTP error scenarios."""
    response = await client.get(path)
    assert response.status_code == expected_status
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"]["code"] == expected_code
    assert payload["request_id"] is not None


@pytest.mark.asyncio
async def test_not_found_returns_standard_error_envelope(client: AsyncClient) -> None:
    """Verifies that NotFoundException returns HTTP 404 with standard ErrorResponse envelope."""
    response = await client.get("/api/v1/test-error/domain-not-found", headers={"X-Request-ID": "req-404-test"})

    assert response.status_code == 404
    payload = response.json()

    assert payload["success"] is False
    assert payload["error"]["code"] == "PROJECT_NOT_FOUND"
    assert "identifier '999' was not found" in payload["error"]["message"]
    assert payload["request_id"] == "req-404-test"
    assert response.headers.get("X-Request-ID") == "req-404-test"


@pytest.mark.asyncio
async def test_business_rule_violation_envelope(client: AsyncClient) -> None:
    """Verifies that BusinessRuleViolationException returns HTTP 422 with rule code."""
    response = await client.get("/api/v1/test-error/business-violation")

    assert response.status_code == 422
    payload = response.json()

    assert payload["success"] is False
    assert payload["error"]["code"] == "LAST_ADMIN_CANNOT_BE_REMOVED"
    assert payload["error"]["message"] == "Cannot remove the sole team leader."


@pytest.mark.asyncio
async def test_starlette_http_404_envelope(client: AsyncClient) -> None:
    """Verifies that accessing an unmapped route returns standard ErrorResponse envelope."""
    response = await client.get("/api/v1/non-existent-endpoint-xyz")

    assert response.status_code == 404
    payload = response.json()

    assert payload["success"] is False
    assert payload["error"]["code"] == "NOT_FOUND"
    assert payload["request_id"] is not None


@pytest.mark.asyncio
async def test_unhandled_exception_returns_500_envelope_without_leaking_trace(
    client: AsyncClient,
) -> None:
    """Verifies that uncaught server errors return 500 without leaking internal stack traces."""
    response = await client.get("/api/v1/test-error/server-crash")

    assert response.status_code == 500
    payload = response.json()

    assert payload["success"] is False
    assert payload["error"]["code"] == "INTERNAL_SERVER_ERROR"
    assert payload["error"]["message"] == "An unexpected server error occurred."
    assert "ZeroDivisionError" not in str(payload)
    assert payload["request_id"] is not None

