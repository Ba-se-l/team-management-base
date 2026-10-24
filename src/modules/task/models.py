from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base, CreatedAtUpdatedAtMixin
from src.database.enums import TaskPriority, TaskStatus, str_enum_column

if TYPE_CHECKING:
    from src.modules.project import Project
    from src.modules.user import User


class Task(Base, CreatedAtUpdatedAtMixin):
    """Work item on a project Kanban board."""

    __tablename__ = "tasks"

    # ======================
    # ==== MAIN COLUMNS ====
    # ======================
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[TaskStatus] = mapped_column(
        str_enum_column(TaskStatus, length=32),
        default=TaskStatus.TODO,
        nullable=False,
    )

    priority: Mapped[TaskPriority] = mapped_column(
        str_enum_column(TaskPriority, length=32),
        default=TaskPriority.MEDIUM,
        nullable=False,
    )

    position: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, default=None)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ======================
    # === RELATIONSHIPS ====
    # ======================
    creator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_by: Mapped["User | None"] = relationship(
        "User",
        back_populates="tasks_established",
        foreign_keys=[creator_id],
    )

    assignee_to_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    assignee_to: Mapped["User | None"] = relationship(
        "User",
        back_populates="tasks_assigned",
        foreign_keys=[assignee_to_id],
    )

    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="tasks",
        foreign_keys=[project_id],
    )

    comments: Mapped[list["TaskComment"]] = relationship(
        "TaskComment",
        back_populates="task",
        foreign_keys="TaskComment.task_id",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"Task(id={self.id}, title='{self.title}', status={self.status})"


class TaskComment(Base, CreatedAtUpdatedAtMixin):
    """Discussion comment attached to a specific task."""

    __tablename__ = "task_comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    task_id: Mapped[int] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    author_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content: Mapped[str] = mapped_column(Text, nullable=False)

    task: Mapped["Task"] = relationship(
        "Task",
        back_populates="comments",
        foreign_keys=[task_id],
    )

    author: Mapped["User"] = relationship(
        "User",
        back_populates="task_comments",
        foreign_keys=[author_id],
    )

    def __repr__(self) -> str:
        return f"TaskComment(id={self.id}, task_id={self.task_id}, author_id={self.author_id})"