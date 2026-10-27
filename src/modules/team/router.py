"""Team domain router managing workspace lifecycles and scoped permissions."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, status

from src.conf import settings
from src.security.guards import require_team_permission
from src.share.dependencies import CurrentUserDep, SessionDep
from src.share.responses import PageResult
from . import service
from .schemas import CreateTeamRequest, TeamResponse, UpdateTeamRequest

router = APIRouter(prefix=f"{settings.API_PREFIX}/teams", tags=["Teams"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a new team workspace",
)
async def create_team(
    request: CreateTeamRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TeamResponse:
    """Creates a team workspace and sets the creator as administrator."""
    return await service.create_team(
        schema=request,
        current_user=current_user,
        session=session,
    )


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List accessible team workspaces",
)
async def list_teams(
    current_user: CurrentUserDep,
    session: SessionDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageResult[TeamResponse]:
    """Lists teams accessible to the requester (all for super admins, enrolled for members)."""
    return await service.list_teams(
        current_user=current_user,
        session=session,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/{team_id}",
    status_code=status.HTTP_200_OK,
    summary="Get team workspace by ID or slug",
    dependencies=[Depends(require_team_permission("team", "read"))],
)
async def get_team(
    team_id: Annotated[str, Path(min_length=1, description="Team ID or slug")],
    session: SessionDep,
) -> TeamResponse:
    """Retrieves a team workspace by numeric ID or unique slug."""
    return await service.get_team(identifier=team_id, session=session)


@router.patch(
    "/{team_id}",
    status_code=status.HTTP_200_OK,
    summary="Update team workspace",
    dependencies=[Depends(require_team_permission("team", "update"))],
)
async def update_team(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    request: UpdateTeamRequest,
    session: SessionDep,
) -> TeamResponse:
    """Updates team properties. Requires ADMIN permission in the team."""
    return await service.update_team(
        team_id=team_id,
        schema=request,
        session=session,
    )


@router.delete(
    "/{team_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete team workspace",
    dependencies=[Depends(require_team_permission("team", "delete"))],
)
async def delete_team(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    session: SessionDep,
) -> None:
    """Deletes team workspace and cascades deletion. Requires ADMIN permission."""
    await service.delete_team(team_id=team_id, session=session)
