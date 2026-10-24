from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base, CreatedAtUpdatedAtMixin
from src.database.enums import ProjectStatus, ProjectVisibility, str_enum_column
from src.modules.m2m import ProjectsTechnologies

if TYPE_CHECKING:
    from src.modules.task import Task
    from src.modules.team import Team
    from src.modules.technology import Technology
    from src.modules.user import User


class Project(Base, CreatedAtUpdatedAtMixin):
    """Development project or agency showcase portfolio work item."""

    __tablename__ = "projects"

    # ======================
    # ==== MAIN COLUMNS ====
    # ======================
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    title: Mapped[str] = mapped_column(String(150), nullable=False)

    slug: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)

    short_description: Mapped[str] = mapped_column(String(500), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    visibility: Mapped[ProjectVisibility] = mapped_column(
        str_enum_column(ProjectVisibility, length=32),
        default=ProjectVisibility.PRIVATE,
        nullable=False,
    )

    status: Mapped[ProjectStatus] = mapped_column(
        str_enum_column(ProjectStatus, length=32),
        default=ProjectStatus.PLANNING,
        nullable=False,
    )

    demo_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    repo_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    # ======================
    # === RELATIONSHIPS ====
    # ======================
    creator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_by: Mapped["User | None"] = relationship(
        "User",
        back_populates="projects_established",
        foreign_keys=[creator_id],
    )

    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="projects",
        foreign_keys=[team_id],
    )

    tasks: Mapped[list["Task"]] = relationship(
        "Task",
        back_populates="project",
        foreign_keys="Task.project_id",
        cascade="all, delete-orphan",
    )

    technologies: Mapped[list["Technology"]] = relationship(
        "Technology",
        back_populates="projects",
        secondary=ProjectsTechnologies,
        lazy="selectin",
    )

    def __init__(self, **kwargs) -> None:
        from src.share.helpers import slugify

        if "title" in kwargs and "slug" not in kwargs:
            kwargs["slug"] = slugify(kwargs["title"])
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"Project(id={self.id}, slug='{self.slug}', title='{self.title}', status={self.status})"

