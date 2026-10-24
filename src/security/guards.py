from __future__ import annotations

from collections.abc import Callable
from typing import Any
from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_session
from src.exc import ForbiddenException, NotFoundException
from src.modules.auth.dependencies import get_current_user
from src.modules.user.models import User
from src.security.authorization import check_permission


async def require_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Guarantees that the authenticated requester possesses super administrator privileges.

    Args:
        current_user: Authenticated User instance.

    Returns:
        Verified super administrator User.

    Raises:
        ForbiddenException: If the user is not a super administrator.
    """
    if not current_user.is_super_admin:
        raise ForbiddenException(
            message="Super administrator privileges are required.",
            error_code="SUPER_ADMIN_REQUIRED",
        )
    return current_user


async def _resolve_team_id_from_request(
    request: Request,
    session: AsyncSession,
) -> int:
    """Extracts or resolves the target team workspace ID from request path parameters.

    Args:
        request: Incoming HTTP request.
        session: Active async database session.

    Returns:
        Target team integer ID.

    Raises:
        NotFoundException: If an explicit resource path identifier cannot be found.
        ForbiddenException: If no team context can be determined from the route.
    """
    from src.modules.project.models import Project
    from src.modules.task.models import Task, TaskComment
    from src.modules.team.models import Team

    path_params = request.path_params

    # 1. Direct team identifier in path (integer ID or slug)
    if "team_id" in path_params:
        val = str(path_params["team_id"])
        if val.isdigit():
            return int(val)
        stmt = select(Team.id).where(Team.slug == val)
        result = await session.scalar(stmt)
        if result is None:
            raise NotFoundException(entity="Team", identifier=val)
        return int(result)

    if "team_slug" in path_params:
        slug = str(path_params["team_slug"])
        stmt = select(Team.id).where(Team.slug == slug)
        result = await session.scalar(stmt)
        if result is None:
            raise NotFoundException(entity="Team", identifier=slug)
        return int(result)

    # 2. Indirect via project in path (integer ID or slug)
    if "project_id" in path_params:
        val = str(path_params["project_id"])
        if val.isdigit():
            stmt = select(Project.team_id).where(Project.id == int(val))
        else:
            stmt = select(Project.team_id).where(Project.slug == val)
        team_id = await session.scalar(stmt)
        if team_id is None:
            raise NotFoundException(entity="Project", identifier=val)
        return int(team_id)

    if "project_slug" in path_params:
        slug = str(path_params["project_slug"])
        stmt = select(Project.team_id).where(Project.slug == slug)
        team_id = await session.scalar(stmt)
        if team_id is None:
            raise NotFoundException(entity="Project", identifier=slug)
        return int(team_id)

    # 3. Indirect via task in path
    if "task_id" in path_params:
        try:
            task_id = int(path_params["task_id"])
        except (ValueError, TypeError):
            raise ForbiddenException("Invalid task identifier format.", error_code="INVALID_TASK_ID")
        stmt = (
            select(Project.team_id)
            .join(Task, Task.project_id == Project.id)
            .where(Task.id == task_id)
        )
        team_id = await session.scalar(stmt)
        if team_id is None:
            raise NotFoundException(entity="Task", identifier=task_id)
        return int(team_id)

    # 4. Indirect via comment in path
    if "comment_id" in path_params:
        try:
            cid = int(path_params["comment_id"])
        except (ValueError, TypeError):
            raise ForbiddenException("Invalid comment identifier format.", error_code="INVALID_COMMENT_ID")
        stmt = (
            select(Project.team_id)
            .join(Task, Task.project_id == Project.id)
            .join(TaskComment, TaskComment.task_id == Task.id)
            .where(TaskComment.id == cid)
        )
        team_id = await session.scalar(stmt)
        if team_id is None:
            raise NotFoundException(entity="TaskComment", identifier=cid)
        return int(team_id)

    raise ForbiddenException(
        message="Cannot determine team workspace context for request.",
        error_code="TEAM_CONTEXT_MISSING",
    )


def require_team_permission(
    obj: str,
    act: str,
) -> Callable[..., Any]:
    """Dependency factory enforcing Casbin RBAC within a dynamic team workspace domain.

    Args:
        obj: Target resource type (e.g. 'team', 'project', 'task', 'comment', 'member').
        act: Requested operation (e.g. 'create', 'read', 'update', 'delete').

    Returns:
        FastAPI async dependency callable returning the authenticated user.
    """

    async def _guard(
        request: Request,
        session: AsyncSession = Depends(get_session),
        current_user: User = Depends(get_current_user),
    ) -> User:
        # Super administrators bypass all workspace permission constraints
        if current_user.is_super_admin:
            return current_user

        from src.modules.team_members.models import TeamMember

        team_id = await _resolve_team_id_from_request(request, session)

        # Retrieve user's scoped role within this team
        stmt = select(TeamMember).where(
            TeamMember.member_id == current_user.id,
            TeamMember.team_id == team_id,
            TeamMember.is_active.is_(True),
        )
        membership = await session.scalar(stmt)
        if membership is None:
            raise ForbiddenException(
                message="You are not a member of this team workspace.",
                error_code="TEAM_MEMBERSHIP_REQUIRED",
            )

        # Evaluate Casbin policy matrix for the member's role
        permitted = await check_permission(
            sub=membership.role.value,
            dom=str(team_id),
            obj=obj,
            act=act,
        )

        if not permitted:
            raise ForbiddenException(
                message=f"Insufficient permissions to {act} {obj} in this workspace.",
                error_code="PERMISSION_DENIED",
            )

        return current_user

    return _guard
