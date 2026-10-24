"""Service orchestrating read-only public showcase data for agency portfolio presentation."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database.enums import ProjectVisibility
from src.exc import NotFoundException
from src.modules.project.models import Project
from src.modules.team.models import Team
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.share.responses import PageResult
from .schemas import (
    PublicMember,
    PublicOverview,
    PublicProjectCard,
    PublicProjectDetail,
    PublicTechnologySummary,
)


def _build_project_card(project: Project) -> PublicProjectCard:
    """Builds a PublicProjectCard from an ORM Project instance."""
    team = getattr(project, "team", None)
    techs = [
        PublicTechnologySummary.model_validate(t)
        for t in (getattr(project, "technologies", []) or [])
    ]
    return PublicProjectCard(
        id=project.id,
        title=project.title,
        slug=project.slug,
        short_description=project.short_description,
        featured=project.featured,
        status=project.status,
        demo_url=project.demo_url,
        repo_url=project.repo_url,
        team_name=team.name if team else None,
        team_slug=team.slug if team else None,
        technologies=techs,
    )


async def get_public_overview(session: AsyncSession) -> PublicOverview:
    """Computes aggregated landing page stats, featured projects, and tech stack.

    Args:
        session: Active asynchronous database session.

    Returns:
        Populated PublicOverview DTO.
    """
    total_teams_stmt = select(func.count(Team.id)).where(Team.is_active.is_(True))
    total_projects_stmt = select(func.count(Project.id)).where(
        Project.is_active.is_(True),
        Project.visibility == ProjectVisibility.PUBLIC,
    )
    total_members_stmt = select(func.count(User.id)).where(
        User.is_active.is_(True),
        User.is_public_member.is_(True),
    )

    total_teams = await session.scalar(total_teams_stmt) or 0
    total_projects = await session.scalar(total_projects_stmt) or 0
    total_members = await session.scalar(total_members_stmt) or 0

    # Retrieve up to 6 featured public projects
    featured_stmt = (
        select(Project)
        .options(selectinload(Project.team), selectinload(Project.technologies))
        .where(
            Project.is_active.is_(True),
            Project.visibility == ProjectVisibility.PUBLIC,
            Project.featured.is_(True),
        )
        .order_by(Project.id.desc())
        .limit(6)
    )
    featured_rows = (await session.execute(featured_stmt)).scalars().all()
    featured_cards = [_build_project_card(p) for p in featured_rows]

    # Retrieve all technologies used in public projects
    tech_stmt = select(Technology).order_by(Technology.name.asc())
    tech_rows = (await session.execute(tech_stmt)).scalars().all()
    tech_summaries = [PublicTechnologySummary.model_validate(t) for t in tech_rows]

    return PublicOverview(
        total_teams=total_teams,
        total_projects=total_projects,
        total_public_members=total_members,
        featured_projects=featured_cards,
        technologies=tech_summaries,
    )


async def list_public_projects(
    session: AsyncSession,
    technology_slug: str | None = None,
    featured: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[PublicProjectCard]:
    """Retrieves paginated public projects with optional technology and featured filters.

    Args:
        session: Active asynchronous database session.
        technology_slug: Optional technology slug filter.
        featured: Optional filter for featured status.
        offset: Record offset.
        limit: Max records per page.

    Returns:
        PageResult containing PublicProjectCard instances.
    """
    stmt = (
        select(Project)
        .options(selectinload(Project.team), selectinload(Project.technologies))
        .where(
            Project.is_active.is_(True),
            Project.visibility == ProjectVisibility.PUBLIC,
        )
        .order_by(Project.id.desc())
    )

    if featured is not None:
        stmt = stmt.where(Project.featured.is_(featured))

    if technology_slug is not None:
        stmt = stmt.where(
            Project.technologies.any(Technology.slug == technology_slug)
        )

    # Count filtered total
    count_subquery = stmt.order_by(None).subquery()
    count_stmt = select(func.count()).select_from(count_subquery)
    total = (await session.execute(count_stmt)).scalar_one()

    # Data slice
    data_stmt = stmt.offset(offset).limit(limit)
    rows = (await session.execute(data_stmt)).scalars().all()

    return PageResult(
        items=[_build_project_card(p) for p in rows],
        total=total,
        offset=offset,
        limit=limit,
    )


async def get_public_project(slug: str, session: AsyncSession) -> PublicProjectDetail:
    """Retrieves public project details by slug. Conceals non-public projects with 404.

    Args:
        slug: Unique project slug.
        session: Active asynchronous database session.

    Returns:
        PublicProjectDetail DTO.

    Raises:
        NotFoundException: If project is not found or is private/pending review.
    """
    stmt = (
        select(Project)
        .options(selectinload(Project.team), selectinload(Project.technologies))
        .where(
            Project.slug == slug,
            Project.is_active.is_(True),
            Project.visibility == ProjectVisibility.PUBLIC,
        )
    )
    project = (await session.execute(stmt)).scalars().first()
    if project is None:
        raise NotFoundException(entity="Project", identifier=slug)

    card = _build_project_card(project)
    return PublicProjectDetail(
        id=card.id,
        title=card.title,
        slug=card.slug,
        short_description=card.short_description,
        description=project.description,
        featured=card.featured,
        status=card.status,
        demo_url=card.demo_url,
        repo_url=card.repo_url,
        team_name=card.team_name,
        team_slug=card.team_slug,
        technologies=card.technologies,
        released_at=project.released_at,
        created_at=project.created_at,
    )


async def list_public_members(
    session: AsyncSession,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[PublicMember]:
    """Retrieves paginated developer members who opted into public visibility.

    Args:
        session: Active asynchronous database session.
        offset: Record offset.
        limit: Max records per page.

    Returns:
        PageResult of PublicMember DTOs.
    """
    stmt = (
        select(User)
        .where(
            User.is_active.is_(True),
            User.is_public_member.is_(True),
        )
        .order_by(User.id.asc())
    )

    count_subquery = stmt.order_by(None).subquery()
    count_stmt = select(func.count()).select_from(count_subquery)
    total = (await session.execute(count_stmt)).scalar_one()

    data_stmt = stmt.offset(offset).limit(limit)
    rows = (await session.execute(data_stmt)).scalars().all()

    return PageResult(
        items=[PublicMember.model_validate(u) for u in rows],
        total=total,
        offset=offset,
        limit=limit,
    )


async def list_public_technologies(session: AsyncSession) -> list[PublicTechnologySummary]:
    """Retrieves all technology catalog items available for showcase filtering.

    Args:
        session: Active asynchronous database session.

    Returns:
        List of PublicTechnologySummary DTOs.
    """
    stmt = select(Technology).order_by(Technology.name.asc())
    rows = (await session.execute(stmt)).scalars().all()
    return [PublicTechnologySummary.model_validate(t) for t in rows]
