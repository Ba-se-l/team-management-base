"""Domain enumerations for entities, roles, and status workflows."""

from enum import StrEnum
from sqlalchemy import Enum


def str_enum_column[E: StrEnum](enum_cls: type[E], length: int = 32) -> Enum:
    """Builds a portable VARCHAR+CHECK enum column storing member values rather than names.

    Args:
        enum_cls: Concrete StrEnum subclass.
        length: VARCHAR column length. Defaults to 32.

    Returns:
        Configured SQLAlchemy Enum type.
    """
    return Enum(
        enum_cls,
        native_enum=False,
        length=length,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )


class UserStatus(StrEnum):
    """Developer presence and availability status."""

    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"


class TeamRole(StrEnum):
    """Scoped roles for developers inside a specific team."""

    ADMIN = "admin"
    """Team leader: full administrative authority within the team domain."""

    DEVELOPER = "developer"
    """Active team member: creates tasks, moves assigned tasks, comments."""

    VIEWER = "viewer"
    """Observer or intern: read-only access to team workspace."""


# Backward compatibility alias for phase 1
UserRoles = TeamRole


class ProjectStatus(StrEnum):
    """Lifecycle stages for development projects."""

    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"

    # Temporary compatibility aliases during migration
    DONE = "completed"
    IN_PROGRESS = "active"
    TODO = "planning"
    IN_REVIEW = "active"


class ProjectVisibility(StrEnum):
    """Showcase visibility state for public agency showcase."""

    PRIVATE = "private"
    """Internal workspace project hidden from the public portal."""

    PENDING_REVIEW = "pending_review"
    """Nominated by team lead for public showcase, awaiting super admin review."""

    PUBLIC = "public"
    """Approved and featured in the public portfolio showcase."""


class TaskStatus(StrEnum):
    """Workflow state columns on the Kanban board."""

    TODO = "todo"
    IN_PROGRESS = "in_progress"
    IN_REVIEW = "in_review"
    DONE = "done"
    ARCHIVED = "archived"


class TaskPriority(StrEnum):
    """Urgency level assigned to work items."""

    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class JobTitle(StrEnum):
    """Specialization titles for technical team members."""

    BACKEND_DEVELOPER = "backend_developer"
    FRONTEND_DEVELOPER = "frontend_developer"
    FULLSTACK_DEVELOPER = "fullstack_developer"
    MOBILE_DEVELOPER = "mobile_developer"
    UI_UX_DESIGNER = "ui_ux_designer"
    DEVOPS_ENGINEER = "devops_engineer"
    SOFTWARE_ENGINEER = "software_engineer"
    STUDENT = "student"

    # Backward compatibility aliases
    FLUTTER_DEVELOPER = "mobile_developer"
    UIUX_DEVELOPER = "ui_ux_designer"
    WEP_DEVELOPER = "frontend_developer"
    SOFTWERE_DEVELOPER = "software_engineer"


class TechnologyCategory(StrEnum):
    """Classification for tech stack items displayed on the public showcase."""

    LANGUAGE = "language"
    BACKEND = "backend"
    FRONTEND = "frontend"
    MOBILE = "mobile"
    DATABASE = "database"
    DEVOPS = "devops"
    DESIGN = "design"
    TOOL = "tool"


class InquiryServiceType(StrEnum):
    """Categories of inquiries received from visitors via the public portal."""

    WEB_APP = "web_app"
    MOBILE_APP = "mobile_app"
    BACKEND_API = "backend_api"
    UI_UX = "ui_ux"
    CONSULTATION = "consultation"
    JOIN_REQUEST = "join_request"
    OTHER = "other"


class InquiryStatus(StrEnum):
    """Processing status for incoming client inquiries and join requests."""

    NEW = "new"
    IN_REVIEW = "in_review"
    RESPONDED = "responded"
    CONVERTED = "converted"
    CLOSED = "closed"
    SPAM = "spam"