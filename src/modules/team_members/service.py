"""Team member domain service orchestrating memberships, role updates, and orphan protection."""

from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import TeamRole
from src.exc import BusinessRuleViolationException, NotFoundException
from src.modules.team.repository import TeamRepository
from src.modules.user.models import User
from src.modules.user.repository import UserRepository
from src.share.responses import PageResult
from .models import TeamMember
from .repository import TeamMemberRepository
from .schemas import AddMemberRequest, MemberResponse, UpdateMemberRoleRequest


def _build_member_response(membership: TeamMember, user: User | None = None) -> MemberResponse:
    """Builds a hydrated MemberResponse combining membership record and user profile."""
    u = user or getattr(membership, "member", None)
    return MemberResponse(
        member_id=membership.member_id,
        team_id=membership.team_id,
        role=membership.role,
        is_active=membership.is_active,
        joined_at=membership.joined_at,
        name=u.name if u else None,
        username=u.username if u else None,
        email=u.email if u else None,
        avatar_url=u.avatar_url if u else None,
        job_title=u.job_title if u else None,
    )


async def add_member(
    team_id: int,
    schema: AddMemberRequest,
    session: AsyncSession,
) -> MemberResponse:
    """Enrolls an existing active user into a team workspace.

    Args:
        team_id: Team integer ID.
        schema: Request containing user_id and role.
        session: Active asynchronous database session.

    Returns:
        Hydrated MemberResponse.

    Raises:
        NotFoundException: If team or user does not exist.
        BusinessRuleViolationException: If user is inactive or already a team member.
    """
    team_repo = TeamRepository(session=session)
    team = await team_repo.get_by_id(team_id)
    if team is None:
        raise NotFoundException(entity="Team", identifier=team_id)

    user_repo = UserRepository(session=session)
    target_user = await user_repo.get_by_id(schema.user_id)
    if target_user is None:
        raise NotFoundException(entity="User", identifier=schema.user_id)

    if not target_user.is_active:
        raise BusinessRuleViolationException(
            message=f"User '{target_user.username}' is inactive and cannot be enrolled in a team.",
            error_code="INACTIVE_USER_ENROLLMENT",
        )

    member_repo = TeamMemberRepository(session=session)
    existing = await member_repo.get_membership(member_id=schema.user_id, team_id=team_id)

    if existing is not None:
        if existing.is_active:
            raise BusinessRuleViolationException(
                message=f"User '{target_user.username}' is already an active member of this team.",
                error_code="MEMBER_ALREADY_EXISTS",
            )
        # Reactivate previously removed membership
        existing.is_active = True
        existing.role = schema.role
        await member_repo.update(existing, {"is_active": True, "role": schema.role})
        return _build_member_response(existing, target_user)

    membership = TeamMember(
        team_id=team_id,
        member_id=schema.user_id,
        role=schema.role,
        is_active=True,
    )
    membership = await member_repo.create(membership)
    await session.flush()
    return _build_member_response(membership, target_user)


async def update_member_role(
    team_id: int,
    user_id: int,
    schema: UpdateMemberRoleRequest,
    session: AsyncSession,
) -> MemberResponse:
    """Updates a team member's role with orphan administrator protection.

    Args:
        team_id: Target team integer ID.
        user_id: Target user integer primary key.
        schema: Validated new role.
        session: Active asynchronous database session.

    Returns:
        Updated MemberResponse.

    Raises:
        NotFoundException: If membership record is not found.
        BusinessRuleViolationException: If demoting the sole remaining administrator.
    """
    member_repo = TeamMemberRepository(session=session)
    membership = await member_repo.get_membership(member_id=user_id, team_id=team_id)
    if membership is None:
        raise NotFoundException(entity="TeamMember", identifier=f"User {user_id} in Team {team_id}")

    # Guard: Prevent demoting the last remaining admin
    if membership.role == TeamRole.ADMIN and schema.role != TeamRole.ADMIN:
        admin_count = await member_repo.count_active_admins(team_id)
        if admin_count <= 1:
            raise BusinessRuleViolationException(
                message="Cannot remove or demote the sole team administrator.",
                error_code="LAST_ADMIN_CANNOT_BE_REMOVED",
            )

    membership = await member_repo.update(membership, {"role": schema.role})
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_id(user_id)
    return _build_member_response(membership, user)


async def remove_member(
    team_id: int,
    user_id: int,
    session: AsyncSession,
) -> None:
    """Removes a member from a team with sole administrator protection.

    Args:
        team_id: Target team integer ID.
        user_id: Target user integer primary key.
        session: Active asynchronous database session.

    Raises:
        NotFoundException: If membership does not exist.
        BusinessRuleViolationException: If removing the sole remaining administrator.
    """
    member_repo = TeamMemberRepository(session=session)
    membership = await member_repo.get_membership(member_id=user_id, team_id=team_id)
    if membership is None:
        raise NotFoundException(entity="TeamMember", identifier=f"User {user_id} in Team {team_id}")

    if membership.role == TeamRole.ADMIN:
        admin_count = await member_repo.count_active_admins(team_id)
        if admin_count <= 1:
            raise BusinessRuleViolationException(
                message="Cannot remove the sole team leader.",
                error_code="LAST_ADMIN_CANNOT_BE_REMOVED",
            )

    await member_repo.delete(membership)


async def list_team_members(
    team_id: int,
    session: AsyncSession,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[MemberResponse]:
    """Retrieves paginated members enrolled in the specified team workspace.

    Args:
        team_id: Team integer ID.
        session: Active asynchronous database session.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of MemberResponse instances.
    """
    member_repo = TeamMemberRepository(session=session)
    page = await member_repo.get_team_members(team_id=team_id, offset=offset, limit=limit)

    return PageResult(
        items=[_build_member_response(m) for m in page.items],
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )
