"""Integration tests for Public Showcase, Inquiries, Honeypot defense, and Audit Logs."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import InquiryServiceType, InquiryStatus, ProjectStatus, ProjectVisibility, UserStatus
from src.modules.inquiry.models import ServiceInquiry
from src.modules.project.models import Project
from src.modules.team.models import Team
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.security import hash_password


@pytest.fixture
async def setup_showcase_env(db_session: AsyncSession) -> dict[str, object]:
    """Sets up super admin, regular developer, public projects, and tech."""
    super_admin = User(
        name="Platform Admin",
        username="platform_admin",
        email="root@agency.io",
        hashed_password=hash_password("RootAdmin2026!"),
        is_super_admin=True,
        is_active=True,
        is_public_member=True,
        status=UserStatus.ONLINE,
    )
    regular_user = User(
        name="Junior Dev",
        username="junior_dev",
        email="junior@agency.io",
        hashed_password=hash_password("JuniorPass123!"),
        is_super_admin=False,
        is_active=True,
        is_public_member=False,
        status=UserStatus.ONLINE,
    )
    team = Team(name="Showcase Guild", slug="showcase-guild", description="Public showcase team.")
    python_tech = Technology(name="Python", slug="python", category="language")
    react_tech = Technology(name="React", slug="react", category="frontend")

    db_session.add_all([super_admin, regular_user, team, python_tech, react_tech])
    await db_session.commit()
    for obj in (super_admin, regular_user, team, python_tech, react_tech):
        await db_session.refresh(obj)

    # Add a public project and a private project
    public_proj = Project(
        title="Public Showcase App",
        slug="public-showcase-app",
        short_description="An open source showcase web platform.",
        description="Detailed description.",
        status=ProjectStatus.ACTIVE,
        visibility=ProjectVisibility.PUBLIC,
        featured=True,
        team_id=team.id,
        creator_id=super_admin.id,
    )
    public_proj.technologies = [python_tech, react_tech]

    private_proj = Project(
        title="Internal Secret Engine",
        slug="internal-secret-engine",
        short_description="Top secret backend project.",
        status=ProjectStatus.PLANNING,
        visibility=ProjectVisibility.PRIVATE,
        featured=False,
        team_id=team.id,
        creator_id=super_admin.id,
    )

    db_session.add_all([public_proj, private_proj])
    await db_session.commit()

    return {
        "super_admin": super_admin,
        "regular_user": regular_user,
        "team": team,
        "python": python_tech,
        "react": react_tech,
        "public_proj": public_proj,
        "private_proj": private_proj,
    }


async def _get_auth_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    """Logs in and returns bearer token headers."""
    resp = await client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.asyncio
async def test_public_overview_and_caching(
    client: AsyncClient,
    setup_showcase_env: dict[str, object],
) -> None:
    """Verifies public landing overview returns stats, featured projects, and Cache-Control header."""
    resp = await client.get("/api/v1/public/overview")
    assert resp.status_code == 200
    assert "Cache-Control" in resp.headers
    assert "public" in resp.headers["Cache-Control"]

    data = resp.json()
    assert data["total_teams"] >= 1
    assert data["total_projects"] >= 1
    assert len(data["featured_projects"]) >= 1
    assert data["featured_projects"][0]["slug"] == "public-showcase-app"


@pytest.mark.asyncio
async def test_public_projects_and_filtering(
    client: AsyncClient,
    setup_showcase_env: dict[str, object],
) -> None:
    """Verifies that public endpoint exposes only PUBLIC projects and respects technology filters."""
    # 1. List public projects
    resp = await client.get("/api/v1/public/projects")
    assert resp.status_code == 200
    items = resp.json()["items"]
    # Only public_proj should be listed, private_proj must be concealed
    slugs = [p["slug"] for p in items]
    assert "public-showcase-app" in slugs
    assert "internal-secret-engine" not in slugs

    # 2. Filter by technology=python
    filtered_resp = await client.get("/api/v1/public/projects?technology=python")
    assert filtered_resp.status_code == 200
    filtered_items = filtered_resp.json()["items"]
    assert any(p["slug"] == "public-showcase-app" for p in filtered_items)

    # 3. Retrieve public project detail
    detail_resp = await client.get("/api/v1/public/projects/public-showcase-app")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["title"] == "Public Showcase App"
    assert len(detail["technologies"]) == 2

    # 4. Attempt to query private project via public endpoint -> must return 404
    priv_resp = await client.get("/api/v1/public/projects/internal-secret-engine")
    assert priv_resp.status_code == 404


@pytest.mark.asyncio
async def test_public_inquiry_submission_and_honeypot(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Verifies valid proposal creation and honeypot bot trap evasion."""
    # 1. Legitimate user submission
    valid_payload = {
        "client_name": "Alice Sterling",
        "client_email": "alice@sterling.com",
        "company_name": "Sterling Innovations",
        "service_type": InquiryServiceType.WEB_APP.value,
        "budget_range": "$10k - $25k",
        "message": "We need a complete developer platform built with FastAPI and clean architecture.",
    }
    resp = await client.post("/api/v1/public/inquiries", json=valid_payload)
    assert resp.status_code == 201
    inquiry_data = resp.json()
    assert inquiry_data["id"] > 0
    assert inquiry_data["client_name"] == "Alice Sterling"

    # Verify stored in DB
    inq_stmt = select(ServiceInquiry).where(ServiceInquiry.client_email == "alice@sterling.com")
    stored = (await db_session.execute(inq_stmt)).scalars().first()
    assert stored is not None

    # 2. Automated bot filling hidden honeypot trap
    bot_payload = {
        "client_name": "Spam Bot 3000",
        "client_email": "bot@spamnetwork.ru",
        "message": "Buy cheap backlinks and SEO packages immediately.",
        "honeypot": "https://spamlink.ru/trap",
    }
    bot_resp = await client.post("/api/v1/public/inquiries", json=bot_payload)
    # Silently returns 201 with id=0
    assert bot_resp.status_code == 201
    bot_data = bot_resp.json()
    assert bot_data["id"] == 0

    # Verify BOT WAS NOT STORED in DB
    bot_stmt = select(ServiceInquiry).where(ServiceInquiry.client_email == "bot@spamnetwork.ru")
    bot_stored = (await db_session.execute(bot_stmt)).scalars().first()
    assert bot_stored is None


