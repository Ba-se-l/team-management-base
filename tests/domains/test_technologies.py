"""Integration tests for Technology catalog CRUD and search endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import UserStatus
from src.modules.user.models import User
from src.security import hash_password


@pytest.fixture
async def setup_tech_env(db_session: AsyncSession) -> dict[str, object]:
    """Sets up an authenticated active user."""
    user = User(
        name="Tech Curator",
        username="techcurator",
        email="curator@agency.io",
        hashed_password=hash_password("CuratorPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    return {"user": user}


async def _get_auth_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    """Authenticates user and returns Bearer token headers."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_technology_full_lifecycle(
    client: AsyncClient,
    setup_tech_env: dict[str, object],
) -> None:
    """Tests create, read, search, list, update, and delete endpoints for technologies."""
    headers = await _get_auth_headers(client, "curator@agency.io", "CuratorPass123!")

    # 1. Create technology
    create_payload = {
        "name": "Rust Lang",
        "description": "Systems programming language",
        "documentation_url": "https://rust-lang.org",
    }
    create_resp = await client.post("/api/v1/technologies/", json=create_payload, headers=headers)
    assert create_resp.status_code == 201
    tech_data = create_resp.json()
    assert tech_data["name"] == "Rust Lang"
    assert tech_data["description"] == "Systems programming language"
    tech_id = tech_data["id"]

    # 2. Get technology by ID
    get_resp = await client.get(f"/api/v1/technologies/{tech_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == tech_id
    assert get_resp.json()["name"] == "Rust Lang"

    # 3. Search technologies
    search_resp = await client.get("/api/v1/technologies/search?q=rust", headers=headers)
    assert search_resp.status_code == 200
    search_items = search_resp.json()
    assert any(item["name"] == "Rust Lang" for item in search_items)

    # 4. List technologies
    list_resp = await client.get("/api/v1/technologies/", headers=headers)
    assert list_resp.status_code == 200
    list_items = list_resp.json()
    assert isinstance(list_items, list)
    assert any(item["id"] == tech_id for item in list_items)

    # 5. Update technology
    update_payload = {"description": "Memory-safe systems programming language"}
    patch_resp = await client.patch(f"/api/v1/technologies/{tech_id}", json=update_payload, headers=headers)
    assert patch_resp.status_code == 200
    assert patch_resp.json()["description"] == "Memory-safe systems programming language"

    # 6. Delete technology (validates that delete_technology has no current_user signature mismatch)
    delete_resp = await client.delete(f"/api/v1/technologies/{tech_id}", headers=headers)
    assert delete_resp.status_code == 200
    assert delete_resp.json()["id"] == tech_id

    # 7. Verify deletion
    verify_resp = await client.get(f"/api/v1/technologies/{tech_id}", headers=headers)
    assert verify_resp.status_code == 404
