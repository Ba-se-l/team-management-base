"""Security utilities for password hashing via Argon2id and JWT management."""

from datetime import datetime, timedelta, timezone
from typing import Any
import uuid
import jwt
from pwdlib import PasswordHash
from starlette.concurrency import run_in_threadpool

from src.conf import settings
from src.exc import InvalidCredentialsException
from src.share.schemas import TokenType

_password_hasher = PasswordHash.recommended()


def hash_password(plain_password: str) -> str:
    """Hashes a plain-text password using Argon2id.

    Args:
        plain_password: Raw password string.

    Returns:
        Argon2id encoded hash string.
    """
    return _password_hasher.hash(plain_password)


async def hash_password_async(plain_password: str) -> str:
    """Asynchronously hashes a plain-text password in a worker thread to avoid blocking the event loop."""
    return await run_in_threadpool(hash_password, plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain-text password against an Argon2id hash.

    Args:
        plain_password: Raw password candidate.
        hashed_password: Stored password hash.

    Returns:
        True if the candidate matches, False otherwise.
    """
    try:
        return _password_hasher.verify(plain_password, hashed_password)
    except Exception:
        return False


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """Asynchronously verifies a plain-text password in a worker thread to avoid blocking the event loop."""
    return await run_in_threadpool(verify_password, plain_password, hashed_password)


def create_access_token(
    user_id: int,
    security_version: int = 1,
    expires_delta: timedelta | None = None,
) -> str:
    """Generates a signed JWT access token.

    Args:
        user_id: The authenticated user's primary key integer.
        security_version: Current credential revision for instant token invalidation.
        expires_delta: Optional custom expiry duration. Defaults to settings.ACCESS_TOKEN_EXPIRE_MINUTES.

    Returns:
        Encoded JWT access token string.
    """
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": TokenType.ACCESS.value,
        "sec_ver": security_version,
        "jti": uuid.uuid4().hex,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }

    return jwt.encode(payload, key=settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(
    user_id: int,
    security_version: int = 1,
    family_id: str | None = None,
    jti: str | None = None,
    expires_delta: timedelta | None = None,
) -> tuple[str, str, str]:
    """Generates a signed rotational JWT refresh token bound to a session family.

    Args:
        user_id: The authenticated user's primary key integer.
        security_version: Current credential revision for instant token invalidation.
        family_id: Optional existing session family ID; generated if None.
        jti: Optional unique JWT ID claim; generated if None.
        expires_delta: Optional custom expiry duration. Defaults to settings.REFRESH_TOKEN_EXPIRE_DAYS.

    Returns:
        A tuple of (encoded_jwt_token, jti, family_id).
    """
    if jti is None:
        jti = uuid.uuid4().hex

    if family_id is None:
        family_id = uuid.uuid4().hex

    if expires_delta is None:
        expires_delta = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "type": TokenType.REFRESH.value,
        "sec_ver": security_version,
        "jti": jti,
        "fid": family_id,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }

    token = jwt.encode(payload, key=settings.REFRESH_SECRET_KEY, algorithm=settings.ALGORITHM)
    return token, jti, family_id


def decode_access_token(token: str) -> dict[str, Any]:
    """Decodes and validates an incoming JWT access token.

    Args:
        token: Raw JWT access token string.

    Returns:
        Decoded payload dictionary.

    Raises:
        InvalidCredentialsException: If signature, expiration, or claims are invalid.
    """
    try:
        payload = jwt.decode(
            token,
            key=settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["sub", "exp", "iat", "type", "sec_ver"]},
        )

        if "sub" not in payload or payload.get("type") != TokenType.ACCESS.value:
            raise InvalidCredentialsException("Invalid token claims.")

        try:
            int(payload["sub"])
        except (ValueError, TypeError) as exc:
            raise InvalidCredentialsException("Invalid token subject claim.") from exc

        return payload
    except jwt.PyJWTError:
        raise InvalidCredentialsException("Token is invalid or expired.")


def decode_refresh_token(token: str) -> dict[str, Any]:
    """Decodes and validates an incoming JWT refresh token.

    Args:
        token: Raw JWT refresh token string.

    Returns:
        Decoded payload dictionary.

    Raises:
        InvalidCredentialsException: If signature, expiration, or claims are invalid.
    """
    try:
        payload = jwt.decode(
            token,
            key=settings.REFRESH_SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"require": ["sub", "exp", "iat", "jti", "fid", "type"]},
        )

        if (
            "sub" not in payload
            or not payload.get("jti")
            or not payload.get("fid")
            or payload.get("type") != TokenType.REFRESH.value
        ):
            raise InvalidCredentialsException("Invalid refresh token claims.")

        try:
            int(payload["sub"])
        except (ValueError, TypeError) as exc:
            raise InvalidCredentialsException("Invalid refresh token subject claim.") from exc

        return payload
    except jwt.PyJWTError:
        raise InvalidCredentialsException("Refresh token is invalid or expired.")
