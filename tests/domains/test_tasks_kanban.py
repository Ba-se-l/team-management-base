"""Integration tests for Task domain, Kanban board workflows, and discussion comments."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import TaskPriority, TaskStatus, TeamRole, UserStatus
from src.modules.user.models import User
from src.security import hash_password


@pytest.fixture
async def setup_kanban_env(db_session: AsyncSession) -> dict[str, User]:
    """Sets up a team admin, a task creator/assignee developer, and another developer."""
    admin = User(
        name="Team Lead Admin",
        username="teamadmin",
        email="lead@kanban.io",
        hashed_password=hash_password("AdminPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev1 = User(
        name="Developer Alice",
        username="alice",
        email="alice@kanban.io",
        hashed_password=hash_password("AlicePass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev2 = User(
        name="Developer Bob",
        username="bob",
        email="bob@kanban.io",
        hashed_password=hash_password("BobPass123!"),
        is_active=True,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    db_session.add_all([admin, dev1, dev2])
    await db_session.commit()
    for u in (admin, dev1, dev2):
        await db_session.refresh(u)

    return {"admin": admin, "alice": dev1, "bob": dev2}


async def _get_auth_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    """Authenticates and returns authorization headers."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_create_task_in_project(
    client: AsyncClient,
    setup_kanban_env: dict[str, User],
) -> None:
    """Verifies creating a task within a project, auto-calculating position, and hydrating creator."""
    admin = setup_kanban_env["admin"]
    alice = setup_kanban_env["alice"]
    admin_headers = await _get_auth_headers(client, admin.email, "AdminPass123!")
    alice_headers = await _get_auth_headers(client, alice.email, "AlicePass123!")

    # 1. Admin creates team
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Core Platform", "description": "Platform engineering."},
        headers=admin_headers,
    )
    team_id = team_resp.json()["id"]

    # 2. Add Alice as DEVELOPER
    await client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": alice.id, "role": TeamRole.DEVELOPER.value},
        headers=admin_headers,
    )

    # 3. Create project
    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={"title": "Identity Engine", "short_description": "OAuth2 / OIDC server."},
        headers=admin_headers,
    )
    proj_id = proj_resp.json()["id"]

    # 4. Alice creates task in project
    task_payload = {
        "title": "Implement PKCE challenge validation",
        "description": "Enforce SHA256 code challenge verification.",
        "priority": TaskPriority.HIGH.value,
        "status": TaskStatus.TODO.value,
        "assignee_to_id": alice.id,
    }
    task_resp = await client.post(
        f"/api/v1/projects/{proj_id}/tasks",
        json=task_payload,
        headers=alice_headers,
    )
    assert task_resp.status_code == 201
    task_data = task_resp.json()

    assert task_data["title"] == "Implement PKCE challenge validation"
    assert task_data["project_id"] == proj_id
    assert task_data["priority"] == TaskPriority.HIGH.value
    assert task_data["status"] == TaskStatus.TODO.value
    assert task_data["creator_id"] == alice.id
    assert task_data["creator_username"] == alice.username
    assert task_data["assignee_to_id"] == alice.id
    assert task_data["assignee_username"] == alice.username
    assert task_data["completed_at"] is None
    assert task_data["position"] == 1000.0


@pytest.mark.asyncio
async def test_move_task_kanban_updates_status_and_completed_at(
    client: AsyncClient,
    setup_kanban_env: dict[str, User],
) -> None:
    """Verifies that drag-and-drop task movement updates position and auto-manages completed_at."""
    admin = setup_kanban_env["admin"]
    alice = setup_kanban_env["alice"]
    admin_headers = await _get_auth_headers(client, admin.email, "AdminPass123!")
    alice_headers = await _get_auth_headers(client, alice.email, "AlicePass123!")

    # Setup team, member, project, task
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Frontend Guild", "description": "UI guild."},
        headers=admin_headers,
    )
    team_id = team_resp.json()["id"]

    await client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": alice.id, "role": TeamRole.DEVELOPER.value},
        headers=admin_headers,
    )

    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={"title": "Dashboard UI", "short_description": "Metrics visualizer."},
        headers=admin_headers,
    )
    proj_id = proj_resp.json()["id"]

    task_resp = await client.post(
        f"/api/v1/projects/{proj_id}/tasks",
        json={"title": "Build Gantt chart component", "description": "Canvas rendering."},
        headers=alice_headers,
    )
    task_id = task_resp.json()["id"]

    # Move task to DONE
    move_done_resp = await client.patch(
        f"/api/v1/tasks/{task_id}/move",
        json={"status": TaskStatus.DONE.value, "position": 1.5},
        headers=alice_headers,
    )
    assert move_done_resp.status_code == 200
    done_data = move_done_resp.json()
    assert done_data["status"] == TaskStatus.DONE.value
    assert done_data["position"] == 1.5
    assert done_data["completed_at"] is not None

    # Move task back to IN_PROGRESS -> completed_at is reset to None
    move_progress_resp = await client.patch(
        f"/api/v1/tasks/{task_id}/move",
        json={"status": TaskStatus.IN_PROGRESS.value, "position": 2.0},
        headers=alice_headers,
    )
    assert move_progress_resp.status_code == 200
    progress_data = move_progress_resp.json()
    assert progress_data["status"] == TaskStatus.IN_PROGRESS.value
    assert progress_data["completed_at"] is None


@pytest.mark.asyncio
async def test_kanban_board_grouping(
    client: AsyncClient,
    setup_kanban_env: dict[str, User],
) -> None:
    """Verifies Kanban board returns tasks grouped into workflow columns."""
    admin = setup_kanban_env["admin"]
    admin_headers = await _get_auth_headers(client, admin.email, "AdminPass123!")

    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Kanban Lab", "description": "Lab team."},
        headers=admin_headers,
    )
    team_id = team_resp.json()["id"]

    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={"title": "Workflow Engine", "short_description": "State machine."},
        headers=admin_headers,
    )
    proj_id = proj_resp.json()["id"]

    # Create one task in TODO, one in IN_PROGRESS
    await client.post(
        f"/api/v1/projects/{proj_id}/tasks",
        json={"title": "Task 1", "description": "First task.", "status": TaskStatus.TODO.value},
        headers=admin_headers,
    )
    await client.post(
        f"/api/v1/projects/{proj_id}/tasks",
        json={"title": "Task 2", "description": "Second task.", "status": TaskStatus.IN_PROGRESS.value},
        headers=admin_headers,
    )

    # Get Kanban board
    board_resp = await client.get(
        f"/api/v1/projects/{proj_id}/tasks/kanban",
        headers=admin_headers,
    )
    assert board_resp.status_code == 200
    board_data = board_resp.json()

    assert board_data["project_id"] == proj_id
    columns = board_data["columns"]
    assert len(columns[TaskStatus.TODO.value]) == 1
    assert columns[TaskStatus.TODO.value][0]["title"] == "Task 1"
    assert len(columns[TaskStatus.IN_PROGRESS.value]) == 1
    assert columns[TaskStatus.IN_PROGRESS.value][0]["title"] == "Task 2"
    assert len(columns[TaskStatus.DONE.value]) == 0


@pytest.mark.asyncio
async def test_task_comments_lifecycle_and_permissions(
    client: AsyncClient,
    setup_kanban_env: dict[str, User],
) -> None:
    """Verifies adding comments, author deletion, and non-author rejection."""
    admin = setup_kanban_env["admin"]
    alice = setup_kanban_env["alice"]
    bob = setup_kanban_env["bob"]

    admin_headers = await _get_auth_headers(client, admin.email, "AdminPass123!")
    alice_headers = await _get_auth_headers(client, alice.email, "AlicePass123!")
    bob_headers = await _get_auth_headers(client, bob.email, "BobPass123!")

    # Team setup
    team_resp = await client.post(
        "/api/v1/teams",
        json={"name": "Collab Team", "description": "Collaboration squad."},
        headers=admin_headers,
    )
    team_id = team_resp.json()["id"]

    # Add Alice and Bob as DEVELOPERS
    await client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": alice.id, "role": TeamRole.DEVELOPER.value},
        headers=admin_headers,
    )
    await client.post(
        f"/api/v1/teams/{team_id}/members",
        json={"user_id": bob.id, "role": TeamRole.DEVELOPER.value},
        headers=admin_headers,
    )

    proj_resp = await client.post(
        f"/api/v1/teams/{team_id}/projects",
        json={"title": "Collaboration Hub", "short_description": "Chat app."},
        headers=admin_headers,
    )
    proj_id = proj_resp.json()["id"]

    task_resp = await client.post(
        f"/api/v1/projects/{proj_id}/tasks",
        json={"title": "Setup WebSockets", "description": "Realtime gateway."},
        headers=alice_headers,
    )
    task_id = task_resp.json()["id"]

    # Alice posts comment
    comm_resp = await client.post(
        f"/api/v1/tasks/{task_id}/comments",
        json={"content": "Initial WebSocket handshake implemented successfully."},
        headers=alice_headers,
    )
    assert comm_resp.status_code == 201
    comm_data = comm_resp.json()
    assert comm_data["author_id"] == alice.id
    assert comm_data["author_username"] == alice.username
    assert comm_data["content"] == "Initial WebSocket handshake implemented successfully."
    comment_id = comm_data["id"]

    # Bob (not author, not admin) tries to delete Alice's comment -> 403 Forbidden
    bob_del_resp = await client.delete(
        f"/api/v1/tasks/comments/{comment_id}",
        headers=bob_headers,
    )
    assert bob_del_resp.status_code == 403
    assert bob_del_resp.json()["error"]["code"] == "PERMISSION_DENIED"

    # Alice (author) deletes her comment -> 204 No Content
    alice_del_resp = await client.delete(
        f"/api/v1/tasks/comments/{comment_id}",
        headers=alice_headers,
    )
    assert alice_del_resp.status_code == 204
