"""Project domain routers enforcing scoped Casbin RBAC."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, status

from src.conf import settings
from src.database.enums import ProjectStatus, ProjectVisibility
from src.security.guards import require_team_permission
from src.share.dependencies import CurrentUserDep, SessionDep
from src.share.responses import PageResult
from . import service
from .schemas import CreateProjectRequest, ProjectResponse, UpdateProjectRequest

team_nested_router = APIRouter(
    prefix=f"{settings.API_PREFIX}/teams/{{team_id}}/projects",
    tags=["Projects"],
)

top_level_router = APIRouter(
    prefix=f"{settings.API_PREFIX}/projects",
    tags=["Projects"],
)


@team_nested_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a project in team workspace",
    dependencies=[Depends(require_team_permission("project", "create"))],
)
async def create_project(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    request: CreateProjectRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> ProjectResponse:
    """Creates a new project in the designated team workspace."""
    return await service.create_project(
        team_id=team_id,
        schema=request,
        creator=current_user,
        session=session,
    )


@team_nested_router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List team workspace projects",
    dependencies=[Depends(require_team_permission("project", "read"))],
)
async def list_team_projects(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    session: SessionDep,
    status_filter: Annotated[ProjectStatus | None, Query(alias="status")] = None,
    visibility_filter: Annotated[ProjectVisibility | None, Query(alias="visibility")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageResult[ProjectResponse]:
    """Retrieves paginated projects inside a team workspace with optional status/visibility filters."""
    return await service.list_team_projects(
        team_id=team_id,
        session=session,
        status=status_filter,
        visibility=visibility_filter,
        offset=offset,
        limit=limit,
    )


@top_level_router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List all accessible projects",
)
async def list_all_workspace_projects(
    current_user: CurrentUserDep,
    session: SessionDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
) -> PageResult[ProjectResponse]:
    """Retrieves all active projects accessible to the authenticated user."""
    return await service.list_accessible_projects(
        user_id=current_user.id,
        is_super_admin=current_user.is_super_admin,
        session=session,
        offset=offset,
        limit=limit,
    )


@top_level_router.get(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Get project by ID or slug",
    dependencies=[Depends(require_team_permission("project", "read"))],
)
async def get_project(
    project_id: Annotated[str, Path(min_length=1, description="Project ID or slug")],
    session: SessionDep,
) -> ProjectResponse:
    """Retrieves project details, linked technologies, and task metrics."""
    return await service.get_project(identifier=project_id, session=session)


@top_level_router.patch(
    "/{project_id}",
    status_code=status.HTTP_200_OK,
    summary="Update project details",
    dependencies=[Depends(require_team_permission("project", "update"))],
)
async def update_project(
    project_id: Annotated[int, Path(ge=1, description="Project ID")],
    request: UpdateProjectRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> ProjectResponse:
    """Updates project properties and technology stack associations."""
    return await service.update_project(
        project_id=project_id,
        schema=request,
        session=session,
        current_user=current_user,
    )


@top_level_router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete project",
    dependencies=[Depends(require_team_permission("project", "delete"))],
)
async def delete_project(
    project_id: Annotated[int, Path(ge=1, description="Project ID")],
    session: SessionDep,
) -> None:
    """Deletes project and cascades deletion to tasks."""
    await service.delete_project(project_id=project_id, session=session)