@pytest.mark.asyncio
async def test_admin_inquiries_triage_rbac(
    client: AsyncClient,
    setup_showcase_env: dict[str, object],
) -> None:
    """Verifies that super admins can triage inquiries, while non-admins are forbidden."""
    admin = setup_showcase_env["super_admin"]
    junior = setup_showcase_env["regular_user"]

    admin_headers = await _get_auth_headers(client, admin.email, "RootAdmin2026!")
    junior_headers = await _get_auth_headers(client, junior.email, "JuniorPass123!")

    # Submit an inquiry
    sub_resp = await client.post(
        "/api/v1/public/inquiries",
        json={
            "client_name": "Marcus Kane",
            "client_email": "kane@enterprises.com",
            "message": "Seeking cloud migration consultation for legacy monolith.",
            "service_type": InquiryServiceType.CONSULTATION.value,
        },
    )
    inquiry_id = sub_resp.json()["id"]

    # Junior user tries to list inquiries -> 403 Forbidden
    non_admin_resp = await client.get("/api/v1/inquiries", headers=junior_headers)
    assert non_admin_resp.status_code == 403
    assert non_admin_resp.json()["error"]["code"] == "SUPER_ADMIN_REQUIRED"

    # Super admin lists inquiries
    admin_list_resp = await client.get("/api/v1/inquiries", headers=admin_headers)
    assert admin_list_resp.status_code == 200
    assert admin_list_resp.json()["total"] >= 1

    # Super admin updates inquiry status to IN_REVIEW
    patch_resp = await client.patch(
        f"/api/v1/inquiries/{inquiry_id}",
        json={"status": InquiryStatus.IN_REVIEW.value, "admin_notes": "Assigned to solutions architect."},
        headers=admin_headers,
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["status"] == InquiryStatus.IN_REVIEW.value


@pytest.mark.asyncio
async def test_audit_logs_rbac(
    client: AsyncClient,
    setup_showcase_env: dict[str, object],
) -> None:
    """Verifies that audit log queries are guarded by super administrator privileges."""
    admin = setup_showcase_env["super_admin"]
    junior = setup_showcase_env["regular_user"]

    admin_headers = await _get_auth_headers(client, admin.email, "RootAdmin2026!")
    junior_headers = await _get_auth_headers(client, junior.email, "JuniorPass123!")

    # Junior user tries to view audit logs -> 403 Forbidden
    junior_audit_resp = await client.get("/api/v1/audit", headers=junior_headers)
    assert junior_audit_resp.status_code == 403
    assert junior_audit_resp.json()["error"]["code"] == "SUPER_ADMIN_REQUIRED"

    # Super admin retrieves audit logs -> 200 OK
    admin_audit_resp = await client.get("/api/v1/audit", headers=admin_headers)
    assert admin_audit_resp.status_code == 200
    assert "items" in admin_audit_resp.json()
