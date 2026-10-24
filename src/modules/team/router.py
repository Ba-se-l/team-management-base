"""Team domain router managing workspace lifecycles and scoped permissions."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.conf import settings
from src.database.session import get_session
from src.modules.auth.dependencies import get_current_user
from src.modules.user.models import User
from src.security.guards import require_team_permission
from src.share.responses import PageResult
from . import service
from .schemas import CreateTeamRequest, TeamResponse, UpdateTeamRequest

router = APIRouter(prefix=f"{settings.API_PREFIX}/teams", tags=["Teams"])


@router.post(
    "",
    response_model=TeamResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new team workspace",
)
async def create_team(
    request: CreateTeamRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> TeamResponse:
    """Creates a team workspace and sets the creator as administrator."""
    return await service.create_team(
        schema=request,
        current_user=current_user,
        session=session,
    )


@router.get(
    "",
    response_model=PageResult[TeamResponse],
    status_code=status.HTTP_200_OK,
    summary="List accessible team workspaces",
)
async def list_teams(
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
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
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Get team workspace by ID or slug",
    dependencies=[Depends(require_team_permission("team", "read"))],
)
async def get_team(
    team_id: str,
    session: AsyncSession = Depends(get_session),
) -> TeamResponse:
    """Retrieves a team workspace by numeric ID or unique slug."""
    return await service.get_team(identifier=team_id, session=session)


@router.patch(
    "/{team_id}",
    response_model=TeamResponse,
    status_code=status.HTTP_200_OK,
    summary="Update team workspace",
    dependencies=[Depends(require_team_permission("team", "update"))],
)
async def update_team(
    team_id: int,
    request: UpdateTeamRequest,
    session: AsyncSession = Depends(get_session),
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
    team_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Deletes team workspace and cascades deletion. Requires ADMIN permission."""
    await service.delete_team(team_id=team_id, session=session)
