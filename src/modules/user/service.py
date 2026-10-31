"""User domain service layer.

Contains all business logic for user profile management operations.
Each public function acts as an orchestrator that delegates data access
to ``UserRepository`` and applies domain rules.
"""

from sqlalchemy.ext.asyncio import AsyncSession
import secrets

from src.exc import (
    AlreadyExistsException,
    BusinessRuleViolationException,
    ForbiddenException,
    InvalidCredentialsException,
)
from src.security import hash_password_async, verify_password_async
from src.share.event_bus import event_bus
from src.share.schemas import AuditEvent
from src.database import UserStatus
from .models import User
from .schemas import (
    ChangePasswordRequest,
    CreateUserRequest,
    DeveloperDashboardResponse,
    UpdateSchemaRequest,
)
from .repository import UserRepository
from .exceptions import UserNotFoundException


async def _get_user(user_id: int, session: AsyncSession) -> User:
    """Internal helper: fetches a user by ID or raises.

    Args:
        user_id: The integer ID of the user to fetch.
        session: The active database session.

    Returns:
        The ``User`` ORM instance.

    Raises:
        UserNotFoundException: If no user with the given ID exists.
    """
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_id(id=user_id)

    if user is None:
        raise UserNotFoundException(identifier=str(user_id))

    return user


async def create_user(
    schema: CreateUserRequest,
    session: AsyncSession,
    actor_id: int | None = None,
) -> User:
    """Provisions a new user in the platform.

    Args:
        schema: Validated user creation request schema.
        session: Active asynchronous database session.
        actor_id: Optional ID of the administrator creating the user.

    Returns:
        The created User ORM instance.

    Raises:
        AlreadyExistsException: If email or username is already taken.
    """
    user_repo = UserRepository(session=session)
    normalized_email = str(schema.email).strip().lower()

    existing_by_email = await user_repo.get_by_email(normalized_email)
    if existing_by_email is not None:
        raise AlreadyExistsException(entity="User", field="email", value=normalized_email)

    target_username = schema.username or normalized_email.split("@")[0].lower()
    existing_by_username = await user_repo.get_one_by_attribute(username=target_username)
    if existing_by_username is not None:
        if schema.username:
            raise AlreadyExistsException(entity="User", field="username", value=schema.username)
        target_username = f"{target_username}_{secrets.token_hex(3)}"

    hashed = await hash_password_async(schema.password)
    user = User(
        name=schema.name,
        username=target_username,
        email=normalized_email,
        hashed_password=hashed,
        is_active=True,
        is_public_member=schema.is_public_member,
        is_super_admin=schema.is_super_admin,
        job_title=schema.job_title,
        bio=schema.bio,
        avatar_url=schema.avatar_url,
        github_url=schema.github_url,
        linkedin_url=schema.linkedin_url,
        website_url=schema.website_url,
        status=UserStatus.ONLINE,
    )

    created_user = await user_repo.create(user)
    await session.flush()

    await event_bus.publish(
        AuditEvent(
            action="USER_CREATED",
            entity_type="User",
            entity_id=str(created_user.id),
            user_id=actor_id or created_user.id,
        ),
        session=session,
    )
    return created_user


async def update_user(user_id: int, schema: UpdateSchemaRequest, session: AsyncSession) -> User:
    """Updates a user's profile fields.

    Only fields explicitly provided in the request (non-``None``) are
    updated. Unset fields are excluded via ``exclude_unset=True``.

    Args:
        user_id: The UUID of the user to update.
        schema: The validated update request containing optional fields.
        session: The active database session.

    Returns:
        The updated ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
    """
    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    old_user = await _get_user(user_id=user_id, session=session)

    # Step 2: Build update dict from provided fields only
    update_data = schema.model_dump(exclude_unset=True)

    # Step 3: Apply the update via repository
    updated_user = await user_repo.update(instance=old_user, update_data=update_data)

    return updated_user


async def soft_delete_user(user_id: int, session: AsyncSession) -> User:
    """Soft-deletes a user by deactivating their account with sole-admin governance guards.

    Sets ``is_active`` to ``False``, ``is_public_member`` to ``False``,
    increments ``security_version``, and revokes all active refresh sessions.

    Args:
        user_id: The integer ID of the user to deactivate.
        session: The active database session.

    Returns:
        The soft-deleted ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
        BusinessRuleViolationException: If the user is the last active Super Admin or sole Team Admin.
    """
    from sqlalchemy import select
    from src.database.enums import TeamRole
    from src.modules.auth.repo import RefreshSessionRepository
    from src.modules.team.models import Team
    from src.modules.team_members.models import TeamMember
    from src.modules.team_members.repository import TeamMemberRepository

    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    user = await _get_user(user_id=user_id, session=session)
    if not user.is_active:
        return user

    # Step 2: Prevent deactivating the last active Super Admin
    if user.is_super_admin:
        active_super_admins = await user_repo.count_active_super_admins()
        if active_super_admins <= 1:
            raise BusinessRuleViolationException(
                message="Cannot deactivate the last active Super Admin on the platform.",
                error_code="LAST_SUPER_ADMIN",
            )

    # Step 3: Prevent deactivating the sole active Team Admin of any active team
    tm_repo = TeamMemberRepository(session=session)
    admin_teams_stmt = (
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(
            TeamMember.member_id == user.id,
            TeamMember.is_active.is_(True),
            TeamMember.role == TeamRole.ADMIN,
            Team.is_active.is_(True),
        )
    )
    admin_teams = list((await session.execute(admin_teams_stmt)).scalars().all())
    for team in admin_teams:
        active_admins = await tm_repo.count_active_admins(team.id)
        if active_admins <= 1:
            raise BusinessRuleViolationException(
                message=f"Cannot deactivate account: sole active administrator of team '{team.name}'.",
                error_code="LAST_ADMIN_CANNOT_BE_REMOVED",
            )

    # Step 4: Deactivate, bump security_version, and revoke all refresh sessions
    soft_deleted_user = await user_repo.update(
        instance=user,
        update_data={
            "is_active": False,
            "is_public_member": False,
            "status": UserStatus.OFFLINE,
            "security_version": (user.security_version or 1) + 1,
        },
    )

    refresh_repo = RefreshSessionRepository(session=session)
    await refresh_repo.revoke_all_for_user(user_id=user.id)
    await session.flush()

    await event_bus.publish(
        AuditEvent(
            action="USER_DEACTIVATED",
            entity_type="User",
            entity_id=str(user.id),
            user_id=user.id,
        ),
        session=session,
    )

    return soft_deleted_user


async def list_users(
    skip: int,
    limit: int,
    session: AsyncSession,
    current_user: User | None = None,
) -> list[User]:
    """Lists all active users with pagination. Restricted to Super Admins or active Team Admins.

    Args:
        skip: Number of records to skip.
        limit: Maximum number of records to return.
        session: The active database session.
        current_user: Optional authenticated user enforcing directory visibility policy.

    Returns:
        A list of active ``User`` ORM instances.
    """
    if current_user is not None and not current_user.is_super_admin:
        from sqlalchemy import func, select
        from src.database.enums import TeamRole
        from src.modules.team.models import Team
        from src.modules.team_members.models import TeamMember

        admin_check_stmt = (
            select(func.count(TeamMember.team_id))
            .join(Team, Team.id == TeamMember.team_id)
            .where(
                TeamMember.member_id == current_user.id,
                TeamMember.is_active.is_(True),
                TeamMember.role == TeamRole.ADMIN,
                Team.is_active.is_(True),
            )
        )
        is_team_admin = (await session.scalar(admin_check_stmt) or 0) > 0
        if not is_team_admin:
            raise ForbiddenException(
                message="Only super administrators or active team administrators can list platform users.",
                error_code="INSUFFICIENT_PERMISSIONS",
            )

    user_repo = UserRepository(session=session)
    return await user_repo.get_active_users(skip=skip, limit=limit)


async def change_password(user_id: int, schema: ChangePasswordRequest, session: AsyncSession) -> User:
    """Changes a user's password, increments security_version, and revokes all refresh sessions.

    Args:
        user_id: The integer ID of the user changing their password.
        schema: The request containing ``old_password`` and ``new_password``.
        session: The active database session.

    Returns:
        The updated ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
        InvalidCredentialsException: If the old password does not match.
        BusinessRuleViolationException: If the new password matches the old password.
    """
    from src.modules.auth.repo import RefreshSessionRepository

    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    user = await _get_user(user_id=user_id, session=session)

    # Step 2: Verify the old password matches
    is_password_match = await verify_password_async(
        plain_password=schema.old_password,
        hashed_password=user.hashed_password,
    )

    if not is_password_match:
        raise InvalidCredentialsException()

    if schema.old_password == schema.new_password:
        raise BusinessRuleViolationException(
            message="New password cannot be identical to the current password.",
            error_code="SAME_PASSWORD",
        )

    # Step 3: Hash the new password
    hashed_password = await hash_password_async(plain_password=schema.new_password)

    # Step 4: Update password, increment security_version, and revoke all refresh sessions
    updated_user = await user_repo.update(
        instance=user,
        update_data={
            "hashed_password": hashed_password,
            "security_version": (user.security_version or 1) + 1,
        },
    )

    refresh_repo = RefreshSessionRepository(session=session)
    await refresh_repo.revoke_all_for_user(user_id=user.id)
    await session.flush()

    await event_bus.publish(
        AuditEvent(
            action="USER_PASSWORD_CHANGED",
            entity_type="User",
            entity_id=str(user.id),
            user_id=user.id,
        ),
        session=session,
    )

    return updated_user


async def get_developer_dashboard(
    user_id: int,
    session: AsyncSession,
) -> DeveloperDashboardResponse:
    """Calculates aggregated performance and workload statistics for a developer.

    Args:
        user_id: User integer primary key.
        session: Active asynchronous database session.

    Returns:
        DeveloperDashboardResponse containing task status breakdowns and team/project counts.
    """
    from sqlalchemy import func, select
    from src.database.enums import TaskStatus
    from src.modules.project.models import Project
    from src.modules.task.models import Task
    from src.modules.team_members.models import TeamMember

    # 1. Active teams count
    teams_stmt = select(func.count(TeamMember.team_id)).where(
        TeamMember.member_id == user_id,
        TeamMember.is_active.is_(True),
    )
    teams_count = await session.scalar(teams_stmt) or 0

    # 2. Active accessible projects count
    projects_stmt = (
        select(func.count(func.distinct(Project.id)))
        .join(TeamMember, TeamMember.team_id == Project.team_id)
        .where(
            TeamMember.member_id == user_id,
            TeamMember.is_active.is_(True),
            Project.is_active.is_(True),
        )
    )
    projects_count = await session.scalar(projects_stmt) or 0

    # 3. Tasks assigned to user within active teams
    tasks_query = (
        select(Task.status, func.count(Task.id))
        .join(Project, Project.id == Task.project_id)
        .join(
            TeamMember,
            (TeamMember.team_id == Project.team_id)
            & (TeamMember.member_id == user_id)
            & (TeamMember.is_active.is_(True)),
        )
        .where(
            Task.assignee_to_id == user_id,
            Task.is_active.is_(True),
            Project.is_active.is_(True),
        )
        .group_by(Task.status)
    )
    task_counts_res = await session.execute(tasks_query)
    status_counts = dict(task_counts_res.all())

    pending = status_counts.get(TaskStatus.TODO, 0)
    in_progress = status_counts.get(TaskStatus.IN_PROGRESS, 0)
    review = status_counts.get(TaskStatus.IN_REVIEW, 0)
    completed = status_counts.get(TaskStatus.DONE, 0)
    total_assigned = pending + in_progress + review + completed

    # 4. Overdue tasks
    overdue_stmt = (
        select(func.count(Task.id))
        .join(Project, Project.id == Task.project_id)
        .join(
            TeamMember,
            (TeamMember.team_id == Project.team_id)
            & (TeamMember.member_id == user_id)
            & (TeamMember.is_active.is_(True)),
        )
        .where(
            Task.assignee_to_id == user_id,
            Task.is_active.is_(True),
            Project.is_active.is_(True),
            Task.status != TaskStatus.DONE,
            Task.deadline.is_not(None),
            Task.deadline < func.now(),
        )
    )
    overdue = await session.scalar(overdue_stmt) or 0

    return DeveloperDashboardResponse(
        total_assigned_tasks=total_assigned,
        pending_tasks=pending,
        in_progress_tasks=in_progress,
        review_tasks=review,
        completed_tasks=completed,
        overdue_tasks=overdue,
        active_teams_count=teams_count,
        active_projects_count=projects_count,
    )