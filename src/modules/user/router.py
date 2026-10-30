"""User domain router.

Provides HTTP endpoints for managing user profiles. All endpoints
require a valid JWT token via the ``get_current_user`` dependency.
"""

from typing import Annotated
from fastapi import APIRouter, Query, status

from src.conf import settings
from src.share.dependencies import CurrentUserDep, SessionDep, SuperAdminDep
from . import service
from .schemas import (
    ChangePasswordRequest,
    CreateUserRequest,
    DeveloperDashboardResponse,
    UpdateSchemaRequest,
    UserResponse,
)

router = APIRouter(prefix=f"{settings.API_PREFIX}/users", tags=["Users"])


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Provision user (Admin only)",
)
async def create_user(
    request: CreateUserRequest,
    current_admin: SuperAdminDep,
    session: SessionDep,
) -> UserResponse:
    """Provisions a new developer or administrator account. Restricted to super admins."""
    user = await service.create_user(
        schema=request,
        session=session,
        actor_id=current_admin.id,
    )
    return UserResponse.model_validate(user)


@router.get(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def get_me(
    current_user: CurrentUserDep,
) -> UserResponse:
    """Returns the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.get(
    "/me/dashboard",
    status_code=status.HTTP_200_OK,
    summary="Get developer dashboard metrics",
)
async def get_my_dashboard(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> DeveloperDashboardResponse:
    """Returns aggregated workload metrics and task breakdowns for the current developer."""
    return await service.get_developer_dashboard(user_id=current_user.id, session=session)


@router.patch(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
)
async def update_me(
    request: UpdateSchemaRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserResponse:
    """Updates optional fields on the current user's profile."""
    user = await service.update_user(
        user_id=current_user.id,
        schema=request,
        session=session,
    )
    return UserResponse.model_validate(user)


@router.delete(
    "/me",
    status_code=status.HTTP_200_OK,
    summary="Deactivate current user account",
)
async def delete_me(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserResponse:
    """Soft-deletes the current user's account by setting it to inactive."""
    user = await service.soft_delete_user(
        user_id=current_user.id,
        session=session,
    )
    return UserResponse.model_validate(user)


@router.patch(
    "/me/password",
    status_code=status.HTTP_200_OK,
    summary="Change user password",
)
async def change_password(
    request: ChangePasswordRequest,
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserResponse:
    """Changes the user's password. Requires the old password to verify."""
    user = await service.change_password(
        user_id=current_user.id,
        schema=request,
        session=session,
    )
    return UserResponse.model_validate(user)


@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    summary="List active users",
)
async def list_users(
    current_user: CurrentUserDep,
    session: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[UserResponse]:
    """Retrieves a paginated list of all active users in the system."""
    users = await service.list_users(
        skip=skip,
        limit=limit,
        session=session,
        current_user=current_user,
    )
    return [UserResponse.model_validate(u) for u in users]
