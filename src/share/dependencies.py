"""Centralized, reusable FastAPI dependency type aliases (PEP 593 Annotated).

Adheres strictly to the official FastAPI maintainers' dependency injection pattern:
eliminates duplicate parameter declarations and keeps router endpoint signatures clean.
"""

from typing import Annotated
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.session import get_session
from src.modules.auth.dependencies import get_current_user
from src.modules.user.models import User
from src.security.guards import require_super_admin
from src.share.responses import PaginationParams

SessionDep = Annotated[AsyncSession, Depends(get_session)]
"""Asynchronous SQLAlchemy database session dependency."""

CurrentUserDep = Annotated[User, Depends(get_current_user)]
"""Authenticated user ORM instance dependency."""

SuperAdminDep = Annotated[User, Depends(require_super_admin)]
"""Super administrator user ORM instance dependency."""

PaginationDep = Annotated[PaginationParams, Depends()]
"""Standard offset-limit pagination query parameters dependency."""

__all__ = (
    "SessionDep",
    "CurrentUserDep",
    "SuperAdminDep",
    "PaginationDep",
)
