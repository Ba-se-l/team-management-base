"""Task module public API.

Exposes ORM models, exceptions, repositories, schemas, and the FastAPI routers via PEP 562.
"""

import importlib
from typing import Any

from .exceptions import TaskInactiveException, TaskNotFoundException
from .models import Task, TaskComment
from .repository import TaskRepository
from .schemas import (
    CreateCommentRequest,
    CreateTaskRequest,
    KanbanBoardResponse,
    MoveTaskRequest,
    TaskCommentResponse,
    TaskResponse,
    UpdateTaskRequest,
)


def __getattr__(name: str) -> Any:
    """Lazy imports router dependencies to prevent package-level circular imports (PEP 562)."""
    if name in ("project_nested_router", "top_level_router"):
        mod = importlib.import_module(f"{__name__}.router")
        return getattr(mod, name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = (
    # from models.py
    "Task",
    "TaskComment",
    # from repository.py
    "TaskRepository",
    # from exceptions.py
    "TaskNotFoundException",
    "TaskInactiveException",
    # from schemas.py
    "CreateTaskRequest",
    "UpdateTaskRequest",
    "MoveTaskRequest",
    "TaskResponse",
    "KanbanBoardResponse",
    "CreateCommentRequest",
    "TaskCommentResponse",
    # from router.py (PEP 562)
    "project_nested_router",
    "top_level_router",
)