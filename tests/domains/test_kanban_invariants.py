"""Domain invariant tests for Kanban board positioning and concurrent team administration."""

import asyncio
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import ProjectStatus, ProjectVisibility, TaskPriority, TaskStatus, TeamRole, UserStatus
from src.modules.project.models import Project
from src.modules.task.models import Task
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.modules.user.models import User
from src.security import hash_password


async def _login_and_get_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    """Authenticates and returns the Bearer Authorization header dictionary."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert resp.status_code == 200, f"Login failed for {email}: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def setup_kanban_invariants_env(db_session: AsyncSession) -> dict[str, User | Team | Project]:
    """Sets up a team, project, and users for invariant verification."""
    password_hash = hash_password("InvariantsPass123!")

    admin_user = User(
        email="admin@kanban-inv.io",
        username="admin_inv",
        name="Admin Inv",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev_user = User(
        email="dev@kanban-inv.io",
        username="dev_inv",
        name="Dev Inv",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    admin_two = User(
        email="admin2@kanban-inv.io",
        username="admin2_inv",
        name="Admin Two Inv",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    db_session.add_all([admin_user, dev_user, admin_two])
    await db_session.flush()

    team = Team(name="Kanban Inv Team", slug="kanban-inv-team", creator_id=admin_user.id)
    db_session.add(team)
    await db_session.flush()

    tm_admin = TeamMember(team_id=team.id, member_id=admin_user.id, role=TeamRole.ADMIN, is_active=True)
    tm_dev = TeamMember(team_id=team.id, member_id=dev_user.id, role=TeamRole.DEVELOPER, is_active=True)
    tm_admin2 = TeamMember(team_id=team.id, member_id=admin_two.id, role=TeamRole.ADMIN, is_active=True)
    db_session.add_all([tm_admin, tm_dev, tm_admin2])
    await db_session.flush()

    project = Project(
        title="Kanban Invariant Project",
        slug="kanban-inv-project",
        short_description="Kanban invariant tracking project",
        team_id=team.id,
        creator_id=admin_user.id,
        status=ProjectStatus.IN_PROGRESS,
        visibility=ProjectVisibility.PRIVATE,
    )
    db_session.add(project)
    await db_session.commit()

    return {
        "admin": admin_user,
        "dev": dev_user,
        "admin2": admin_two,
        "team": team,
        "project": project,
    }


@pytest.mark.asyncio
async def test_kanban_positioning_and_shifting_invariants(
    client: AsyncClient,
    setup_kanban_invariants_env: dict[str, User | Team | Project],
    db_session: AsyncSession,
) -> None:
    """Verifies atomic position shifting and uniqueness across repeated drag-and-drop operations."""
    admin_headers = await _login_and_get_headers(client, "admin@kanban-inv.io", "InvariantsPass123!")
    project = setup_kanban_invariants_env["project"]

    # 1. Create 3 tasks in TODO status
    task_ids = []
    for i in range(1, 4):
        create_resp = await client.post(
            f"/api/v1/projects/{project.id}/tasks",
            headers=admin_headers,
            json={
                "title": f"Task {i}",
                "description": f"Description {i}",
                "status": "todo",
                "priority": "medium",
                "position": float(i * 1000),
            },
        )
        assert create_resp.status_code == 201
        task_ids.append(create_resp.json()["id"])

    # 2. Reorder: Move Task 3 between Task 1 and Task 2 (target position 1500.0)
    move_resp1 = await client.patch(
        f"/api/v1/tasks/{task_ids[2]}/move",
        headers=admin_headers,
        json={"status": "todo", "position": 1500.0},
    )
    assert move_resp1.status_code == 200

    # Query all tasks and assert no duplicate positions exist
    res = await db_session.execute(
        select(Task).where(Task.project_id == project.id, Task.status == TaskStatus.TODO)
    )
    tasks = list(res.scalars().all())
    positions = [t.position for t in tasks]
    assert len(positions) == len(set(positions)), f"Duplicate positions detected: {positions}"

    # 3. Cross-column transition: Move Task 1 to DONE (completed_at must be populated)
    move_done = await client.patch(
        f"/api/v1/tasks/{task_ids[0]}/move",
        headers=admin_headers,
        json={"status": "done", "position": 1000.0},
    )
    assert move_done.status_code == 200
    task_done_data = move_done.json()
    assert task_done_data["status"] == "done"
    assert task_done_data["completed_at"] is not None

    # 4. Move Task 1 back to IN_PROGRESS (completed_at must revert to None)
    move_back = await client.patch(
        f"/api/v1/tasks/{task_ids[0]}/move",
        headers=admin_headers,
        json={"status": "in_progress", "position": 1000.0},
    )
    assert move_back.status_code == 200
    assert move_back.json()["completed_at"] is None


@pytest.mark.asyncio
async def test_last_admin_protection_and_concurrency(
    client: AsyncClient,
    setup_kanban_invariants_env: dict[str, User | Team | Project],
    db_session: AsyncSession,
) -> None:
    """Verifies that the sole administrator cannot be removed, and concurrent demotions cannot leave 0 admins."""
    admin1_headers = await _login_and_get_headers(client, "admin@kanban-inv.io", "InvariantsPass123!")
    admin2_headers = await _login_and_get_headers(client, "admin2@kanban-inv.io", "InvariantsPass123!")
    team = setup_kanban_invariants_env["team"]
    admin1 = setup_kanban_invariants_env["admin"]
    admin2 = setup_kanban_invariants_env["admin2"]

    # Concurrently attempt to demote both admins to DEVELOPER
    req1 = client.patch(
        f"/api/v1/teams/{team.id}/members/{admin1.id}",
        headers=admin1_headers,
        json={"role": "developer"},
    )
    req2 = client.patch(
        f"/api/v1/teams/{team.id}/members/{admin2.id}",
        headers=admin2_headers,
        json={"role": "developer"},
    )

    resp1, resp2 = await asyncio.gather(req1, req2)

    statuses = [resp1.status_code, resp2.status_code]
    assert 200 in statuses or 422 in statuses

    # Refresh session to see committed changes from client connections
    await db_session.rollback()

    # Confirm from database that the team NEVER has 0 administrators
    res = await db_session.execute(
        select(TeamMember).where(
            TeamMember.team_id == team.id,
            TeamMember.role == TeamRole.ADMIN,
            TeamMember.is_active == True,
        )
    )
    remaining_admins = list(res.scalars().all())
    assert len(remaining_admins) >= 1, "Concurrency violation: Team was left with 0 administrators!"

    # Now if one admin remains, attempt removal directly -> must fail with HTTP 422
    if len(remaining_admins) == 1:
        sole_admin = remaining_admins[0]
        sole_headers = admin1_headers if sole_admin.member_id == admin1.id else admin2_headers
        sole_removal = await client.delete(
            f"/api/v1/teams/{team.id}/members/{sole_admin.member_id}",
            headers=sole_headers,
        )
        assert sole_removal.status_code == 422
        assert sole_removal.json()["error"]["code"] == "LAST_ADMIN_CANNOT_BE_REMOVED"
