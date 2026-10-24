"""Team module public API.

Exposes ORM models, exceptions, repositories, and the FastAPI router via PEP 562.
"""

import importlib
from typing import Any

from .exceptions import TeamAlreadyExistsException, TeamInactiveException, TeamNotFoundException
from .models import Team
from .repository import TeamRepository
from .schemas import CreateTeamRequest, TeamResponse, UpdateTeamRequest


def __getattr__(name: str) -> Any:
    """Lazy imports router dependencies to prevent package-level circular imports (PEP 562)."""
    if name == "router":
        mod = importlib.import_module(f"{__name__}.router")
        return getattr(mod, "router")
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = (
    # from models.py
    "Team",
    # from repository.py
    "TeamRepository",
    # from exceptions.py
    "TeamNotFoundException",
    "TeamAlreadyExistsException",
    "TeamInactiveException",
    # from schemas.py
    "CreateTeamRequest",
    "UpdateTeamRequest",
    "TeamResponse",
    # from router.py (PEP 562)
    "router",
)