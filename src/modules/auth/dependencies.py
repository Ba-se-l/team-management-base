"""FastAPI dependency injection functions for authentication.

Provides the ``get_current_user`` dependency that extracts and validates
the JWT token from the ``Authorization: Bearer <token>`` header,
decodes it, and fetches the corresponding ``User`` from the database.

This logic is placed inside the ``auth`` domain module rather than ``core``
to prevent circular imports. It bridges the core security utilities with
the domain-specific ``UserRepository``.
"""

from __future__ import annotations
from typing import TYPE_CHECKING
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_session
from src.exc import InvalidCredentialsException
from src.security.security import decode_access_token
from src.conf import settings

if TYPE_CHECKING:
    from src.modules.user import User


_oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f'{settings.API_PREFIX}/auth/login')


async def get_current_user(
    token: str = Depends(_oauth2_scheme),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Extracts and validates the current authenticated user from the JWT token.

    This is a FastAPI dependency injected into every protected route.
    It performs three sequential validations:
    1. Decodes the JWT token and extracts the ``sub`` (user_id) claim.
    2. Fetches the user from the database by UUID.
    3. Verifies the user exists and is active.

    Args:
        token: The JWT bearer token extracted from the ``Authorization`` header.
        session: The async database session injected by FastAPI.

    Returns:
        The authenticated ``User`` ORM instance.

    Raises:
        InvalidCredentialsException: If the token is invalid, the user
            does not exist, or the user is inactive.
    """
    # Step 1: Decode the JWT token — raises InvalidCredentialsException if invalid
    payload = decode_access_token(token=token)
    user_id = payload.get('sub')

    if user_id is None:
        raise InvalidCredentialsException()

    # Lazy import to break module-level circular dependency
    from src.modules.user import UserRepository
    
    # Step 2: Fetch the user from the database
    user_repo = UserRepository(session=session)
    user = await user_repo.get_by_id(int(user_id))

    if user is None:
        raise InvalidCredentialsException()

    # Step 3: Verify the user is active
    if not user.is_active:
        raise InvalidCredentialsException()

    # Step 4: Verify token security version matches current credential revision
    token_sec_ver = payload.get("sec_ver")
    if token_sec_ver is not None and user.security_version != token_sec_ver:
        raise InvalidCredentialsException("Session credentials have been rotated or revoked.")

    return user
