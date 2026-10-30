"""Project domain service orchestrating project creation, updates, and technology mappings."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import ProjectStatus, ProjectVisibility, TeamRole
from src.exc import AlreadyExistsException, ForbiddenException, NotFoundException
from src.modules.team.repository import TeamRepository
from src.modules.team_members.repository import TeamMemberRepository
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.share import AuditEvent, event_bus
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


def _hydrate_project_with_counts(
    project: Project,
    counts: tuple[int, int],
) -> ProjectResponse:
    """Builds a ProjectResponse using pre-fetched (total_tasks, completed_tasks) counts."""
    tech_summaries = [
        ProjectTechnologySummary.model_validate(tech)
        for tech in (project.technologies or [])
    ]
    resp = ProjectResponse.model_validate(project)
    resp.technologies = tech_summaries
    resp.tasks_count = counts[0]
    resp.tasks_completed_count = counts[1]
    return resp


async def _hydrate_project_response(project: Project, repo: ProjectRepository) -> ProjectResponse:
    """Builds a hydrated ProjectResponse including linked technologies and task statistics."""
    counts = await repo.get_task_counts(project.id)
    return _hydrate_project_with_counts(project, counts)


async def _enforce_visibility_policy(
    actor: User,
    team_id: int,
    target_visibility: ProjectVisibility,
    session: AsyncSession,
) -> None:
    """Enforces V1 publication governance on project visibility transitions.

    - PRIVATE: allowed for any authorized project creator/editor.
    - PENDING_REVIEW: requires Team ADMIN or Super Admin.
    - PUBLIC: requires Super Admin exclusively.
    """
    if target_visibility == ProjectVisibility.PRIVATE or actor.is_super_admin:
        return

    if target_visibility == ProjectVisibility.PUBLIC:
        raise ForbiddenException(
            message="Only a Super Admin can approve and publish a project to public visibility.",
            error_code="PUBLIC_PUBLISH_REQUIRES_SUPER_ADMIN",
        )

    if target_visibility == ProjectVisibility.PENDING_REVIEW:
        tm_repo = TeamMemberRepository(session=session)
        membership = await tm_repo.get_membership(member_id=actor.id, team_id=team_id)
        if membership is None or not membership.is_active or membership.role != TeamRole.ADMIN:
            raise ForbiddenException(
                message="Only a Team Admin or Super Admin can submit a project for public review.",
                error_code="PENDING_REVIEW_REQUIRES_TEAM_ADMIN",
            )


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

    await _enforce_visibility_policy(
        actor=creator,
        team_id=team_id,
        target_visibility=schema.visibility,
        session=session,
    )

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
        unique_tech_ids = list(dict.fromkeys(schema.technology_ids))
        stmt = select(Technology).where(Technology.id.in_(unique_tech_ids))
        result = await session.execute(stmt)
        technologies = list(result.scalars().all())
        if len(technologies) != len(unique_tech_ids):
            found_ids = {t.id for t in technologies}
            missing = [tid for tid in unique_tech_ids if tid not in found_ids]
            raise NotFoundException(entity="Technology", identifier=missing[0])
        project.technologies = technologies

    project = await project_repo.create(project)
    await session.flush()

    hydrated = await project_repo.get_by_id_with_techs(project.id)

    await event_bus.publish(
        AuditEvent(
            action="PROJECT_CREATED",
            entity_type="Project",
            entity_id=str(project.id),
            user_id=creator.id,
            changes_payload={"title": project.title, "team_id": project.team_id, "slug": project.slug},
        ),
        session=session,
    )

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
    current_user: User | None = None,
) -> ProjectResponse:
    """Updates project properties and tech stack associations.

    Args:
        project_id: Target project integer ID.
        schema: Validated fields to update.
        session: Active asynchronous database session.
        current_user: Optional authenticated user enforcing visibility governance.

    Returns:
        Hydrated updated ProjectResponse.

    Raises:
        NotFoundException: If project is not found.
        ForbiddenException: If caller lacks permission to set requested visibility.
    """
    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id_with_techs(project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=project_id)

    old_visibility = project.visibility
    update_data = schema.model_dump(exclude_unset=True, exclude={"technology_ids"})

    if (
        current_user is not None
        and "visibility" in update_data
        and schema.visibility is not None
        and schema.visibility != old_visibility
    ):
        await _enforce_visibility_policy(
            actor=current_user,
            team_id=project.team_id,
            target_visibility=schema.visibility,
            session=session,
        )

    if update_data:
        project = await project_repo.update(project, update_data)

    if "visibility" in update_data and project.visibility != old_visibility:
        await event_bus.publish(
            AuditEvent(
                action="PROJECT_VISIBILITY_CHANGED",
                entity_type="Project",
                entity_id=str(project.id),
                user_id=current_user.id if current_user else None,
                changes_payload={
                    "old_visibility": old_visibility.value,
                    "new_visibility": project.visibility.value,
                },
            ),
            session=session,
        )

    if schema.technology_ids is not None:
        if schema.technology_ids:
            unique_tech_ids = list(dict.fromkeys(schema.technology_ids))
            stmt = select(Technology).where(Technology.id.in_(unique_tech_ids))
            result = await session.execute(stmt)
            technologies = list(result.scalars().all())
            if len(technologies) != len(unique_tech_ids):
                found_ids = {t.id for t in technologies}
                missing = [tid for tid in unique_tech_ids if tid not in found_ids]
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

    counts_map = await project_repo.get_batch_task_counts([p.id for p in page.items])
    items = [
        _hydrate_project_with_counts(p, counts_map.get(p.id, (0, 0)))
        for p in page.items
    ]

    return PageResult(
        items=items,
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )


async def list_accessible_projects(
    user_id: int,
    is_super_admin: bool,
    session: AsyncSession,
    offset: int = 0,
    limit: int = 50,
) -> PageResult[ProjectResponse]:
    """Retrieves all active projects accessible to a user across their teams.

    Args:
        user_id: User integer primary key.
        is_super_admin: Whether the user is a super admin.
        session: Active asynchronous database session.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of hydrated ProjectResponse instances.
    """
    project_repo = ProjectRepository(session=session)
    page = await project_repo.get_accessible_projects(
        user_id=user_id,
        is_super_admin=is_super_admin,
        offset=offset,
        limit=limit,
    )
    counts_map = await project_repo.get_batch_task_counts([p.id for p in page.items])
    items = [
        _hydrate_project_with_counts(p, counts_map.get(p.id, (0, 0)))
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
    counts_map = await project_repo.get_batch_task_counts([p.id for p in page.items])
    items = [
        _hydrate_project_with_counts(p, counts_map.get(p.id, (0, 0)))
        for p in page.items
    ]
    return PageResult(
        items=items,
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )
