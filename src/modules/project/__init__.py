"""Project module public API.

Exposes ORM models, exceptions, repositories, and the FastAPI routers via PEP 562.
"""

import importlib
from typing import Any

from .exceptions import ProjectInactiveException, ProjectNotFoundException
from .models import Project
from .repository import ProjectRepository
from .schemas import (
    CreateProjectRequest,
    ProjectResponse,
    ProjectTechnologySummary,
    UpdateProjectRequest,
)


def __getattr__(name: str) -> Any:
    """Lazy imports router dependencies to prevent package-level circular imports (PEP 562)."""
    if name in ("team_nested_router", "top_level_router"):
        mod = importlib.import_module(f"{__name__}.router")
        return getattr(mod, name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = (
    # from models.py
    "Project",
    # from repository.py
    "ProjectRepository",
    # from exceptions.py
    "ProjectNotFoundException",
    "ProjectInactiveException",
    # from schemas.py
    "CreateProjectRequest",
    "UpdateProjectRequest",
    "ProjectResponse",
    "ProjectTechnologySummary",
    # from router.py (PEP 562)
    "team_nested_router",
    "top_level_router",
)