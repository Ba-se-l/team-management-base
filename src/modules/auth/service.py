"""Authentication domain service implementing hardened token rotation and identity resolution."""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.conf import settings
from src.exc import InvalidCredentialsException, TokenRevokedException
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.modules.user.exceptions import UserInactiveException
from src.modules.user.models import User
from src.modules.user.repository import UserRepository
from src.modules.user.schemas import UserResponse
from src.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    verify_password_async,
)
from src.share.event_bus import event_bus
from src.share.schemas import AuditEvent
from .model import RefreshSession
from .repo import RefreshSessionRepository
from .schemas import (
    LoginRequest,
    TokenResponse,
    UserMeMembershipResponse,
    UserMeResponse,
)


async def _issue_tokens(
    user: User,
    session: AsyncSession,
    family_id: str | None = None,
    device_info: str | None = None,
) -> tuple[TokenResponse, str]:
    """Issues a fresh access token and rotational refresh token, persisting the session.

    Args:
        user: Authenticated User model instance.
        session: Active asynchronous database session.
        family_id: Optional existing session family UUID string.
        device_info: Optional client device or user agent string.

    Returns:
        A tuple of (TokenResponse, plain_refresh_token_string).
    """
    access_token = create_access_token(
        user_id=user.id,
        security_version=user.security_version,
    )

    refresh_token_str, jti, fam_id = create_refresh_token(
        user_id=user.id,
        security_version=user.security_version,
        family_id=family_id,
    )

    refresh_repo = RefreshSessionRepository(session=session)
    refresh_session = RefreshSession(
        user_id=user.id,
        family_id=fam_id,
        refresh_token_jti=jti,
        device_info=device_info,
        is_revoked=False,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    await refresh_repo.create(refresh_session)
    await session.flush()

    response_payload = TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )

    return response_payload, refresh_token_str


async def login_user(
    schema: LoginRequest,
    session: AsyncSession,
    device_info: str | None = None,
) -> tuple[TokenResponse, str]:
    """Authenticates credentials, verifies status, and establishes a new token session.

    Args:
        schema: Validated login request.
        session: Active asynchronous database session.
        device_info: Optional client device descriptor.

    Returns:
        Tuple of (TokenResponse, refresh_token_str).

    Raises:
        InvalidCredentialsException: If password or email is incorrect.
        UserInactiveException: If user account is disabled.
    """
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_email(schema.email)

    if user is None or not await verify_password_async(schema.password, user.hashed_password):
        raise InvalidCredentialsException("Invalid email or password.")

    if not user.is_active:
        raise UserInactiveException(identifier=str(user.id))

    tokens = await _issue_tokens(
        user=user,
        session=session,
        device_info=device_info,
    )
    await event_bus.publish(
        AuditEvent(
            action="USER_LOGIN",
            entity_type="User",
            entity_id=str(user.id),
            user_id=user.id,
        ),
        session=session,
    )
    return tokens


