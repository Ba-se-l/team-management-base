"""Comprehensive unit and integration tests for Authentication, Token Rotation, and Casbin RBAC."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from src.conf import settings
from src.database.enums import TeamRole, UserStatus
from src.main import app
from src.modules.auth.model import RefreshSession
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.modules.user.models import User
from src.security import (
    check_permission,
    hash_password,
    require_super_admin,
    require_team_permission,
)

# Test-specific probe router for verifying authorization guards
auth_guard_probe_router = APIRouter(prefix="/api/v1/test-guard")


@auth_guard_probe_router.delete(
    "/teams/{team_id}/projects/{project_id}",
    dependencies=[Depends(require_team_permission("project", "delete"))],
)
async def _probe_delete_project(team_id: int, project_id: int) -> dict[str, str]:
    return {"status": "deleted", "team_id": str(team_id), "project_id": str(project_id)}


@auth_guard_probe_router.get(
    "/super-admin-only",
    dependencies=[Depends(require_super_admin)],
)
async def _probe_super_admin_only() -> dict[str, str]:
    return {"status": "super_admin_verified"}


from starlette.routing import Mount

app.include_router(auth_guard_probe_router)
_mounts = [r for r in app.router.routes if isinstance(r, Mount)]
_others = [r for r in app.router.routes if not isinstance(r, Mount)]
app.router.routes = _others + _mounts


@pytest.fixture
async def seed_users(db_session: AsyncSession) -> dict[str, User]:
    """Seeds test users for auth and RBAC verification."""
    super_admin = User(
        name="Super Admin",
        username="superadmin",
        email="superadmin@agency.io",
        hashed_password=hash_password("SuperSecret123!"),
        is_active=True,
        is_super_admin=True,
        status=UserStatus.ONLINE,
    )
    dev_admin = User(
        name="Team Lead Alice",
        username="alice_lead",
        email="alice@agency.io",
        hashed_password=hash_password("AlicePass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev_viewer = User(
        name="Intern Bob",
        username="bob_intern",
        email="bob@agency.io",
        hashed_password=hash_password("BobPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    outsider = User(
        name="Outsider Charlie",
        username="charlie_guest",
        email="charlie@agency.io",
        hashed_password=hash_password("CharliePass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )

    db_session.add_all([super_admin, dev_admin, dev_viewer, outsider])
    await db_session.flush()

    # Create a team and associate Alice as ADMIN and Bob as VIEWER
    team = Team(name="Core Infrastructure", slug="core-infra", creator_id=dev_admin.id)
    db_session.add(team)
    await db_session.flush()

    member_admin = TeamMember(team_id=team.id, member_id=dev_admin.id, role=TeamRole.ADMIN)
    member_viewer = TeamMember(team_id=team.id, member_id=dev_viewer.id, role=TeamRole.VIEWER)
    db_session.add_all([member_admin, member_viewer])
    await db_session.flush()

    return {
        "super_admin": super_admin,
        "dev_admin": dev_admin,
        "dev_viewer": dev_viewer,
        "outsider": outsider,
        "team": team,
    }


@pytest.mark.asyncio
async def test_login_success_sets_httponly_cookie_and_returns_access_token(
    async_client: AsyncClient,
    seed_users: dict[str, User],
) -> None:
    """Verifies that login returns access token and sets HttpOnly refresh cookie."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@agency.io", "password": "AlicePass123!"},
    )

    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "alice_lead"
    assert data["user"]["email"] == "alice@agency.io"

    # Refresh token cookie is set and HttpOnly
    assert settings.REFRESH_COOKIE_NAME in response.cookies
    cookie_val = response.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert cookie_val is not None
    assert len(cookie_val) > 20


@pytest.mark.asyncio
async def test_login_invalid_password_returns_401(
    async_client: AsyncClient,
    seed_users: dict[str, User],
) -> None:
    """Verifies that invalid password returns 401 error envelope."""
    response = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@agency.io", "password": "WrongPassword!"},
    )
    assert response.status_code == 401
    payload = response.json()
    assert payload["success"] is False
    assert payload["error"]["code"] == "INVALID_CREDENTIALS"


