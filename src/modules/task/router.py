"""Task domain routers enforcing scoped Casbin RBAC and Kanban operations."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, status

from src.conf import settings
from src.database.enums import TaskStatus
from src.security.guards import require_team_permission
from src.share.dependencies import CurrentUserDep, SessionDep
from src.share.responses import PageResult
from . import service
from .schemas import (
    CreateCommentRequest,
    CreateTaskRequest,
    KanbanBoardResponse,
    MoveTaskRequest,
    TaskCommentResponse,
    TaskResponse,
    UpdateTaskRequest,
)

project_nested_router = APIRouter(
    prefix=f"{settings.API_PREFIX}/projects/{{project_id}}/tasks",
    tags=["Tasks"],
)

top_level_router = APIRouter(
    prefix=f"{settings.API_PREFIX}/tasks",
    tags=["Tasks"],
)


@project_nested_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a task in project",
    dependencies=[Depends(require_team_permission("task", "create"))],
)
async def create_task(
    project_id: Annotated[int, Path(ge=1, description="Project ID")],
    request: CreateTaskRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TaskResponse:
    """Creates a work item in a project and appends it to the workflow column."""
    return await service.create_task(
        project_id=project_id,
        schema=request,
        creator=current_user,
        session=session,
    )


@project_nested_router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List project tasks",
    dependencies=[Depends(require_team_permission("task", "read"))],
)
async def list_project_tasks(
    project_id: Annotated[int, Path(ge=1, description="Project ID")],
    session: SessionDep,
    status_filter: Annotated[TaskStatus | None, Query(alias="status")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageResult[TaskResponse]:
    """Retrieves paginated tasks inside a project with optional status filter."""
    return await service.list_tasks(
        project_id=project_id,
        session=session,
        status=status_filter,
        offset=offset,
        limit=limit,
    )


@project_nested_router.get(
    "/kanban",
    status_code=status.HTTP_200_OK,
    summary="Get project Kanban board",
    dependencies=[Depends(require_team_permission("task", "read"))],
)
async def get_kanban_board(
    project_id: Annotated[int, Path(ge=1, description="Project ID")],
    session: SessionDep,
) -> KanbanBoardResponse:
    """Retrieves all tasks for a project grouped by workflow columns."""
    return await service.get_kanban_board(
        project_id=project_id,
        session=session,
    )


@top_level_router.get(
    "/my",
    status_code=status.HTTP_200_OK,
    summary="Get current user assigned tasks",
)
async def get_my_tasks(
    current_user: CurrentUserDep,
    session: SessionDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PageResult[TaskResponse]:
    """Retrieves all active tasks assigned to the authenticated user across active teams."""
    return await service.list_my_tasks(
        user_id=current_user.id,
        session=session,
        offset=offset,
        limit=limit,
    )


@top_level_router.get(
    "/{task_id}",
    status_code=status.HTTP_200_OK,
    summary="Get task details",
    dependencies=[Depends(require_team_permission("task", "read"))],
)
async def get_task(
    task_id: Annotated[int, Path(ge=1, description="Task ID")],
    session: SessionDep,
) -> TaskResponse:
    """Retrieves detailed task information including comments and assignee."""
    return await service.get_task(task_id=task_id, session=session)


@top_level_router.patch(
    "/{task_id}",
    status_code=status.HTTP_200_OK,
    summary="Update task details",
    dependencies=[Depends(require_team_permission("task", "update"))],
)
async def update_task(
    task_id: Annotated[int, Path(ge=1, description="Task ID")],
    request: UpdateTaskRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TaskResponse:
    """Updates general task fields (title, description, status, priority, assignee)."""
    return await service.update_task(
        task_id=task_id,
        schema=request,
        current_user=current_user,
        session=session,
    )


@top_level_router.patch(
    "/{task_id}/move",
    status_code=status.HTTP_200_OK,
    summary="Move task in Kanban board",
    dependencies=[Depends(require_team_permission("task", "update"))],
)
async def move_task(
    task_id: Annotated[int, Path(ge=1, description="Task ID")],
    request: MoveTaskRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TaskResponse:
    """Updates task status column and position for drag-and-drop workflow."""
    return await service.move_task(
        task_id=task_id,
        schema=request,
        current_user=current_user,
        session=session,
    )


@top_level_router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete task",
    dependencies=[Depends(require_team_permission("task", "delete"))],
)
async def delete_task(
    task_id: Annotated[int, Path(ge=1, description="Task ID")],
    session: SessionDep,
) -> None:
    """Deletes task and cascaded comments."""
    await service.delete_task(task_id=task_id, session=session)


@top_level_router.post(
    "/{task_id}/comments",
    status_code=status.HTTP_201_CREATED,
    summary="Add comment to task",
    dependencies=[Depends(require_team_permission("comment", "create"))],
)
async def add_comment(
    task_id: Annotated[int, Path(ge=1, description="Task ID")],
    request: CreateCommentRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TaskCommentResponse:
    """Adds a discussion comment to a task."""
    return await service.add_comment(
        task_id=task_id,
        schema=request,
        author=current_user,
        session=session,
    )


@top_level_router.delete(
    "/{task_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete task comment",
    dependencies=[Depends(require_team_permission("comment", "delete"))],
)
async def delete_task_comment(
    task_id: Annotated[int, Path(ge=1, description="Task ID")],
    comment_id: Annotated[int, Path(ge=1, description="Comment ID")],
    current_user: CurrentUserDep,
    session: SessionDep,
) -> None:
    """Deletes a discussion comment (author or admin only)."""
    await service.delete_comment(
        comment_id=comment_id,
        current_user=current_user,
        session=session,
    )


@top_level_router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete comment by ID",
    dependencies=[Depends(require_team_permission("comment", "delete"))],
)
async def delete_comment_direct(
    comment_id: Annotated[int, Path(ge=1, description="Comment ID")],
    current_user: CurrentUserDep,
    session: SessionDep,
) -> None:
    """Direct deletion of comment by ID (author or admin only)."""
    await service.delete_comment(
        comment_id=comment_id,
        current_user=current_user,
        session=session,
    )
