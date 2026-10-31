"""Integration tests for Project domain operations, technology bindings, and Casbin access."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import ProjectStatus, ProjectVisibility, UserStatus
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.security import hash_password


@pytest.fixture
async def setup_project_env(db_session: AsyncSession) -> dict[str, object]:
    """Sets up an admin user and reusable technologies."""
    admin_user = User(
        name="Project Lead",
        username="projectlead",
        email="lead@agency.io",
        hashed_password=hash_password("LeadPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    python_tech = Technology(name="Python", slug="python", category="language")
    fastapi_tech = Technology(name="FastAPI", slug="fastapi", category="backend")
    react_tech = Technology(name="React", slug="react", category="frontend")

    db_session.add_all([admin_user, python_tech, fastapi_tech, react_tech])
    await db_session.commit()
    for obj in (admin_user, python_tech, fastapi_tech, react_tech):
        await db_session.refresh(obj)

    return {
        "admin": admin_user,
        "python": python_tech,
        "fastapi": fastapi_tech,
        "react": react_tech,
    }


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
async def test_create_project_with_technologies(
    client: AsyncClient,
    setup_project_env: dict[str, object],
) -> None:
    """Verifies creating a project in a team workspace with M2M technology bindings."""
    admin = setup_project_env["admin"]
    python_tech = setup_project_env["python"]
    fastapi_tech = setup_project_env["fastapi"]
    headers = await _get_auth_headers(client, admin.email, "LeadPass123!")

    # 1. Create team
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Cloud Native Guild", "description": "Microservices guild."},
        headers=headers,
    )
    assert team_resp.status_code == 201
    team_id = team_resp.json()["id"]

    # 2. Create project
    proj_payload = {
        "title": "FinTech Payment Gateway",
        "short_description": "High-throughput async payment processing service.",
        "description": "Full architectural description of the gateway.",
        "status": ProjectStatus.PLANNING.value,
        "visibility": ProjectVisibility.PRIVATE.value,
        "technology_ids": [python_tech.id, fastapi_tech.id],
    }
    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json=proj_payload,
        headers=headers,
    )
    assert proj_resp.status_code == 201
    proj_data = proj_resp.json()

    assert proj_data["title"] == "FinTech Payment Gateway"
    assert proj_data["slug"] == "fintech-payment-gateway"
    assert proj_data["team_id"] == team_id
    assert proj_data["status"] == ProjectStatus.PLANNING.value
    assert proj_data["visibility"] == ProjectVisibility.PRIVATE.value
    assert len(proj_data["technologies"]) == 2
    tech_names = {t["name"] for t in proj_data["technologies"]}
    assert tech_names == {"Python", "FastAPI"}


@pytest.mark.asyncio
async def test_create_project_with_invalid_technologies_fails(
    client: AsyncClient,
    setup_project_env: dict[str, object],
) -> None:
    """Verifies that referencing a non-existent technology ID rejects project creation with 404."""
    admin = setup_project_env["admin"]
    headers = await _get_auth_headers(client, admin.email, "LeadPass123!")

    # Create team
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "QA Guild", "description": "Quality assurance squad."},
        headers=headers,
    )
    team_id = team_resp.json()["id"]

    # Attempt to create project with invalid technology ID 99999
    proj_payload = {
        "title": "Invalid Tech Project",
        "short_description": "Valid short description for testing tech validation.",
        "technology_ids": [99999],
    }
    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json=proj_payload,
        headers=headers,
    )
    assert proj_resp.status_code == 404
    error_body = proj_resp.json()
    assert error_body["error"]["code"] == "TECHNOLOGY_NOT_FOUND"


@pytest.mark.asyncio
async def test_project_slug_lookup_and_task_metrics(
    client: AsyncClient,
    setup_project_env: dict[str, object],
) -> None:
    """Verifies querying project by slug string and checking task metrics."""
    admin = setup_project_env["admin"]
    headers = await _get_auth_headers(client, admin.email, "LeadPass123!")

    # Create team
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Web Squad", "description": "Full-stack apps squad."},
        headers=headers,
    )
    team_id = team_resp.json()["id"]

    # Create project
    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={"title": "Client Portal", "short_description": "Agency client workspace."},
        headers=headers,
    )
    assert proj_resp.status_code == 201
    slug = proj_resp.json()["slug"]

    # Query project by slug
    get_resp = await client.get(f"/api/v1/projects/{slug}", headers=headers)
    assert get_resp.status_code == 200
    proj_data = get_resp.json()
    assert proj_data["slug"] == slug
    assert proj_data["tasks_count"] == 0
    assert proj_data["tasks_completed_count"] == 0


@pytest.mark.asyncio
async def test_update_project_and_filters(
    client: AsyncClient,
    setup_project_env: dict[str, object],
) -> None:
    """Verifies updating project attributes and querying with status and visibility filters."""
    admin = setup_project_env["admin"]
    headers = await _get_auth_headers(client, admin.email, "LeadPass123!")

    # Create team
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Enterprise Core", "description": "Enterprise products."},
        headers=headers,
    )
    team_id = team_resp.json()["id"]

    # Create project in PLANNING
    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={
            "title": "ERP System",
            "short_description": "Internal enterprise resource planner.",
            "status": ProjectStatus.PLANNING.value,
            "visibility": ProjectVisibility.PRIVATE.value,
        },
        headers=headers,
    )
    assert proj_resp.status_code == 201
    proj_id = proj_resp.json()["id"]

    # Update project to ACTIVE and PENDING_REVIEW (Team Admin can request review; Super Admin publishes)
    patch_resp = await client.patch(
        f"/api/v1/projects/{proj_id}",
        json={
            "status": ProjectStatus.ACTIVE.value,
            "visibility": ProjectVisibility.PENDING_REVIEW.value,
        },
        headers=headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == ProjectStatus.ACTIVE.value
    assert patch_resp.json()["visibility"] == ProjectVisibility.PENDING_REVIEW.value

    # Filter team projects by status=active
    filter_resp = await client.get(
        f"/api/v1/teams/{team_id}/projects?status=active",
        headers=headers,
    )
    assert filter_resp.status_code == 200
    items = filter_resp.json()["items"]
    assert len(items) == 1
    assert items[0]["id"] == proj_id


@pytest.mark.asyncio
async def test_delete_project(
    client: AsyncClient,
    setup_project_env: dict[str, object],
) -> None:
    """Verifies deleting project and confirming 404 on subsequent queries."""
    admin = setup_project_env["admin"]
    headers = await _get_auth_headers(client, admin.email, "LeadPass123!")

    # Create team
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Temporary Squad", "description": "Temp team."},
        headers=headers,
    )
    team_id = team_resp.json()["id"]

    # Create project
    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={"title": "Short Lived Project", "short_description": "Disposable project."},
        headers=headers,
    )
    assert proj_resp.status_code == 201
    proj_id = proj_resp.json()["id"]

    # Delete project
    del_resp = await client.delete(f"/api/v1/projects/{proj_id}", headers=headers)
    assert del_resp.status_code == 204

    # Subsequent GET returns 404
    get_resp = await client.get(f"/api/v1/projects/{proj_id}", headers=headers)
    assert get_resp.status_code == 404