async def refresh_token(
    refresh_token_str: str,
    session: AsyncSession,
    device_info: str | None = None,
) -> tuple[TokenResponse, str]:
    """Exchanges a valid refresh token for a new pair with atomic reuse attack detection.

    Args:
        refresh_token_str: Raw JWT refresh token string.
        session: Active asynchronous database session.
        device_info: Optional client device descriptor.

    Returns:
        Tuple of (TokenResponse, new_refresh_token_str).

    Raises:
        InvalidCredentialsException: If token is malformed, replayed, or security version changed.
        TokenRevokedException: If session was revoked or expired.
    """
    payload = decode_refresh_token(refresh_token_str)
    user_id = int(payload["sub"])
    jti = payload["jti"]
    token_fid = payload.get("fid")
    token_sec_ver = payload.get("sec_ver")

    refresh_repo = RefreshSessionRepository(session=session)
    existing_session = await refresh_repo.get_by_jti(jti=jti)

    if existing_session is None:
        raise TokenRevokedException("Refresh token session was not found.")

    if existing_session.user_id != user_id or (
        token_fid is not None and existing_session.family_id != token_fid
    ):
        if existing_session.family_id:
            await refresh_repo.revoke_family(existing_session.family_id)
        await session.commit()
        raise InvalidCredentialsException("Refresh token claim mismatch.")

    # Check expiration before consumption
    expires_at = existing_session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if not existing_session.is_revoked and expires_at < datetime.now(timezone.utc):
        await refresh_repo.revoke_by_jti(jti=jti)
        await session.commit()
        raise TokenRevokedException("Refresh token has expired.")

    # Atomic compare-and-swap consumption: prevents TOCTOU race and detects replay attacks
    consumed = await refresh_repo.consume_session_atomically(jti=jti)
    if not consumed:
        if existing_session.family_id:
            await refresh_repo.revoke_family(existing_session.family_id)
        else:
            await refresh_repo.revoke_all_for_user(user_id=user_id)
        await session.commit()
        raise InvalidCredentialsException(
            "Revoked refresh token replay detected. All sessions in this lineage have been terminated."
        )

    # Verify user state & security version
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_id(user_id)

    if user is None or not user.is_active:
        await session.commit()
        raise InvalidCredentialsException("User account is inactive or not found.")

    if token_sec_ver is not None and user.security_version != token_sec_ver:
        if existing_session.family_id:
            await refresh_repo.revoke_family(existing_session.family_id)
        else:
            await refresh_repo.revoke_all_for_user(user_id=user_id)
        await session.commit()
        raise InvalidCredentialsException("Credentials have been rotated. Please log in again.")

    return await _issue_tokens(
        user=user,
        session=session,
        family_id=existing_session.family_id,
        device_info=device_info,
    )


async def logout(refresh_token_str: str, session: AsyncSession) -> None:
    """Revokes the specified refresh token session.

    Args:
        refresh_token_str: Raw JWT refresh token string to revoke.
        session: Active asynchronous database session.
    """
    try:
        payload = decode_refresh_token(refresh_token_str)
        jti = payload.get("jti")
        if jti:
            refresh_repo = RefreshSessionRepository(session=session)
            await refresh_repo.revoke_by_jti(jti=jti)
            await session.flush()
    except Exception:
        # Logout is idempotent: fail silently on invalid token structure
        pass


async def logout_all(user_id: int, session: AsyncSession) -> None:
    """Revokes all active refresh token sessions and invalidates active access tokens for the user.

    Args:
        user_id: Target user integer primary key.
        session: Active asynchronous database session.
    """
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_id(user_id)
    if user is not None:
        user.security_version = (user.security_version or 1) + 1

    refresh_repo = RefreshSessionRepository(session=session)
    await refresh_repo.revoke_all_for_user(user_id=user_id)
    await session.flush()


async def get_user_me(user: User, session: AsyncSession) -> UserMeResponse:
    """Retrieves full profile and active team workspace memberships for the requester.

    Args:
        user: Current authenticated User.
        session: Active asynchronous database session.

    Returns:
        UserMeResponse containing user profile and list of team memberships.
    """
    stmt = (
        select(TeamMember, Team)
        .join(Team, Team.id == TeamMember.team_id)
        .where(
            TeamMember.member_id == user.id,
            TeamMember.is_active.is_(True),
            Team.is_active.is_(True),
        )
    )
    result = await session.execute(stmt)

    memberships: list[UserMeMembershipResponse] = []
    for member, team in result.all():
        role_val = member.role.value if hasattr(member.role, "value") else str(member.role)
        memberships.append(
            UserMeMembershipResponse(
                team_id=team.id,
                team_name=team.name,
                team_slug=team.slug,
                role=role_val,
            )
        )

    return UserMeResponse(
        user=UserResponse.model_validate(user),
        memberships=memberships,
    )