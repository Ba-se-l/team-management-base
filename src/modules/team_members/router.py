"""Team member domain router enforcing scoped Casbin authorization."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.conf import settings
from src.database.session import get_session
from src.security.guards import require_team_permission
from src.share.responses import PageResult
from . import service
from .schemas import AddMemberRequest, MemberResponse, UpdateMemberRoleRequest

router = APIRouter(prefix=f"{settings.API_PREFIX}/teams/{{team_id}}/members", tags=["Team Members"])


@router.post(
    "",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add member to team workspace",
    dependencies=[Depends(require_team_permission("member", "create"))],
)
async def add_member(
    team_id: int,
    request: AddMemberRequest,
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """Enrolls a developer into the team workspace. Requires ADMIN permission."""
    return await service.add_member(
        team_id=team_id,
        schema=request,
        session=session,
    )


@router.get(
    "",
    response_model=PageResult[MemberResponse],
    status_code=status.HTTP_200_OK,
    summary="List team workspace members",
    dependencies=[Depends(require_team_permission("member", "read"))],
)
async def list_members(
    team_id: int,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    session: AsyncSession = Depends(get_session),
) -> PageResult[MemberResponse]:
    """Retrieves paginated members enrolled in the specified team workspace."""
    return await service.list_team_members(
        team_id=team_id,
        session=session,
        offset=offset,
        limit=limit,
    )


@router.patch(
    "/{user_id}",
    response_model=MemberResponse,
    status_code=status.HTTP_200_OK,
    summary="Update a team member's role",
    dependencies=[Depends(require_team_permission("member", "update"))],
)
async def update_member_role(
    team_id: int,
    user_id: int,
    request: UpdateMemberRoleRequest,
    session: AsyncSession = Depends(get_session),
) -> MemberResponse:
    """Modifies a member's role with last-administrator protection."""
    return await service.update_member_role(
        team_id=team_id,
        user_id=user_id,
        schema=request,
        session=session,
    )


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a member from the team workspace",
    dependencies=[Depends(require_team_permission("member", "delete"))],
)
async def remove_member(
    team_id: int,
    user_id: int,
    session: AsyncSession = Depends(get_session),
) -> None:
    """Removes a member from the team with last-administrator protection."""
    await service.remove_member(
        team_id=team_id,
        user_id=user_id,
        session=session,
    )
