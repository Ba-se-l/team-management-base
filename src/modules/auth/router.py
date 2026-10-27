"""Authentication domain router implementing cookie-backed token lifecycle and identity endpoints."""

from fastapi import APIRouter, Depends, Request, Response, status

from src.conf import settings
from src.exc import ForbiddenException, InvalidCredentialsException
from src.share.dependencies import CurrentUserDep, SessionDep
from src.share.rate_limit import RateLimiter
from . import service
from .schemas import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserMeResponse,
)

router = APIRouter(prefix=f"{settings.API_PREFIX}/auth", tags=["Authentication"])

login_rate_limiter = RateLimiter(requests_limit=settings.LOGIN_RATE_LIMIT, window_seconds=60)


@router.post(
    "/register",
    status_code=status.HTTP_403_FORBIDDEN,
    summary="Public registration (Disabled)",
)
async def register() -> None:
    """Enforces closed platform policy by blocking open user registrations."""
    if not settings.ALLOW_PUBLIC_REGISTRATION:
        raise ForbiddenException(
            "Public self-registration is disabled. Accounts must be provisioned by a platform administrator.",
            error_code="REGISTRATION_DISABLED",
        )


@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    summary="Login and receive session token",
    description="Authenticates credentials and establishes session via HttpOnly cookie and JWT access token.",
    dependencies=[Depends(login_rate_limiter)],
)
async def login(
    request_data: LoginRequest,
    response: Response,
    request: Request,
    session: SessionDep,
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
    status_code=status.HTTP_200_OK,
    summary="Rotate refresh token",
    description="Exchanges active refresh token for a rotated pair; defends against replay attacks.",
)
async def refresh(
    request: Request,
    response: Response,
    session: SessionDep,
    body: RefreshRequest | None = None,
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
    session: SessionDep,
    body: RefreshRequest | None = None,
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
    current_user: CurrentUserDep,
    session: SessionDep,
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
    status_code=status.HTTP_200_OK,
    summary="Get current user profile and team memberships",
)
async def get_me(
    current_user: CurrentUserDep,
    session: SessionDep,
) -> UserMeResponse:
    """Returns the authenticated user's profile and active workspace memberships."""
    return await service.get_user_me(user=current_user, session=session)