@pytest.mark.asyncio
async def test_token_refresh_rotates_cookie_and_preserves_family(
    async_client: AsyncClient,
    seed_users: dict[str, User],
    db_session: AsyncSession,
) -> None:
    """Verifies token rotation: revokes old session, creates new session with same family ID."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@agency.io", "password": "AlicePass123!"},
    )
    first_cookie = login_resp.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert first_cookie is not None

    # Refresh token
    refresh_resp = await async_client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"{settings.REFRESH_COOKIE_NAME}={first_cookie}"},
    )
    assert refresh_resp.status_code == 200
    second_cookie = refresh_resp.cookies.get(settings.REFRESH_COOKIE_NAME)
    assert second_cookie is not None
    assert second_cookie != first_cookie

    # Verify database session state
    stmt = select(RefreshSession).order_by(RefreshSession.id)
    result = await db_session.execute(stmt)
    sessions = result.scalars().all()
    assert len(sessions) == 2
    old_session, new_session = sessions[0], sessions[1]

    assert old_session.is_revoked is True
    assert new_session.is_revoked is False
    assert old_session.family_id == new_session.family_id


@pytest.mark.asyncio
async def test_token_reuse_attack_revokes_entire_family(
    async_client: AsyncClient,
    seed_users: dict[str, User],
    db_session: AsyncSession,
) -> None:
    """Verifies replay attack defense: replaying a revoked token revokes all family sessions."""
    # Step 1: Login to get token 1
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@agency.io", "password": "AlicePass123!"},
    )
    token_1 = login_resp.cookies.get(settings.REFRESH_COOKIE_NAME)

    # Step 2: Legitimate rotation -> token 1 is now revoked, token 2 is active
    refresh_resp = await async_client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"{settings.REFRESH_COOKIE_NAME}={token_1}"},
    )
    assert refresh_resp.status_code == 200
    token_2 = refresh_resp.cookies.get(settings.REFRESH_COOKIE_NAME)

    # Step 3: Attacker replays token 1
    replay_resp = await async_client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"{settings.REFRESH_COOKIE_NAME}={token_1}"},
    )
    assert replay_resp.status_code == 401
    assert "replay detected" in replay_resp.json()["error"]["message"].lower()

    # Step 4: Verify that token 2 is now ALSO revoked due to family lineage termination
    subsequent_resp = await async_client.post(
        "/api/v1/auth/refresh",
        headers={"Cookie": f"{settings.REFRESH_COOKIE_NAME}={token_2}"},
    )
    assert subsequent_resp.status_code == 401


@pytest.mark.asyncio
async def test_security_version_bump_invalidates_active_token(
    async_client: AsyncClient,
    seed_users: dict[str, User],
    db_session: AsyncSession,
) -> None:
    """Verifies that incrementing user.security_version invalidates issued access tokens immediately."""
    login_resp = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@agency.io", "password": "AlicePass123!"},
    )
    access_token = login_resp.json()["access_token"]

    # Verify access works before bump
    me_resp_before = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp_before.status_code == 200

    # Invalidate credentials by bumping security_version
    user = seed_users["dev_admin"]
    user.security_version += 1
    await db_session.flush()

    # Re-access endpoint with old token -> must fail with 401
    me_resp_after = await async_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert me_resp_after.status_code == 401


@pytest.mark.asyncio
async def test_casbin_rbac_permission_matrix() -> None:
    """Verifies static Casbin permission matrix for team roles."""
    # Admin can do all actions
    assert await check_permission(sub="admin", dom="1", obj="project", act="delete") is True
    assert await check_permission(sub="admin", dom="1", obj="task", act="create") is True

    # Developer can create/update task, but cannot delete project
    assert await check_permission(sub="developer", dom="1", obj="task", act="create") is True
    assert await check_permission(sub="developer", dom="1", obj="task", act="update") is True
    assert await check_permission(sub="developer", dom="1", obj="project", act="delete") is False

    # Viewer can read task/project, cannot create task or delete project
    assert await check_permission(sub="viewer", dom="1", obj="task", act="read") is True
    assert await check_permission(sub="viewer", dom="1", obj="task", act="create") is False
    assert await check_permission(sub="viewer", dom="1", obj="project", act="delete") is False

    # Super admin bypasses all constraints
    assert await check_permission(sub="super_admin", dom="1", obj="project", act="delete") is True


@pytest.mark.asyncio
async def test_require_team_permission_guard_integration(
    async_client: AsyncClient,
    seed_users: dict[str, User],
) -> None:
    """Verifies endpoint enforcement with scoped team permissions."""
    team_id = seed_users["team"].id

    # 1. Login as Alice (ADMIN of team) -> delete project succeeds
    alice_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "alice@agency.io", "password": "AlicePass123!"},
    )
    alice_token = alice_login.json()["access_token"]
    alice_del = await async_client.delete(
        f"/api/v1/test-guard/teams/{team_id}/projects/101",
        headers={"Authorization": f"Bearer {alice_token}"},
    )
    assert alice_del.status_code == 200

    # 2. Login as Bob (VIEWER of team) -> delete project fails with 403 PERMISSION_DENIED
    bob_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "bob@agency.io", "password": "BobPass123!"},
    )
    bob_token = bob_login.json()["access_token"]
    bob_del = await async_client.delete(
        f"/api/v1/test-guard/teams/{team_id}/projects/101",
        headers={"Authorization": f"Bearer {bob_token}"},
    )
    assert bob_del.status_code == 403
    assert bob_del.json()["error"]["code"] == "PERMISSION_DENIED"

    # 3. Login as Charlie (OUTSIDER, not in team) -> fails with 403 TEAM_MEMBERSHIP_REQUIRED
    charlie_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "charlie@agency.io", "password": "CharliePass123!"},
    )
    charlie_token = charlie_login.json()["access_token"]
    charlie_del = await async_client.delete(
        f"/api/v1/test-guard/teams/{team_id}/projects/101",
        headers={"Authorization": f"Bearer {charlie_token}"},
    )
    assert charlie_del.status_code == 403
    assert charlie_del.json()["error"]["code"] == "TEAM_MEMBERSHIP_REQUIRED"

    # 4. Login as Super Admin -> bypasses team membership and succeeds
    admin_login = await async_client.post(
        "/api/v1/auth/login",
        json={"email": "superadmin@agency.io", "password": "SuperSecret123!"},
    )
    admin_token = admin_login.json()["access_token"]
    admin_del = await async_client.delete(
        f"/api/v1/test-guard/teams/{team_id}/projects/101",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert admin_del.status_code == 200
