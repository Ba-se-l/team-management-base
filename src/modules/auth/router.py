"""Authentication domain router implementing cookie-backed token lifecycle and identity endpoints."""

from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.conf import settings
from src.database.session import get_session
from src.exc import InvalidCredentialsException
from src.modules.user.models import User
from . import service
from .dependencies import get_current_user
from .schemas import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserMeResponse,
)

router = APIRouter(prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication"])


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Login and receive session token",
    description="Authenticates credentials and establishes session via HttpOnly cookie and JWT access token.",
)
async def login(
    request_data: LoginRequest,
    response: Response,
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Authenticates a user and sets an HttpOnly rotational refresh cookie."""
    ua = request.headers.get("user-agent")
    tokens, refresh_str = await service.login_user(
        schema=request_data,
        session=session,
        device_info=ua[:250] if ua else None,
    )

    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=refresh_str,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "prod"),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return tokens


@router.post(
    "/refresh",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token",
    description="Exchanges active refresh token for a rotated pair; defends against replay attacks.",
)
async def refresh(
    request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> TokenResponse:
    """Rotates refresh token and issues fresh access token."""
    cookie_token = request.cookies.get(settings.REFRESH_COOKIE_NAME)
    token_str = cookie_token or (body.refresh_token if body else None)

    if not token_str:
        raise InvalidCredentialsException("Refresh token was not provided.")

    ua = request.headers.get("user-agent")
    tokens, new_refresh_str = await service.refresh_token(
        refresh_token_str=token_str,
        session=session,
        device_info=ua[:250] if ua else None,
    )

    response.set_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        value=new_refresh_str,
        httponly=True,
        samesite="lax",
        secure=(settings.ENVIRONMENT == "prod"),
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400,
        path="/",
    )

    return tokens


@router.post(
    "/logout",
    status_code=status.HTTP_200_OK,
    summary="Logout current session",
)
async def logout_endpoint(
    request: Request,
    response: Response,
    body: RefreshRequest | None = None,
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Revokes the active refresh token and clears the authentication cookie."""
    token_str = request.cookies.get(settings.REFRESH_COOKIE_NAME) or (body.refresh_token if body else None)
    if token_str:
        await service.logout(refresh_token_str=token_str, session=session)

    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"message": "Logged out successfully."}


@router.post(
    "/logout-all",
    status_code=status.HTTP_200_OK,
    summary="Revoke all user sessions",
)
async def logout_all_endpoint(
    response: Response,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> dict[str, str]:
    """Terminates all active sessions across all devices for the authenticated user."""
    await service.logout_all(user_id=current_user.id, session=session)
    response.delete_cookie(
        key=settings.REFRESH_COOKIE_NAME,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return {"message": "All sessions revoked successfully."}


@router.get(
    "/me",
    response_model=UserMeResponse,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile and team memberships",
)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserMeResponse:
    """Returns the authenticated user's profile and active workspace memberships."""
    return await service.get_user_me(user=current_user, session=session)