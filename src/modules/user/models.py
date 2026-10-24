from typing import TYPE_CHECKING
from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base, CreatedAtUpdatedAtMixin
from src.database.enums import JobTitle, UserStatus, str_enum_column

if TYPE_CHECKING:
    from src.modules.audit.model import AuditLog
    from src.modules.auth.model import RefreshSession
    from src.modules.project.models import Project
    from src.modules.task.models import Task, TaskComment
    from src.modules.team.models import Team
    from src.modules.team_members.models import TeamMember


class User(Base, CreatedAtUpdatedAtMixin):
    """Developer user account within the platform."""

    __tablename__ = "users"

    # ======================
    # ==== MAIN COLUMNS ====
    # ======================
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    username: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)

    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    bio: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    github_url: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

    linkedin_url: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

    website_url: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    is_public_member: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    status: Mapped[UserStatus] = mapped_column(
        str_enum_column(UserStatus, length=32),
        default=UserStatus.ONLINE,
        nullable=False,
    )

    job_title: Mapped[JobTitle | None] = mapped_column(
        str_enum_column(JobTitle, length=32),
        nullable=True,
        default=None,
    )

    security_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # ======================
    # === RELATIONSHIPS ====
    # ======================
    projects_established: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="created_by",
        foreign_keys="Project.creator_id",
    )

    teams_established: Mapped[list["Team"]] = relationship(
        "Team",
        back_populates="created_by",
        foreign_keys="Team.creator_id",
    )

    teams_memberships: Mapped[list["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="member",
        foreign_keys="TeamMember.member_id",
        cascade="all, delete-orphan",
    )

    tasks_established: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="created_by",
        foreign_keys="Task.creator_id",
    )

    tasks_assigned: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="assignee_to",
        foreign_keys="Task.assignee_to_id",
    )

    task_comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="author",
        foreign_keys="TaskComment.author_id",
        cascade="all, delete-orphan",
    )

    refresh_sessions: Mapped[list["RefreshSession"]] = relationship(
        "RefreshSession",
        back_populates="user",
        foreign_keys="RefreshSession.user_id",
        cascade="all, delete-orphan",
    )

    audit_logs: Mapped[list["AuditLog"]] = relationship(
        "AuditLog",
        back_populates="user",
        foreign_keys="AuditLog.user_id",
    )

    def __init__(self, **kwargs) -> None:
        from src.share.helpers import slugify

        if "name" in kwargs and "username" not in kwargs:
            kwargs["username"] = slugify(kwargs["name"])
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"User(id={self.id}, username='{self.username}', email='{self.email}')"