"""Team Members module public API.

Exposes ORM models, exceptions, repositories, schemas, and the FastAPI router via PEP 562.
"""

import importlib
from typing import Any

from .exceptions import InsufficientRoleException, TeamMemberInactiveException, TeamMemberNotFoundException
from .models import TeamMember
from .repository import TeamMemberRepository
from .schemas import AddMemberRequest, MemberResponse, UpdateMemberRoleRequest


def __getattr__(name: str) -> Any:
    """Lazy imports router dependencies to prevent package-level circular imports (PEP 562)."""
    if name == "router":
        mod = importlib.import_module(f"{__name__}.router")
        return getattr(mod, "router")
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = (
    # from models.py
    "TeamMember",
    # from repository.py
    "TeamMemberRepository",
    # from exceptions.py
    "TeamMemberNotFoundException",
    "TeamMemberInactiveException",
    "InsufficientRoleException",
    # from schemas.py
    "AddMemberRequest",
    "UpdateMemberRoleRequest",
    "MemberResponse",
    # from router.py (PEP 562)
    "router",
)