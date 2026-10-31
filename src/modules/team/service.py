"""Team domain service orchestrating team lifecycles, memberships, and metrics."""

from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import TeamRole
from src.exc import AlreadyExistsException, NotFoundException
from src.modules.team_members.models import TeamMember
from src.modules.team_members.repository import TeamMemberRepository
from src.modules.user.models import User
from src.share.event_bus import event_bus
from src.share.helpers import slugify
from src.share.responses import PageResult
from src.share.schemas import AuditEvent
from .models import Team
from .repository import TeamRepository
from .schemas import CreateTeamRequest, TeamResponse, UpdateTeamRequest


async def create_team(
    schema: CreateTeamRequest,
    current_user: User,
    session: AsyncSession,
) -> TeamResponse:
    """Creates a team workspace, enforces slug uniqueness, and grants the creator ADMIN authority.

    Args:
        schema: Validated team creation request.
        current_user: Requester creating the team.
        session: Active asynchronous database session.

    Returns:
        Populated TeamResponse with initial metrics.

    Raises:
        AlreadyExistsException: If a team with the resolved slug already exists.
    """
    team_repo = TeamRepository(session=session)
    member_repo = TeamMemberRepository(session=session)

    target_slug = slugify(schema.slug if schema.slug else schema.name)

    existing = await team_repo.get_by_slug(target_slug)
    if existing is not None:
        raise AlreadyExistsException(entity="Team", field="slug", value=target_slug)

    team = Team(
        name=schema.name,
        slug=target_slug,
        description=schema.description,
        creator_id=current_user.id,
    )
    team = await team_repo.create(team)
    await session.flush()

    # Automatically enroll creator as team administrator
    initial_membership = TeamMember(
        team_id=team.id,
        member_id=current_user.id,
        role=TeamRole.ADMIN,
    )
    await member_repo.create(initial_membership)
    await session.flush()

    await event_bus.publish(
        AuditEvent(
            action="TEAM_CREATED",
            entity_type="Team",
            entity_id=str(team.id),
            user_id=current_user.id,
        ),
        session=session,
    )

    resp = TeamResponse.model_validate(team)
    resp.members_count = 1
    resp.projects_count = 0
    return resp


async def get_team(
    identifier: int | str,
    session: AsyncSession,
) -> TeamResponse:
    """Retrieves a team workspace by ID or slug along with live member and project counts.

    Args:
        identifier: Team integer ID or slug string.
        session: Active asynchronous database session.

    Returns:
        TeamResponse populated with counts.

    Raises:
        NotFoundException: If no matching team exists.
    """
    team_repo = TeamRepository(session=session)
    team: Team | None = None

    if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
        team = await team_repo.get_by_id(int(identifier))

    if team is None and isinstance(identifier, str):
        team = await team_repo.get_by_slug(identifier)

    if team is None:
        raise NotFoundException(entity="Team", identifier=identifier)

    members_count, projects_count = await team_repo.get_team_metrics(team.id)
    resp = TeamResponse.model_validate(team)
    resp.members_count = members_count
    resp.projects_count = projects_count
    return resp


async def update_team(
    team_id: int,
    schema: UpdateTeamRequest,
    session: AsyncSession,
) -> TeamResponse:
    """Updates team properties and returns updated metrics.

    Args:
        team_id: Target team integer ID.
        schema: Validated fields to update.
        session: Active asynchronous database session.

    Returns:
        Updated TeamResponse.

    Raises:
        NotFoundException: If team does not exist.
    """
    team_repo = TeamRepository(session=session)
    team = await team_repo.get_by_id(team_id)
    if team is None:
        raise NotFoundException(entity="Team", identifier=team_id)

    update_data = schema.model_dump(exclude_unset=True)
    if update_data:
        team = await team_repo.update(team, update_data)

    members_count, projects_count = await team_repo.get_team_metrics(team.id)
    resp = TeamResponse.model_validate(team)
    resp.members_count = members_count
    resp.projects_count = projects_count
    return resp


async def delete_team(
    team_id: int,
    session: AsyncSession,
) -> None:
    """Deletes a team workspace and cascades deletion to projects and members.

    Args:
        team_id: Target team integer ID.
        session: Active asynchronous database session.

    Raises:
        NotFoundException: If team is not found.
    """
    team_repo = TeamRepository(session=session)
    team = await team_repo.get_by_id(team_id)
    if team is None:
        raise NotFoundException(entity="Team", identifier=team_id)

    await team_repo.delete(team)
    await event_bus.publish(
        AuditEvent(
            action="TEAM_DELETED",
            entity_type="Team",
            entity_id=str(team_id),
        ),
        session=session,
    )


async def list_teams(
    current_user: User,
    session: AsyncSession,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[TeamResponse]:
    """Lists teams accessible to the current user (all for super admins, enrolled for developers).

    Args:
        current_user: Requester.
        session: Active asynchronous database session.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of TeamResponse instances.
    """
    team_repo = TeamRepository(session=session)

    if current_user.is_super_admin:
        page = await team_repo.get_active_teams(offset=offset, limit=limit)
    else:
        page = await team_repo.get_user_teams(user_id=current_user.id, offset=offset, limit=limit)

    team_ids = [t.id for t in page.items]
    metrics_map = await team_repo.get_batch_team_metrics(team_ids)

    items_with_metrics: list[TeamResponse] = []
    for team in page.items:
        members_count, projects_count = metrics_map.get(team.id, (0, 0))
        resp = TeamResponse.model_validate(team)
        resp.members_count = members_count
        resp.projects_count = projects_count
        items_with_metrics.append(resp)

    return PageResult(
        items=items_with_metrics,
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )