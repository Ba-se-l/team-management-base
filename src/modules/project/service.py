"""Project domain service orchestrating project creation, updates, and technology mappings."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import ProjectStatus, ProjectVisibility
from src.exc import AlreadyExistsException, NotFoundException
from src.modules.team.repository import TeamRepository
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.share.helpers import slugify
from src.share.responses import PageResult
from .models import Project
from .repository import ProjectRepository
from .schemas import (
    CreateProjectRequest,
    ProjectResponse,
    ProjectTechnologySummary,
    UpdateProjectRequest,
)


async def _hydrate_project_response(project: Project, repo: ProjectRepository) -> ProjectResponse:
    """Builds a hydrated ProjectResponse including linked technologies and task statistics."""
    total_tasks, completed_tasks = await repo.get_task_counts(project.id)
    tech_summaries = [
        ProjectTechnologySummary.model_validate(tech)
        for tech in (project.technologies or [])
    ]
    resp = ProjectResponse.model_validate(project)
    resp.technologies = tech_summaries
    resp.tasks_count = total_tasks
    resp.tasks_completed_count = completed_tasks
    return resp


async def create_project(
    team_id: int,
    schema: CreateProjectRequest,
    creator: User,
    session: AsyncSession,
) -> ProjectResponse:
    """Creates a project inside a team workspace, binds tech stack items, and generates slug.

    Args:
        team_id: Owning team integer ID.
        schema: Validated project creation request.
        creator: Authenticated user creating the project.
        session: Active asynchronous database session.

    Returns:
        Hydrated ProjectResponse.

    Raises:
        NotFoundException: If team workspace does not exist.
        AlreadyExistsException: If a project with this slug already exists.
    """
    team_repo = TeamRepository(session=session)
    team = await team_repo.get_by_id(team_id)
    if team is None:
        raise NotFoundException(entity="Team", identifier=team_id)

    project_repo = ProjectRepository(session=session)
    target_slug = slugify(schema.slug if schema.slug else schema.title)

    existing = await project_repo.get_by_slug(target_slug)
    if existing is not None:
        raise AlreadyExistsException(entity="Project", field="slug", value=target_slug)

    project = Project(
        title=schema.title,
        slug=target_slug,
        short_description=schema.short_description,
        description=schema.description,
        visibility=schema.visibility,
        status=schema.status,
        demo_url=schema.demo_url,
        repo_url=schema.repo_url,
        deadline=schema.deadline,
        team_id=team_id,
        creator_id=creator.id,
    )

    if schema.technology_ids:
        stmt = select(Technology).where(Technology.id.in_(schema.technology_ids))
        result = await session.execute(stmt)
        technologies = list(result.scalars().all())
        if len(technologies) != len(schema.technology_ids):
            found_ids = {t.id for t in technologies}
            missing = [tid for tid in schema.technology_ids if tid not in found_ids]
            raise NotFoundException(entity="Technology", identifier=missing[0])
        project.technologies = technologies

    project = await project_repo.create(project)
    await session.flush()

    hydrated = await project_repo.get_by_id_with_techs(project.id)
    return await _hydrate_project_response(hydrated or project, project_repo)


async def get_project(
    identifier: int | str,
    session: AsyncSession,
) -> ProjectResponse:
    """Retrieves a project by integer ID or slug along with technologies and task metrics.

    Args:
        identifier: Project integer ID or slug string.
        session: Active asynchronous database session.

    Returns:
        Hydrated ProjectResponse.

    Raises:
        NotFoundException: If project is not found.
    """
    project_repo = ProjectRepository(session=session)
    project: Project | None = None

    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        project = await project_repo.get_by_id_with_techs(int(identifier))

    if project is None and isinstance(identifier, str):
        project = await project_repo.get_by_slug(identifier)

    if project is None:
        raise NotFoundException(entity="Project", identifier=identifier)

    return await _hydrate_project_response(project, project_repo)


async def update_project(
    project_id: int,
    schema: UpdateProjectRequest,
    session: AsyncSession,
) -> ProjectResponse:
    """Updates project properties and tech stack associations.

    Args:
        project_id: Target project integer ID.
        schema: Validated fields to update.
        session: Active asynchronous database session.

    Returns:
        Hydrated updated ProjectResponse.

    Raises:
        NotFoundException: If project is not found.
    """
    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id_with_techs(project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=project_id)

    update_data = schema.model_dump(exclude_unset=True, exclude={"technology_ids"})
    if update_data:
        project = await project_repo.update(project, update_data)

    if schema.technology_ids is not None:
        if schema.technology_ids:
            stmt = select(Technology).where(Technology.id.in_(schema.technology_ids))
            result = await session.execute(stmt)
            technologies = list(result.scalars().all())
            if len(technologies) != len(schema.technology_ids):
                found_ids = {t.id for t in technologies}
                missing = [tid for tid in schema.technology_ids if tid not in found_ids]
                raise NotFoundException(entity="Technology", identifier=missing[0])
            project.technologies = technologies
        else:
            project.technologies = []
        await session.flush()

    return await _hydrate_project_response(project, project_repo)


async def delete_project(
    project_id: int,
    session: AsyncSession,
) -> None:
    """Deletes a project and cascades deletion to tasks.

    Args:
        project_id: Target project integer ID.
        session: Active asynchronous database session.

    Raises:
        NotFoundException: If project does not exist.
    """
    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id(project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=project_id)

    await project_repo.delete(project)


async def list_team_projects(
    team_id: int,
    session: AsyncSession,
    status: ProjectStatus | None = None,
    visibility: ProjectVisibility | None = None,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[ProjectResponse]:
    """Retrieves paginated projects inside a team workspace with optional filters.

    Args:
        team_id: Team integer ID.
        session: Active asynchronous database session.
        status: Optional status filter.
        visibility: Optional visibility filter.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of hydrated ProjectResponse instances.
    """
    project_repo = ProjectRepository(session=session)
    page = await project_repo.get_team_projects(
        team_id=team_id,
        status=status,
        visibility=visibility,
        offset=offset,
        limit=limit,
    )

    items = [
        await _hydrate_project_response(p, project_repo)
        for p in page.items
    ]

    return PageResult(
        items=items,
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )


async def list_all_projects(
    session: AsyncSession,
    offset: int = 0,
    limit: int = 50,
) -> PageResult[ProjectResponse]:
    """Retrieves all active projects across the workspace with hydration.

    Args:
        session: Active asynchronous database session.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of hydrated ProjectResponse instances.
    """
    project_repo = ProjectRepository(session=session)
    page = await project_repo.list_all_projects(offset=offset, limit=limit)
    items = [
        await _hydrate_project_response(p, project_repo)
        for p in page.items
    ]
    return PageResult(
        items=items,
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )
