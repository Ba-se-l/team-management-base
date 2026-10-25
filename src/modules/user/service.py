"""User domain service layer.

Contains all business logic for user profile management operations.
Each public function acts as an orchestrator that delegates data access
to ``UserRepository`` and applies domain rules.
"""

from sqlalchemy.ext.asyncio import AsyncSession
import secrets

from src.exc import AlreadyExistsException, InvalidCredentialsException
from src.security import hash_password, verify_password
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


async def create_user(schema: CreateUserRequest, session: AsyncSession) -> User:
    """Provisions a new user in the platform.

    Args:
        schema: Validated user creation request schema.
        session: Active asynchronous database session.

    Returns:
        The created User ORM instance.

    Raises:
        AlreadyExistsException: If email or username is already taken.
    """
    user_repo = UserRepository(session=session)

    existing_by_email = await user_repo.get_by_email(schema.email)
    if existing_by_email is not None:
        raise AlreadyExistsException(entity="User", field="email", value=schema.email)

    target_username = schema.username or schema.email.split("@")[0].lower()
    existing_by_username = await user_repo.get_one_by_attribute(username=target_username)
    if existing_by_username is not None:
        if schema.username:
            raise AlreadyExistsException(entity="User", field="username", value=schema.username)
        target_username = f"{target_username}_{secrets.token_hex(3)}"

    hashed = hash_password(schema.password)
    user = User(
        name=schema.name,
        username=target_username,
        email=schema.email,
        hashed_password=hashed,
        is_active=True,
        is_super_admin=schema.is_super_admin,
        job_title=schema.job_title,
        status=UserStatus.ONLINE,
    )

    created_user = await user_repo.create(user)
    await session.flush()
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
    """Soft-deletes a user by deactivating their account.

    Sets ``is_active`` to ``False`` and ``status`` to ``OFFLINE``.
    The user record remains in the database for referential integrity.

    Args:
        user_id: The integer ID of the user to deactivate.
        session: The active database session.

    Returns:
        The soft-deleted ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
    """
    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    user = await _get_user(user_id=user_id, session=session)

    # Step 2: Deactivate via update
    soft_deleted_user = await user_repo.update(
        instance=user,
        update_data={'is_active': False, 'status': UserStatus.OFFLINE},
    )

    return soft_deleted_user


async def list_users(skip: int, limit: int, session: AsyncSession) -> list[User]:
    """Lists all active users with pagination.

    Args:
        skip: Number of records to skip.
        limit: Maximum number of records to return.
        session: The active database session.

    Returns:
        A list of active ``User`` ORM instances.
    """
    user_repo = UserRepository(session=session)

    return await user_repo.get_active_users(skip=skip, limit=limit)


async def change_password(user_id: int, schema: ChangePasswordRequest, session: AsyncSession) -> User:
    """Changes a user's password after verifying the old one.

    The old password is verified against the stored hash. If it matches,
    the new password is hashed and stored.

    Args:
        user_id: The UUID of the user changing their password.
        schema: The request containing ``old_password`` and ``new_password``.
        session: The active database session.

    Returns:
        The updated ``User`` ORM instance.

    Raises:
        UserNotFoundException: If the user does not exist.
        InvalidCredentialsException: If the old password does not match.
    """
    user_repo = UserRepository(session=session)

    # Step 1: Fetch the user or raise
    user = await _get_user(user_id=user_id, session=session)

    # Step 2: Verify the old password matches
    is_password_match = verify_password(
        plain_password=schema.old_password,
        hashed_password=user.hashed_password,
    )

    if not is_password_match:
        raise InvalidCredentialsException()

    # Step 3: Hash the new password
    hashed_password = hash_password(plain_password=schema.new_password)

    # Step 4: Update via repository
    updated_user = await user_repo.update(
        instance=user,
        update_data={'hashed_password': hashed_password},
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