"""Central database registry importing all declarative models to ensure metadata completeness.

Alembic migrations, test harnesses, and runtime initialization import `Base`
and metadata through this module so that all 12 platform tables are consistently
discovered and indexed.
"""

from src.database.base import Base
from src.modules.audit.model import AuditLog
from src.modules.auth.model import RefreshSession
from src.modules.inquiry.models import ServiceInquiry
from src.modules.m2m import ProjectsTechnologies
from src.modules.project.models import Project
from src.modules.task.models import Task, TaskComment
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.modules.technology.models import Technology
from src.modules.user.models import User
from src.security.casbin_rule import CasbinRule

target_metadata = Base.metadata

__all__ = (
    "Base",
    "target_metadata",
    "User",
    "RefreshSession",
    "Team",
    "TeamMember",
    "Project",
    "ProjectsTechnologies",
    "Task",
    "TaskComment",
    "Technology",
    "ServiceInquiry",
    "AuditLog",
    "CasbinRule",
)
