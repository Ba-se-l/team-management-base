"""Integration tests for Team and Team Members domain operations and business invariants."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import TeamRole, UserStatus
from src.modules.user.models import User
from src.security import hash_password


@pytest.fixture
async def setup_users(db_session: AsyncSession) -> dict[str, User]:
    """Sets up test users with distinct roles."""
    admin_user = User(
        name="Team Admin One",
        username="teamadmin1",
        email="admin1@agency.io",
        hashed_password=hash_password("AdminPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev_user = User(
        name="Developer One",
        username="devone",
        email="dev1@agency.io",
        hashed_password=hash_password("DevPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    viewer_user = User(
        name="Viewer One",
        username="viewerone",
        email="viewer1@agency.io",
        hashed_password=hash_password("ViewerPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    db_session.add_all([admin_user, dev_user, viewer_user])
    await db_session.commit()
    for u in (admin_user, dev_user, viewer_user):
        await db_session.refresh(u)

    return {"admin": admin_user, "dev": dev_user, "viewer": viewer_user}


async def _get_auth_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    """Performs login and returns authorization headers."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_team_auto_enrolls_admin(
    client: AsyncClient,
    setup_users: dict[str, User],
) -> None:
    """Verifies team creation creates team, auto-slugifies, and enrolls creator as ADMIN."""
    admin = setup_users["admin"]
    headers = await _get_auth_headers(client, admin.email, "AdminPass123!")

    create_payload = {
        "name": "Backend Engineering Team",
        "description": "Core backend and infrastructure team.",
    }
    resp = await client.post("/api/v1/teams", json=create_payload, headers=headers)
    assert resp.status_code == 201
    data = resp.json()

    assert data["name"] == "Backend Engineering Team"
    assert data["slug"] == "backend-engineering-team"
    assert data["members_count"] == 1
    team_id = data["id"]

    # Verify members list confirms creator is ADMIN
    members_resp = await client.get(f"/api/v1/teams/{team_id}/members", headers=headers)
    assert members_resp.status_code == 200
    members = members_resp.json()["items"]
    assert len(members) == 1
    assert members[0]["member_id"] == admin.id
    assert members[0]["role"] == TeamRole.ADMIN.value


@pytest.mark.asyncio
async def test_team_slug_lookup_and_metrics(
    client: AsyncClient,
    setup_users: dict[str, User],
) -> None:
    """Verifies team can be queried by slug string and includes metrics."""
    admin = setup_users["admin"]
    headers = await _get_auth_headers(client, admin.email, "AdminPass123!")

    # Create team
    create_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Frontend Guild", "description": "UI/UX and web guild."},
        headers=headers,
    )
    assert create_resp.status_code == 201
    slug = create_resp.json()["slug"]

    # Query by slug
    get_resp = await client.get(f"/api/v1/teams/{slug}", headers=headers)
    assert get_resp.status_code == 200
    team_data = get_resp.json()
    assert team_data["slug"] == slug
    assert team_data["name"] == "Frontend Guild"
    assert team_data["members_count"] == 1


@pytest.mark.asyncio
async def test_add_and_update_member_role(
    client: AsyncClient,
    setup_users: dict[str, User],
) -> None:
    """Verifies adding a team member and modifying their role."""
    admin = setup_users["admin"]
    dev = setup_users["dev"]
    admin_headers = await _get_auth_headers(client, admin.email, "AdminPass123!")

    # Create team
    create_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Mobile Squad", "description": "iOS and Android squad."},
        headers=admin_headers,
    )
    team_id = create_resp.json()["id"]

    # Add dev as DEVELOPER
    add_resp = await client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": dev.id, "role": TeamRole.DEVELOPER.value},
        headers=admin_headers,
    )
    assert add_resp.status_code == 201
    assert add_resp.json()["member_id"] == dev.id
    assert add_resp.json()["role"] == TeamRole.DEVELOPER.value

    # Update dev role to VIEWER
    patch_resp = await client.patch(
        f"/api/v1/teams/{team_id}/members/{dev.id}",
        json={"role": TeamRole.VIEWER.value},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["role"] == TeamRole.VIEWER.value


@pytest.mark.asyncio
async def test_sole_admin_cannot_be_demoted_or_removed(
    client: AsyncClient,
    setup_users: dict[str, User],
) -> None:
    """Enforces business rule invariant: the last active administrator cannot be demoted or removed."""
    admin = setup_users["admin"]
    headers = await _get_auth_headers(client, admin.email, "AdminPass123!")

    # Create team with sole admin
    create_resp = await client.post(
        "/api/v1/teams",
        json={"name": "DevOps Division", "description": "Infrastructure division."},
        headers=headers,
    )
    team_id = create_resp.json()["id"]

    # Attempt to demote sole admin to DEVELOPER -> must fail with 422 BusinessRuleViolation
    demote_resp = await client.patch(
        f"/api/v1/teams/{team_id}/members/{admin.id}",
        json={"role": TeamRole.DEVELOPER.value},
        headers=headers,
    )
    assert demote_resp.status_code == 422
    error_body = demote_resp.json()
    assert error_body["error"]["code"] == "LAST_ADMIN_CANNOT_BE_REMOVED"

    # Attempt to remove sole admin -> must fail with 422 BusinessRuleViolation
    delete_resp = await client.delete(
        f"/api/v1/teams/{team_id}/members/{admin.id}",
        headers=headers,
    )
    assert delete_resp.status_code == 422
    error_body = delete_resp.json()
    assert error_body["error"]["code"] == "LAST_ADMIN_CANNOT_BE_REMOVED"


@pytest.mark.asyncio
async def test_non_member_cannot_access_team(
    client: AsyncClient,
    setup_users: dict[str, User],
) -> None:
    """Verifies that non-members cannot query or tamper with team resources."""
    admin = setup_users["admin"]
    viewer = setup_users["viewer"]

    admin_headers = await _get_auth_headers(client, admin.email, "AdminPass123!")
    viewer_headers = await _get_auth_headers(client, viewer.email, "ViewerPass123!")

    # Admin creates team
    create_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Confidential R&D", "description": "Stealth projects."},
        headers=admin_headers,
    )
    team_id = create_resp.json()["id"]

    # Viewer (not in team) tries to fetch members -> returns 403 Forbidden
    resp = await client.get(f"/api/v1/teams/{team_id}/members", headers=viewer_headers)
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "TEAM_MEMBERSHIP_REQUIRED"
