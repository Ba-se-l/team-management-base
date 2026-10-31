"""Authentication module public API.

Exposes request/response schemas and the FastAPI router.
"""

from .dependencies import get_current_user
from .model import RefreshSession
from .repo import RefreshSessionRepository
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


def __getattr__(name: str):
    """PEP 562 lazy loading for router to prevent circular dependencies."""
    if name == "router":
        from .router import router
        return router
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
