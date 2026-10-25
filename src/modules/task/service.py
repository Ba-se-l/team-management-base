"""Task domain service orchestrating work items, Kanban boards, and comments."""

from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import TaskStatus, TeamRole
from src.exc import BusinessRuleViolationException, ForbiddenException, NotFoundException
from src.modules.task.models import Task, TaskComment
from src.modules.user.models import User
from src.share import AuditEvent, event_bus
from src.share.responses import PageResult
from .repository import TaskRepository
from .schemas import (
    CreateCommentRequest,
    CreateTaskRequest,
    KanbanBoardResponse,
    MoveTaskRequest,
    TaskCommentResponse,
    TaskResponse,
    UpdateTaskRequest,
)


def _build_comment_response(comment: TaskComment) -> TaskCommentResponse:
    """Builds a hydrated TaskCommentResponse with author profile data."""
    author = getattr(comment, "author", None)
    return TaskCommentResponse(
        id=comment.id,
        task_id=comment.task_id,
        author_id=comment.author_id,
        author_name=author.name if author else None,
        author_username=author.username if author else None,
        author_avatar_url=author.avatar_url if author else None,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


def _build_task_response(task: Task) -> TaskResponse:
    """Builds a hydrated TaskResponse with author, assignee, and threaded comments."""
    creator = getattr(task, "created_by", None)
    assignee = getattr(task, "assignee_to", None)
    raw_comments = getattr(task, "comments", []) or []

    comments_hydrated = [_build_comment_response(c) for c in raw_comments]

    return TaskResponse(
        id=task.id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        position=task.position,
        deadline=task.deadline,
        completed_at=task.completed_at,
        is_active=task.is_active,
        creator_id=task.creator_id,
        creator_username=creator.username if creator else None,
        assignee_to_id=task.assignee_to_id,
        assignee_username=assignee.username if assignee else None,
        assignee_name=assignee.name if assignee else None,
        assignee_avatar_url=assignee.avatar_url if assignee else None,
        project_id=task.project_id,
        comments_count=len(comments_hydrated),
        comments=comments_hydrated,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def _validate_assignee_in_team(
    team_id: int,
    assignee_id: int | None,
    session: AsyncSession,
) -> None:
    """Verifies that the target assignee exists and belongs to the owning team.

    Args:
        team_id: Owning team integer ID.
        assignee_id: Optional user integer ID to assign.
        session: Active asynchronous database session.

    Raises:
        NotFoundException: If user does not exist.
        BusinessRuleViolationException: If user is not an active member of the team.
    """
    if assignee_id is None:
        return

    from src.modules.user.repository import UserRepository
    from src.modules.team_members.repository import TeamMemberRepository

    user_repo = UserRepository(session=session)
    assignee = await user_repo.get_by_id(assignee_id)
    if assignee is None:
        raise NotFoundException(entity="User", identifier=assignee_id)

    tm_repo = TeamMemberRepository(session=session)
    membership = await tm_repo.get_membership(member_id=assignee_id, team_id=team_id)
    if membership is None or not membership.is_active:
        raise BusinessRuleViolationException(
            f"Cannot assign task to user {assignee_id} who is not an active member of team {team_id}.",
            error_code="ASSIGNEE_NOT_IN_TEAM",
        )


async def _validate_task_ownership(
    task: Task,
    current_user: User,
    team_id: int,
    session: AsyncSession,
) -> None:
    """Enforces ABAC ownership rule: Developers can only modify/move their own tasks.

    Super administrators and team leaders (ADMIN role) have unrestricted access.
    Developers (DEVELOPER role) can only modify or transition tasks assigned to them,
    tasks they established, or unassigned tasks.

    Args:
        task: Target Task entity.
        current_user: Authenticated caller.
        team_id: Owning team integer ID.
        session: Active asynchronous database session.

    Raises:
        ForbiddenException: If developer lacks ownership of the task.
    """
    if current_user.is_super_admin:
        return

    from src.database.enums import TeamRole
    from src.modules.team_members.repository import TeamMemberRepository

    tm_repo = TeamMemberRepository(session=session)
    membership = await tm_repo.get_membership(member_id=current_user.id, team_id=team_id)
    if membership is None or not membership.is_active:
        raise ForbiddenException(
            "You are not an active member of this project's team.",
            error_code="NOT_A_TEAM_MEMBER",
        )

    if membership.role == TeamRole.ADMIN:
        return

    is_owner = (
        task.assignee_to_id == current_user.id
        or task.creator_id == current_user.id
        or task.assignee_to_id is None
    )
    if not is_owner:
        raise ForbiddenException(
            "You can only modify or transition tasks assigned to you.",
            error_code="TASK_OWNERSHIP_REQUIRED",
        )


async def create_task(
    project_id: int,
    schema: CreateTaskRequest,
    creator: User,
    session: AsyncSession,
) -> TaskResponse:
    """Creates a task within a project, validating assignee team membership.

    Args:
        project_id: Project integer ID.
        schema: Validated task creation request.
        creator: Authenticated user.
        session: Active asynchronous database session.

    Returns:
        Hydrated TaskResponse.

    Raises:
        NotFoundException: If project or assignee does not exist.
        BusinessRuleViolationException: If assignee does not belong to project team.
    """
    from src.modules.project.repository import ProjectRepository

    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id(project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=project_id)

    # Validate assignee belongs to the project's owning team
    if schema.assignee_to_id is not None:
        await _validate_assignee_in_team(
            team_id=project.team_id,
            assignee_id=schema.assignee_to_id,
            session=session,
        )

    task_repo = TaskRepository(session=session)

    # Position at end of chosen status column if not specified
    if schema.position is not None:
        pos = schema.position
    else:
        pos = await task_repo.get_next_position(project_id=project_id, status=schema.status)

    task = Task(
        title=schema.title,
        description=schema.description,
        status=schema.status,
        priority=schema.priority,
        position=pos,
        deadline=schema.deadline,
        project_id=project_id,
        creator_id=creator.id,
        assignee_to_id=schema.assignee_to_id,
    )
    task = await task_repo.create(task)
    await session.flush()

    hydrated = await task_repo.get_task_with_details(task.id)

    await event_bus.publish(
        AuditEvent(
            action="TASK_CREATED",
            entity_type="Task",
            entity_id=str(task.id),
            user_id=creator.id,
            changes_payload={"title": task.title, "status": task.status.value, "project_id": project_id},
        ),
        session=session,
    )

    return _build_task_response(hydrated or task)


async def get_task(
    task_id: int,
    session: AsyncSession,
) -> TaskResponse:
    """Retrieves a task with author, assignee, and comments.

    Args:
        task_id: Task integer primary key.
        session: Active asynchronous database session.

    Returns:
        Hydrated TaskResponse.

    Raises:
        NotFoundException: If task is not found.
    """
    task_repo = TaskRepository(session=session)
    task = await task_repo.get_task_with_details(task_id)
    if task is None:
        raise NotFoundException(entity="Task", identifier=task_id)

    return _build_task_response(task)


async def move_task(
    task_id: int,
    schema: MoveTaskRequest,
    session: AsyncSession,
    current_user: User | None = None,
) -> TaskResponse:
    """Updates a task's status and relative column position with atomic shifting and ABAC validation.

    Args:
        task_id: Target task integer ID.
        schema: Target status column and new numeric position.
        session: Active asynchronous database session.
        current_user: Optional authenticated user for ownership enforcement.

    Returns:
        Updated TaskResponse with adjusted completed_at timestamp.

    Raises:
        NotFoundException: If task or project is not found.
        ForbiddenException: If developer attempts to move a task they do not own.
    """
    from src.modules.project.repository import ProjectRepository

    task_repo = TaskRepository(session=session)
    task = await task_repo.get_by_id(task_id)
    if task is None:
        raise NotFoundException(entity="Task", identifier=task_id)

    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id(task.project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=task.project_id)

    # Enforce ABAC ownership if user context is provided
    if current_user is not None:
        await _validate_task_ownership(
            task=task,
            current_user=current_user,
            team_id=project.team_id,
            session=session,
        )

    old_status = task.status
    old_pos = task.position
    new_status = schema.status
    new_pos = schema.position

    # Atomic position shifting to guarantee ordering integrity
    if old_status == new_status:
        if new_pos > old_pos:
            await task_repo.shift_positions_between(
                project_id=task.project_id,
                status=old_status,
                start_pos=old_pos + 0.001,
                end_pos=new_pos,
                delta=-1000.0,
            )
        elif new_pos < old_pos:
            await task_repo.shift_positions_between(
                project_id=task.project_id,
                status=old_status,
                start_pos=new_pos,
                end_pos=old_pos - 0.001,
                delta=1000.0,
            )
    else:
        # Relocating to a different status column
        await task_repo.shift_positions_after(
            project_id=task.project_id,
            status=old_status,
            from_pos=old_pos + 0.001,
            delta=-1000.0,
        )
        await task_repo.shift_positions_after(
            project_id=task.project_id,
            status=new_status,
            from_pos=new_pos,
            delta=1000.0,
        )

    completed_at = task.completed_at
    if new_status == TaskStatus.DONE and old_status != TaskStatus.DONE:
        completed_at = datetime.now(timezone.utc)
    elif new_status != TaskStatus.DONE and old_status == TaskStatus.DONE:
        completed_at = None

    await task_repo.update(
        task,
        {
            "status": new_status,
            "position": new_pos,
            "completed_at": completed_at,
        },
    )

    hydrated = await task_repo.get_task_with_details(task.id)

    await event_bus.publish(
        AuditEvent(
            action="TASK_MOVED",
            entity_type="Task",
            entity_id=str(task.id),
            user_id=current_user.id if current_user else None,
            changes_payload={
                "old_status": old_status.value,
                "new_status": new_status.value,
                "old_position": old_pos,
                "new_position": new_pos,
            },
        ),
        session=session,
    )

    return _build_task_response(hydrated or task)


async def update_task(
    task_id: int,
    schema: UpdateTaskRequest,
    session: AsyncSession,
    current_user: User | None = None,
) -> TaskResponse:
    """Updates general task attributes and status with ABAC ownership and team assignee checks.

    Args:
        task_id: Target task integer ID.
        schema: Validated fields to update.
        session: Active asynchronous database session.
        current_user: Optional authenticated user for ownership enforcement.

    Returns:
        Updated TaskResponse.

    Raises:
        NotFoundException: If task or project is not found.
        ForbiddenException: If developer attempts to update a task they do not own.
        BusinessRuleViolationException: If assigned user does not belong to project team.
    """
    from src.modules.project.repository import ProjectRepository

    task_repo = TaskRepository(session=session)
    task = await task_repo.get_by_id(task_id)
    if task is None:
        raise NotFoundException(entity="Task", identifier=task_id)

    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id(task.project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=task.project_id)

    if current_user is not None:
        await _validate_task_ownership(
            task=task,
            current_user=current_user,
            team_id=project.team_id,
            session=session,
        )

    update_dict = schema.model_dump(exclude_unset=True)

    # Validate assignee belongs to the project's owning team
    if "assignee_to_id" in update_dict and update_dict["assignee_to_id"] is not None:
        await _validate_assignee_in_team(
            team_id=project.team_id,
            assignee_id=update_dict["assignee_to_id"],
            session=session,
        )

    if "status" in update_dict:
        new_status = update_dict["status"]
        if new_status == TaskStatus.DONE and task.status != TaskStatus.DONE:
            update_dict["completed_at"] = datetime.now(timezone.utc)
        elif new_status != TaskStatus.DONE and task.status == TaskStatus.DONE:
            update_dict["completed_at"] = None

    await task_repo.update(task, update_dict)
    hydrated = await task_repo.get_task_with_details(task.id)
    return _build_task_response(hydrated or task)


async def delete_task(
    task_id: int,
    session: AsyncSession,
) -> None:
    """Deletes a task and cascades removal of comments.

    Args:
        task_id: Target task integer ID.
        session: Active asynchronous database session.

    Raises:
        NotFoundException: If task is not found.
    """
    task_repo = TaskRepository(session=session)
    task = await task_repo.get_by_id(task_id)
    if task is None:
        raise NotFoundException(entity="Task", identifier=task_id)

    await task_repo.delete(task)


async def get_kanban_board(
    project_id: int,
    session: AsyncSession,
) -> KanbanBoardResponse:
    """Builds the full Kanban board view with tasks grouped into columns and sorted by position.

    Args:
        project_id: Project integer ID.
        session: Active asynchronous database session.

    Returns:
        KanbanBoardResponse grouping tasks into each workflow column.

    Raises:
        NotFoundException: If project is not found.
    """
    from src.modules.project.repository import ProjectRepository

    project_repo = ProjectRepository(session=session)
    project = await project_repo.get_by_id(project_id)
    if project is None:
        raise NotFoundException(entity="Project", identifier=project_id)

    task_repo = TaskRepository(session=session)
    tasks = await task_repo.get_project_tasks_ordered(project_id=project_id)

    columns: dict[TaskStatus, list[TaskResponse]] = {st: [] for st in TaskStatus}
    for t in tasks:
        if t.status in columns:
            columns[t.status].append(_build_task_response(t))

    return KanbanBoardResponse(
        project_id=project.id,
        project_title=project.title,
        columns=columns,
    )


async def list_tasks(
    project_id: int,
    session: AsyncSession,
    status: TaskStatus | None = None,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[TaskResponse]:
    """Retrieves paginated tasks inside a project.

    Args:
        project_id: Project integer ID.
        session: Active asynchronous database session.
        status: Optional TaskStatus filter.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of TaskResponse instances.
    """
    task_repo = TaskRepository(session=session)
    page = await task_repo.paginate_project_tasks(
        project_id=project_id,
        status=status,
        offset=offset,
        limit=limit,
    )
    return PageResult(
        items=[_build_task_response(t) for t in page.items],
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )


async def add_comment(
    task_id: int,
    schema: CreateCommentRequest,
    author: User,
    session: AsyncSession,
) -> TaskCommentResponse:
    """Adds a discussion comment to a task.

    Args:
        task_id: Target task integer ID.
        schema: Request containing comment content.
        author: Authenticated author.
        session: Active asynchronous database session.

    Returns:
        Hydrated TaskCommentResponse.

    Raises:
        NotFoundException: If task does not exist.
    """
    task_repo = TaskRepository(session=session)
    task = await task_repo.get_by_id(task_id)
    if task is None:
        raise NotFoundException(entity="Task", identifier=task_id)

    comment = await task_repo.add_comment(
        task_id=task_id,
        author_id=author.id,
        content=schema.content,
    )
    return _build_comment_response(comment)


async def delete_comment(
    comment_id: int,
    current_user: User,
    session: AsyncSession,
) -> None:
    """Deletes a discussion comment (author, team admin, or super admin only).

    Args:
        comment_id: Comment integer primary key.
        current_user: Authenticated requester.
        session: Active asynchronous database session.

    Raises:
        NotFoundException: If comment does not exist.
        ForbiddenException: If requester lacks authority to delete comment.
    """
    task_repo = TaskRepository(session=session)
    comment = await task_repo.get_comment(comment_id)
    if comment is None:
        raise NotFoundException(entity="TaskComment", identifier=comment_id)

    if current_user.is_super_admin or comment.author_id == current_user.id:
        await task_repo.delete_comment(comment)
        return

    # Check if user is an ADMIN of the team owning this project/task
    task = await task_repo.get_by_id(comment.task_id)
    if task is not None:
        from src.modules.project.repository import ProjectRepository
        from src.modules.team_members.repository import TeamMemberRepository

        project_repo = ProjectRepository(session=session)
        project = await project_repo.get_by_id(task.project_id)
        if project is not None:
            member_repo = TeamMemberRepository(session=session)
            membership = await member_repo.get_membership(
                member_id=current_user.id,
                team_id=project.team_id,
            )
            if membership is not None and membership.role == TeamRole.ADMIN:
                await task_repo.delete_comment(comment)
                return

    raise ForbiddenException(
        message="Cannot delete comments authored by other developers.",
        error_code="PERMISSION_DENIED",
    )


async def list_my_tasks(
    user_id: int,
    session: AsyncSession,
    offset: int = 0,
    limit: int = 50,
) -> PageResult[TaskResponse]:
    """Retrieves all active tasks assigned to the caller across their active teams.

    Args:
        user_id: Assignee user integer ID.
        session: Active asynchronous database session.
        offset: Record offset.
        limit: Limit per page.

    Returns:
        PageResult of hydrated TaskResponse instances.
    """
    task_repo = TaskRepository(session=session)
    page = await task_repo.get_user_assigned_tasks(user_id=user_id, offset=offset, limit=limit)
    return PageResult(
        items=[_build_task_response(t) for t in page.items],
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )
