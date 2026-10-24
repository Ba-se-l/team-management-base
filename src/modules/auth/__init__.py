"""Authentication module public API.

Exposes request/response schemas and the FastAPI router.
"""

from .dependencies import get_current_user
from .model import RefreshSession
from .repo import RefreshSessionRepository
from .router import router
from .schemas import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserMeMembershipResponse,
    UserMeResponse,
)

__all__ = (
    "get_current_user",
    "RefreshSession",
    "RefreshSessionRepository",
    "router",
    "LoginRequest",
    "TokenResponse",
    "RefreshRequest",
    "UserMeResponse",
    "UserMeMembershipResponse",
)
