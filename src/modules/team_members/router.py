"""Team member domain router enforcing scoped Casbin authorization."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, status

from src.conf import settings
from src.security.guards import require_team_permission
from src.share.dependencies import SessionDep
from src.share.responses import PageResult
from . import service
from .schemas import AddMemberRequest, MemberResponse, UpdateMemberRoleRequest

router = APIRouter(prefix=f"{settings.API_PREFIX}/teams/{{team_id}}/members", tags=["Team Members"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Add member to team workspace",
    dependencies=[Depends(require_team_permission("member", "create"))],
)
async def add_member(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    request: AddMemberRequest,
    session: SessionDep,
) -> MemberResponse:
    """Enrolls a developer into the team workspace. Requires ADMIN permission."""
    return await service.add_member(
        team_id=team_id,
        schema=request,
        session=session,
    )


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List team workspace members",
    dependencies=[Depends(require_team_permission("member", "read"))],
)
async def list_members(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    session: SessionDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
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
    status_code=status.HTTP_200_OK,
    summary="Update a team member's role",
    dependencies=[Depends(require_team_permission("member", "update"))],
)
async def update_member_role(
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    user_id: Annotated[int, Path(ge=1, description="Target User ID")],
    request: UpdateMemberRoleRequest,
    session: SessionDep,
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
    team_id: Annotated[int, Path(ge=1, description="Team ID")],
    user_id: Annotated[int, Path(ge=1, description="Target User ID")],
    session: SessionDep,
) -> None:
    """Removes a member from the team with last-administrator protection."""
    await service.remove_member(
        team_id=team_id,
        user_id=user_id,
        session=session,
    )
