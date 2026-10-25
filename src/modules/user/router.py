"""User domain router.

Provides HTTP endpoints for managing user profiles. All endpoints
require a valid JWT token via the ``get_current_user`` dependency.
"""

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated


from src.conf import settings
from src.database import get_session
from src.exc import ForbiddenException
from src.modules.auth.dependencies import get_current_user
from .models import User
from .schemas import (
    ChangePasswordRequest,
    CreateUserRequest,
    DeveloperDashboardResponse,
    UpdateSchemaRequest,
    UserResponse,
)
from . import service

router = APIRouter(prefix=f"{settings.API_PREFIX}/users", tags=["Users"])


async def _require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    """Enforces that the caller is a super administrator."""
    if not current_user.is_super_admin:
        raise ForbiddenException("Super administrator access required.", error_code="SUPER_ADMIN_REQUIRED")
    return current_user


@router.post(
    "",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Provision user (Admin only)",
    dependencies=[Depends(_require_super_admin)],
)
async def create_user(
    request: CreateUserRequest,
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Provisions a new developer or administrator account. Resticted to super admins."""
    user = await service.create_user(schema=request, session=session)
    return UserResponse.model_validate(user)


@router.get(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    """Returns the profile of the currently authenticated user."""
    return UserResponse.model_validate(current_user)


@router.get(
    "/me/dashboard",
    response_model=DeveloperDashboardResponse,
    status_code=status.HTTP_200_OK,
    summary="Get developer dashboard metrics",
)
async def get_my_dashboard(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> DeveloperDashboardResponse:
    """Returns aggregated workload metrics and task breakdowns for the current developer."""
    return await service.get_developer_dashboard(user_id=current_user.id, session=session)


@router.patch(
    "/me",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Update current user profile",
)
async def update_me(
    request: UpdateSchemaRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
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
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Deactivate current user account",
)
async def delete_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserResponse:
    """Soft-deletes the current user's account by setting it to inactive."""
    user = await service.soft_delete_user(
        user_id=current_user.id,
        session=session,
    )
    return UserResponse.model_validate(user)


@router.patch(
    "/me/password",
    response_model=UserResponse,
    status_code=status.HTTP_200_OK,
    summary="Change user password",
)
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
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
    response_model=list[UserResponse],
    status_code=status.HTTP_200_OK,
    summary="List active users",
)
async def list_users(
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    current_user: User = Depends(get_current_user),  # Just to enforce auth
    session: AsyncSession = Depends(get_session),
) -> list[UserResponse]:
    """Retrieves a paginated list of all active users in the system."""
    users = await service.list_users(skip=skip, limit=limit, session=session)
    return [UserResponse.model_validate(u) for u in users]
