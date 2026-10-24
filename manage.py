"""CLI Administrative and Database Seeding Utility for Team Management Base."""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from src.database.engine import async_engine
from src.database.enums import (
    InquiryServiceType,
    InquiryStatus,
    JobTitle,
    ProjectStatus,
    ProjectVisibility,
    TaskPriority,
    TaskStatus,
    TeamRole,
    TechnologyCategory,
    UserStatus,
)
from src.database.registry import Base
from src.database.session import AsyncSessionLocal
from src.modules.inquiry.models import ServiceInquiry
from src.modules.project.models import Project
from src.modules.task.models import Task, TaskComment
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.security import get_casbin_enforcer, hash_password, init_default_casbin_policies


async def create_admin(email: str, username: str, name: str, password: str | None = None) -> None:
    """Creates a new super administrator account.

    Args:
        email: Administrator email.
        username: Administrator username.
        name: Administrator display name.
        password: Plaintext password (prompted if None).
    """
    if not password:
        password = getpass.getpass("Enter administrator password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            sys.exit(1)

    async with AsyncSessionLocal() as session:
        stmt = select(User).where((User.email == email) | (User.username == username))
        existing = (await session.execute(stmt)).scalars().first()
        if existing:
            print(f"Error: User with email '{email}' or username '{username}' already exists.", file=sys.stderr)
            sys.exit(1)

        admin = User(
            name=name,
            username=username,
            email=email,
            hashed_password=hash_password(password),
            is_super_admin=True,
            is_active=True,
            is_public_member=True,
            job_title=JobTitle.SOFTWARE_ENGINEER,
            status=UserStatus.ONLINE,
        )
        session.add(admin)
        await session.commit()
        print(f"Successfully created super administrator: {username} ({email})")


async def seed_policies(reset: bool = False) -> None:
    """Initializes or resets standard Casbin RBAC policies."""
    enforcer = await get_casbin_enforcer()
    if reset:
        print("Clearing existing Casbin rules...")
        await enforcer.clear_policy()

    await init_default_casbin_policies(enforcer)
    print("Casbin RBAC policies synchronized successfully.")


async def seed_demo() -> None:
    """Populates the database with a rich demo environment."""
    print("Seeding full demo workspace, team members, projects, tasks, and inquiries...")
    enforcer = await get_casbin_enforcer()
    await init_default_casbin_policies(enforcer)

    async with AsyncSessionLocal() as session:
        # 1. Super Admin
        admin_stmt = select(User).where(User.username == "alex_admin")
        admin = (await session.execute(admin_stmt)).scalars().first()
        if not admin:
            admin = User(
                name="Alex Vance",
                username="alex_admin",
                email="alex@agency.io",
                hashed_password=hash_password("AgencyAdmin2026!"),
                is_super_admin=True,
                is_active=True,
                is_public_member=True,
                job_title=JobTitle.SOFTWARE_ENGINEER,
                github_url="https://github.com/alex-vance",
                linkedin_url="https://linkedin.com/in/alex-vance",
            )
            session.add(admin)
            await session.flush()

        # 2. Developers
        devs_data = [
            ("Sarah Connor", "sarah_c", "sarah@agency.io", JobTitle.BACKEND_DEVELOPER, "https://github.com/sarah-c"),
            ("Marcus Wright", "marcus_w", "marcus@agency.io", JobTitle.FRONTEND_DEVELOPER, "https://github.com/marcus-w"),
            ("Elena Fisher", "elena_f", "elena@agency.io", JobTitle.FULLSTACK_DEVELOPER, "https://github.com/elena-f"),
            ("Nathan Drake", "nathan_d", "nathan@agency.io", JobTitle.MOBILE_DEVELOPER, "https://github.com/nathan-d"),
            ("Chloe Frazer", "chloe_f", "chloe@agency.io", JobTitle.UI_UX_DESIGNER, "https://github.com/chloe-f"),
            ("Victor Sullivan", "victor_s", "victor@agency.io", JobTitle.DEVOPS_ENGINEER, "https://github.com/victor-s"),
        ]
        dev_objs: list[User] = []
        for name, uname, email, title, gh in devs_data:
            stmt = select(User).where(User.username == uname)
            user = (await session.execute(stmt)).scalars().first()
            if not user:
                user = User(
                    name=name,
                    username=uname,
                    email=email,
                    hashed_password=hash_password("DeveloperPass123!"),
                    is_super_admin=False,
                    is_active=True,
                    is_public_member=True,
                    job_title=title,
                    github_url=gh,
                )
                session.add(user)
                await session.flush()
            dev_objs.append(user)

        # 3. Technologies
        techs_data = [
            ("Python", "python", TechnologyCategory.LANGUAGE),
            ("FastAPI", "fastapi", TechnologyCategory.BACKEND),
            ("TypeScript", "typescript", TechnologyCategory.LANGUAGE),
            ("React", "react", TechnologyCategory.FRONTEND),
            ("Docker", "docker", TechnologyCategory.DEVOPS),
            ("PostgreSQL", "postgresql", TechnologyCategory.DATABASE),
            ("Figma", "figma", TechnologyCategory.DESIGN),
            ("Flutter", "flutter", TechnologyCategory.MOBILE),
        ]
        tech_map: dict[str, Technology] = {}
        for name, slug, cat in techs_data:
            stmt = select(Technology).where(Technology.slug == slug)
            tech = (await session.execute(stmt)).scalars().first()
            if not tech:
                tech = Technology(name=name, slug=slug, category=cat)
                session.add(tech)
                await session.flush()
            tech_map[slug] = tech

        # 4. Teams
        # Team 1: Backend & Cloud Guild
        t1_stmt = select(Team).where(Team.slug == "backend-cloud-guild")
        team1 = (await session.execute(t1_stmt)).scalars().first()
        if not team1:
            team1 = Team(
                name="Backend & Cloud Guild",
                slug="backend-cloud-guild",
                description="Core microservices, APIs, and cloud infrastructure.",
            )
            session.add(team1)
            await session.flush()
            # Enroll members
            session.add_all([
                TeamMember(team_id=team1.id, member_id=dev_objs[0].id, role=TeamRole.ADMIN),
                TeamMember(team_id=team1.id, member_id=dev_objs[2].id, role=TeamRole.DEVELOPER),
                TeamMember(team_id=team1.id, member_id=dev_objs[5].id, role=TeamRole.DEVELOPER),
            ])
            await session.flush()

        # Team 2: Frontend & Design Lab
        t2_stmt = select(Team).where(Team.slug == "frontend-design-lab")
        team2 = (await session.execute(t2_stmt)).scalars().first()
        if not team2:
            team2 = Team(
                name="Frontend & Design Lab",
                slug="frontend-design-lab",
                description="Next-gen user interfaces, design systems, and mobile apps.",
            )
            session.add(team2)
            await session.flush()
            session.add_all([
                TeamMember(team_id=team2.id, member_id=dev_objs[1].id, role=TeamRole.ADMIN),
                TeamMember(team_id=team2.id, member_id=dev_objs[3].id, role=TeamRole.DEVELOPER),
                TeamMember(team_id=team2.id, member_id=dev_objs[4].id, role=TeamRole.DEVELOPER),
            ])
            await session.flush()

        # 5. Projects
        p1_stmt = select(Project).where(Project.slug == "cloud-architecture-platform")
        proj1 = (await session.execute(p1_stmt)).scalars().first()
        if not proj1:
            proj1 = Project(
                title="Cloud Architecture Platform",
                slug="cloud-architecture-platform",
                short_description="High-throughput distributed workflow orchestration engine.",
                description="Production-grade asynchronous microservices mesh utilizing event-driven architecture.",
                status=ProjectStatus.ACTIVE,
                visibility=ProjectVisibility.PUBLIC,
                featured=True,
                demo_url="https://cloud.agency.io/demo",
                repo_url="https://github.com/agency/cloud-platform",
                team_id=team1.id,
                creator_id=dev_objs[0].id,
            )
            proj1.technologies = [tech_map["python"], tech_map["fastapi"], tech_map["docker"], tech_map["postgresql"]]
            session.add(proj1)
            await session.flush()

            # Tasks for Project 1
            tasks_p1 = [
                Task(
                    title="Design event schema",
                    description="Formalize CloudEvents v1.0 specifications.",
                    status=TaskStatus.DONE,
                    priority=TaskPriority.HIGH,
                    position=1000.0,
                    project_id=proj1.id,
                    creator_id=dev_objs[0].id,
                    assignee_to_id=dev_objs[0].id,
                ),
                Task(
                    title="Configure Docker Compose cluster",
                    description="Local orchestration with Redis and PostgreSQL.",
                    status=TaskStatus.DONE,
                    priority=TaskPriority.MEDIUM,
                    position=2000.0,
                    project_id=proj1.id,
                    creator_id=dev_objs[0].id,
                    assignee_to_id=dev_objs[5].id,
                ),
                Task(
                    title="Implement token revocation family defense",
                    description="Prevent replay attacks with automatic family revocation.",
                    status=TaskStatus.IN_PROGRESS,
                    priority=TaskPriority.CRITICAL,
                    position=1000.0,
                    project_id=proj1.id,
                    creator_id=dev_objs[0].id,
                    assignee_to_id=dev_objs[2].id,
                ),
                Task(
                    title="Setup automated load testing",
                    description="Benchmark API throughput up to 10k RPS with Locust.",
                    status=TaskStatus.TODO,
                    priority=TaskPriority.LOW,
                    position=1000.0,
                    project_id=proj1.id,
                    creator_id=dev_objs[0].id,
                    assignee_to_id=dev_objs[5].id,
                ),
            ]
            session.add_all(tasks_p1)
            await session.flush()

            # Add comments
            comm1 = TaskComment(
                task_id=tasks_p1[2].id,
                author_id=dev_objs[0].id,
                content="Ensure session.commit() occurs before raising the security exception to preserve the revocation.",
            )
            comm2 = TaskComment(
                task_id=tasks_p1[2].id,
                author_id=dev_objs[2].id,
                content="Implemented and verified with unit test suite.",
            )
            session.add_all([comm1, comm2])

        # Project 2: Design System & UI Library
        p2_stmt = select(Project).where(Project.slug == "design-system-ui")
        proj2 = (await session.execute(p2_stmt)).scalars().first()
        if not proj2:
            proj2 = Project(
                title="Design System & UI Library",
                slug="design-system-ui",
                short_description="Accessible modern component ecosystem with dark-mode aesthetic.",
                description="Ultra-responsive UI component system with glassmorphic cards and Kanban boards.",
                status=ProjectStatus.ACTIVE,
                visibility=ProjectVisibility.PUBLIC,
                featured=True,
                demo_url="https://design.agency.io",
                repo_url="https://github.com/agency/ui-kit",
                team_id=team2.id,
                creator_id=dev_objs[1].id,
            )
            proj2.technologies = [tech_map["typescript"], tech_map["react"], tech_map["figma"]]
            session.add(proj2)
            await session.flush()

            tasks_p2 = [
                Task(
                    title="Build Kanban drag-and-drop board",
                    description="HTML5 drag-and-drop with column reordering.",
                    status=TaskStatus.IN_PROGRESS,
                    priority=TaskPriority.HIGH,
                    position=1000.0,
                    project_id=proj2.id,
                    creator_id=dev_objs[1].id,
                    assignee_to_id=dev_objs[1].id,
                ),
                Task(
                    title="Create dark glassmorphic theme tokens",
                    description="HSL CSS variables for contrast and accessibility.",
                    status=TaskStatus.DONE,
                    priority=TaskPriority.MEDIUM,
                    position=1000.0,
                    project_id=proj2.id,
                    creator_id=dev_objs[1].id,
                    assignee_to_id=dev_objs[4].id,
                ),
            ]
            session.add_all(tasks_p2)
            await session.flush()

        # 6. Service Inquiries
        inq1 = ServiceInquiry(
            client_name="David Miller",
            client_email="david@acmecorp.com",
            company_name="Acme Corporation",
            service_type=InquiryServiceType.WEB_APP,
            budget_range="$20k - $50k",
            message="We require a real-time team workflow dashboard with role-based access control.",
            status=InquiryStatus.NEW,
        )
        inq2 = ServiceInquiry(
            client_name="Yara Hassan",
            client_email="yara@talent.io",
            company_name="Independent",
            service_type=InquiryServiceType.JOIN_REQUEST,
            budget_range=None,
            message="Senior Full-Stack Engineer with 5+ years experience in FastAPI and React looking to join the agency.",
            status=InquiryStatus.IN_REVIEW,
        )
        session.add_all([inq1, inq2])
        await session.commit()

    print("Demo environment successfully seeded!")
    print("Super Admin credentials: alex@agency.io / AgencyAdmin2026!")
    print("Developer credentials: <username>@agency.io / DeveloperPass123!")


async def list_users() -> None:
    """Prints all registered users in a tabular format."""
    async with AsyncSessionLocal() as session:
        stmt = select(User).order_by(User.id.asc())
        users = (await session.execute(stmt)).scalars().all()
        print(f"{'ID':<4} {'Username':<18} {'Email':<25} {'Role':<12} {'Active':<8}")
        print("-" * 70)
        for u in users:
            role = "SuperAdmin" if u.is_super_admin else "Developer"
            print(f"{u.id:<4} {u.username:<18} {u.email:<25} {role:<12} {str(u.is_active):<8}")


async def list_policies() -> None:
    """Prints active Casbin permission policies."""
    enforcer = await get_casbin_enforcer()
    policies = enforcer.get_policy()
    print(f"{'Role / Subject':<18} {'Domain':<10} {'Resource':<15} {'Action':<15}")
    print("-" * 62)
    for row in policies:
        sub, dom, obj, act = row[0], row[1], row[2], row[3]
        print(f"{sub:<18} {dom:<10} {obj:<15} {act:<15}")


def main() -> None:
    """Parses command-line arguments and routes to asynchronous commands."""
    parser = argparse.ArgumentParser(description="Team Management Base Administrative CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create-admin
    admin_parser = subparsers.add_parser("create-admin", help="Create a new super administrator account")
    admin_parser.add_argument("--email", required=True, help="Administrator email address")
    admin_parser.add_argument("--username", required=True, help="Unique administrator username")
    admin_parser.add_argument("--name", required=True, help="Full name")
    admin_parser.add_argument("--password", required=False, default=None, help="Plaintext password")

    # seed-policies
    policy_parser = subparsers.add_parser("seed-policies", help="Seed or reset Casbin RBAC policies")
    policy_parser.add_argument("--reset", action="store_true", help="Clear all existing rules before seeding")

    # seed-demo
    subparsers.add_parser("seed-demo", help="Seed a rich demo environment with teams, projects, and tasks")

    # users list
    users_parser = subparsers.add_parser("users", help="Inspect platform users")
    users_parser.add_argument("action", choices=["list"], help="Action to execute")

    # policies list
    policies_parser = subparsers.add_parser("policies", help="Inspect Casbin permission policies")
    policies_parser.add_argument("action", choices=["list"], help="Action to execute")

    args = parser.parse_args()

    if args.command == "create-admin":
        asyncio.run(create_admin(args.email, args.username, args.name, args.password))
    elif args.command == "seed-policies":
        asyncio.run(seed_policies(args.reset))
    elif args.command == "seed-demo":
        asyncio.run(seed_demo())
    elif args.command == "users" and args.action == "list":
        asyncio.run(list_users())
    elif args.command == "policies" and args.action == "list":
        asyncio.run(list_policies())


if __name__ == "__main__":
    main()
