"""Root module initialization.

Aggregates all routers from the various domain modules into a single
``api_router`` that can be included in ``main.py``.
"""

from fastapi import APIRouter

from .audit.router import router as audit_router
from .auth.router import router as auth_router
from .inquiry.router import admin_router as inquiry_admin_router
from .inquiry.router import public_router as inquiry_public_router
from .project.router import team_nested_router as project_nested_router
from .project.router import top_level_router as project_top_router
from .showcase.router import router as showcase_router
from .task.router import project_nested_router as task_nested_router
from .task.router import top_level_router as task_top_router
from .team.router import router as team_router
from .team_members.router import router as team_members_router
from .technology.router import router as technology_router
from .user.router import router as user_router

api_router = APIRouter()

# Authentication & User Profiles
api_router.include_router(auth_router)
api_router.include_router(user_router)

# Workspace Domains (Teams, Members, Projects, Tasks, Tech)
api_router.include_router(team_router)
api_router.include_router(team_members_router)
api_router.include_router(project_nested_router)
api_router.include_router(project_top_router)
api_router.include_router(task_nested_router)
api_router.include_router(task_top_router)
api_router.include_router(technology_router)

# Public Showcase & Inquiries
api_router.include_router(showcase_router)
api_router.include_router(inquiry_public_router)
api_router.include_router(inquiry_admin_router)

# Platform Audit Trail
api_router.include_router(audit_router)

__all__ = (
    "api_router",
)
