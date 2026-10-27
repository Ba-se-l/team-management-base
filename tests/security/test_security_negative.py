"""Negative penetration and invariant enforcement test suite for security hardening."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import ProjectStatus, ProjectVisibility, TaskPriority, TaskStatus, TeamRole, UserStatus
from src.modules.inquiry.models import ServiceInquiry
from src.modules.project.models import Project
from src.modules.task.models import Task
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.modules.user.models import User
from src.security import hash_password
from src.share.rate_limit import RateLimiter


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
async def setup_security_matrix(db_session: AsyncSession) -> dict[str, User | Team | Project]:
    """Sets up a multi-tenant environment with two isolated teams, projects, and users."""
    password_hash = hash_password("SecurePass123!")

    # Super Admin
    super_admin = User(
        email="superadmin@matrix.io",
        username="superadmin",
        name="Super Admin",
        hashed_password=password_hash,
        is_super_admin=True,
        status=UserStatus.ONLINE,
    )
    db_session.add(super_admin)

    # Team Alpha Members
    admin_alpha = User(
        email="admin_alpha@matrix.io",
        username="adminalpha",
        name="Admin Alpha",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev_alice = User(
        email="alice@matrix.io",
        username="alice",
        name="Alice Dev",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    dev_bob = User(
        email="bob@matrix.io",
        username="bob",
        name="Bob Dev",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    db_session.add_all([admin_alpha, dev_alice, dev_bob])

    # Team Beta Member (Outsider)
    dev_outsider = User(
        email="outsider@matrix.io",
        username="outsider",
        name="Outsider Dev",
        hashed_password=password_hash,
        is_super_admin=False,
        status=UserStatus.ONLINE,
    )
    db_session.add(dev_outsider)
    await db_session.flush()

    # Teams
    team_alpha = Team(name="Team Alpha", slug="team-alpha", creator_id=admin_alpha.id)
    team_beta = Team(name="Team Beta", slug="team-beta", creator_id=dev_outsider.id)
    db_session.add_all([team_alpha, team_beta])
    await db_session.flush()

    # Team Memberships
    tm_admin_a = TeamMember(team_id=team_alpha.id, member_id=admin_alpha.id, role=TeamRole.ADMIN, is_active=True)
    tm_alice = TeamMember(team_id=team_alpha.id, member_id=dev_alice.id, role=TeamRole.DEVELOPER, is_active=True)
    tm_bob = TeamMember(team_id=team_alpha.id, member_id=dev_bob.id, role=TeamRole.DEVELOPER, is_active=True)
    tm_outsider = TeamMember(team_id=team_beta.id, member_id=dev_outsider.id, role=TeamRole.ADMIN, is_active=True)
    db_session.add_all([tm_admin_a, tm_alice, tm_bob, tm_outsider])
    await db_session.flush()

    # Projects
    proj_alpha = Project(
        title="Alpha Core System",
        slug="alpha-core",
        short_description="Core infrastructure pod",
        team_id=team_alpha.id,
        creator_id=admin_alpha.id,
        status=ProjectStatus.IN_PROGRESS,
        visibility=ProjectVisibility.PRIVATE,
    )
    proj_beta = Project(
        title="Beta Secret System",
        slug="beta-secret",
        short_description="Secret R&D pod",
        team_id=team_beta.id,
        creator_id=dev_outsider.id,
        status=ProjectStatus.PLANNING,
        visibility=ProjectVisibility.PRIVATE,
    )
    db_session.add_all([proj_alpha, proj_beta])
    await db_session.flush()

    # Tasks in Project Alpha
    task_bob = Task(
        title="Bob Feature Task",
        description="Assigned strictly to Bob",
        project_id=proj_alpha.id,
        creator_id=admin_alpha.id,
        assignee_to_id=dev_bob.id,
        status=TaskStatus.TODO,
        priority=TaskPriority.HIGH,
        position=1000.0,
    )
    task_alice = Task(
        title="Alice Feature Task",
        description="Assigned strictly to Alice",
        project_id=proj_alpha.id,
        creator_id=admin_alpha.id,
        assignee_to_id=dev_alice.id,
        status=TaskStatus.IN_PROGRESS,
        priority=TaskPriority.MEDIUM,
        position=1000.0,
    )
    db_session.add_all([task_bob, task_alice])
    await db_session.commit()

    return {
        "super_admin": super_admin,
        "admin_alpha": admin_alpha,
        "dev_alice": dev_alice,
        "dev_bob": dev_bob,
        "dev_outsider": dev_outsider,
        "team_alpha": team_alpha,
        "team_beta": team_beta,
        "proj_alpha": proj_alpha,
        "proj_beta": proj_beta,
        "task_bob": task_bob,
        "task_alice": task_alice,
    }


@pytest.mark.parametrize(
    "email, expected_slugs, forbidden_slugs",
    [
        ("alice@matrix.io", ["alpha-core"], ["beta-secret"]),
        ("outsider@matrix.io", ["beta-secret"], ["alpha-core"]),
        ("superadmin@matrix.io", ["alpha-core", "beta-secret"], []),
    ],
    ids=["alice_team_alpha_scoped", "outsider_team_beta_scoped", "superadmin_unrestricted"],
)
@pytest.mark.asyncio
async def test_cross_team_project_isolation(
    client: AsyncClient,
    setup_security_matrix: dict[str, User | Team | Project],
    email: str,
    expected_slugs: list[str],
    forbidden_slugs: list[str],
) -> None:
    """Verifies that non-super-admins cannot view projects belonging to teams they do not belong to."""
    headers = await _login_and_get_headers(client, email, "SecurePass123!")
    resp = await client.get("/api/v1/projects", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    slugs = [p["slug"] for p in items]
    for s in expected_slugs:
        assert s in slugs
    for s in forbidden_slugs:
        assert s not in slugs


@pytest.mark.asyncio
async def test_anonymous_project_listing_rejected(client: AsyncClient) -> None:
    """Verifies unauthenticated access to projects is rejected with HTTP 401."""
    unauth_resp = await client.get("/api/v1/projects")
    assert unauth_resp.status_code == 401


@pytest.mark.asyncio
async def test_assignee_not_in_team_rejected(
    client: AsyncClient,
    setup_security_matrix: dict[str, User | Team | Project],
) -> None:
    """Verifies that assigning a task to a user who does not belong to the project team is rejected with HTTP 422."""
    admin_headers = await _login_and_get_headers(client, "admin_alpha@matrix.io", "SecurePass123!")
    proj_alpha = setup_security_matrix["proj_alpha"]
    outsider = setup_security_matrix["dev_outsider"]

    resp = await client.post(
        f"/api/v1/projects/{proj_alpha.id}/tasks",
        headers=admin_headers,
        json={
            "title": "Malicious Assignment Task",
            "description": "Attempting cross-team assignment",
            "status": "todo",
            "priority": "low",
            "assignee_to_id": outsider.id,
        },
    )
    assert resp.status_code == 422
    data = resp.json()
    assert data["error"]["code"] == "ASSIGNEE_NOT_IN_TEAM"


@pytest.mark.asyncio
async def test_developer_task_ownership_enforcement(
    client: AsyncClient,
    setup_security_matrix: dict[str, User | Team | Project],
) -> None:
    """Verifies that developers cannot move or modify tasks belonging to other team members."""
    alice_headers = await _login_and_get_headers(client, "alice@matrix.io", "SecurePass123!")
    bob_headers = await _login_and_get_headers(client, "bob@matrix.io", "SecurePass123!")
    admin_headers = await _login_and_get_headers(client, "admin_alpha@matrix.io", "SecurePass123!")

    task_bob = setup_security_matrix["task_bob"]

    # 1. Alice attempts to move Bob's task -> HTTP 403 TASK_OWNERSHIP_REQUIRED
    move_resp = await client.patch(
        f"/api/v1/tasks/{task_bob.id}/move",
        headers=alice_headers,
        json={"status": "in_progress", "position": 2000.0},
    )
    assert move_resp.status_code == 403
    assert move_resp.json()["error"]["code"] == "TASK_OWNERSHIP_REQUIRED"

    # 2. Alice attempts to update Bob's task -> HTTP 403 TASK_OWNERSHIP_REQUIRED
    update_resp = await client.patch(
        f"/api/v1/tasks/{task_bob.id}",
        headers=alice_headers,
        json={"title": "Hacked Title by Alice"},
    )
    assert update_resp.status_code == 403
    assert update_resp.json()["error"]["code"] == "TASK_OWNERSHIP_REQUIRED"

    # 3. Bob moves his own task -> HTTP 200 OK
    bob_move = await client.patch(
        f"/api/v1/tasks/{task_bob.id}/move",
        headers=bob_headers,
        json={"status": "in_progress", "position": 2000.0},
    )
    assert bob_move.status_code == 200
    assert bob_move.json()["status"] == "in_progress"

    # 4. Admin moves Bob's task -> HTTP 200 OK
    admin_move = await client.patch(
        f"/api/v1/tasks/{task_bob.id}/move",
        headers=admin_headers,
        json={"status": "done", "position": 3000.0},
    )
    assert admin_move.status_code == 200
    assert admin_move.json()["status"] == "done"


@pytest.mark.asyncio
async def test_public_registration_disabled(client: AsyncClient) -> None:
    """Verifies that open public registration is blocked with HTTP 403 REGISTRATION_DISABLED."""
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "infiltrator@spam.com",
            "username": "infiltrator",
            "password": "Password123!",
        },
    )
    assert resp.status_code == 403
    data = resp.json()
    assert data["error"]["code"] == "REGISTRATION_DISABLED"


@pytest.mark.asyncio
async def test_login_rate_limiting_enforcement(client: AsyncClient) -> None:
    """Verifies that consecutive login attempts are rate limited after 5 tries with HTTP 429."""
    RateLimiter.reset_all()

    # Execute 5 allowed login requests
    for _ in range(5):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "nonexistent@matrix.io", "password": "WrongPassword123!"},
        )
        assert resp.status_code == 401

    # 6th attempt must trigger HTTP 429 Rate Limit Exceeded
    blocked_resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "nonexistent@matrix.io", "password": "WrongPassword123!"},
    )
    assert blocked_resp.status_code == 429
    data = blocked_resp.json()
    assert data["error"]["code"] == "RATE_LIMIT_EXCEEDED"

    RateLimiter.reset_all()


@pytest.mark.asyncio
async def test_inquiry_honeypot_bot_defense(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Verifies that inquiries triggering the honeypot are dropped without persisting to the database."""
    RateLimiter.reset_all()

    payload = {
        "client_name": "Spam Bot",
        "client_email": "bot@automated-crawler.com",
        "company_name": "Bot Syndicate",
        "service_type": "web_app",
        "budget_range": "10k-25k",
        "message": "Visit our website for crypto schemes",
        "honeypot": "https://malicious-bot-link.com",
    }

    resp = await client.post("/api/v1/public/inquiries", json=payload)
    assert resp.status_code == 201
    data = resp.json()
    # Generates a realistic positive ID to fool the bot
    assert data["id"] > 0

    # Verify directly against database that zero inquiries were saved
    result = await db_session.execute(
        select(ServiceInquiry).where(ServiceInquiry.client_email == "bot@automated-crawler.com")
    )
    inquiry_record = result.scalar_one_or_none()
    assert inquiry_record is None


@pytest.mark.asyncio
async def test_developer_my_tasks_and_dashboard(
    client: AsyncClient,
    setup_security_matrix: dict[str, User | Team | Project],
) -> None:
    """Verifies the developer personal tasks listing and performance dashboard."""
    alice_headers = await _login_and_get_headers(client, "alice@matrix.io", "SecurePass123!")

    # 1. Fetch personal tasks
    my_tasks_resp = await client.get("/api/v1/tasks/my", headers=alice_headers)
    assert my_tasks_resp.status_code == 200
    my_tasks = my_tasks_resp.json()["items"]
    assert len(my_tasks) == 1
    assert my_tasks[0]["title"] == "Alice Feature Task"

    # 2. Fetch developer dashboard
    dash_resp = await client.get("/api/v1/users/me/dashboard", headers=alice_headers)
    assert dash_resp.status_code == 200
    dash_data = dash_resp.json()
    assert dash_data["active_teams_count"] == 1
    assert dash_data["active_projects_count"] == 1
    assert dash_data["in_progress_tasks"] == 1
    assert dash_data["pending_tasks"] == 0
