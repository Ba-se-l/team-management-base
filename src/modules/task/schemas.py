"""Task domain request and response Pydantic schemas including Kanban structures."""

from datetime import datetime
from typing import ClassVar, Self
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from src.database.enums import TaskPriority, TaskStatus


class TaskCommentResponse(BaseModel):
    """Schema representing a comment posted on a task."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    task_id: int
    author_id: int
    author_name: str | None = None
    author_username: str | None = None
    author_avatar_url: str | None = None
    content: str
    created_at: datetime
    updated_at: datetime


class CreateCommentRequest(BaseModel):
    """Schema for adding a comment to a task."""

    model_config = ConfigDict(str_strip_whitespace=True)

    content: str = Field(min_length=1, max_length=2000)


class CreateTaskRequest(BaseModel):
    """Schema for creating a work item in a project."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=5000)
    status: TaskStatus = Field(default=TaskStatus.TODO)
    priority: TaskPriority = Field(default=TaskPriority.MEDIUM)
    position: float | None = Field(default=None, ge=0.0, le=1e9, allow_inf_nan=False)
    deadline: datetime | None = Field(default=None)
    assignee_to_id: int | None = Field(default=None)

    @field_validator("description", mode="before")
    @classmethod
    def coalesce_none_description(cls, v: str | None) -> str:
        """Allows UI clients to omit or send null for optional task description."""
        return "" if v is None else v


class UpdateTaskRequest(BaseModel):
    """Schema for updating task attributes."""

    model_config = ConfigDict(str_strip_whitespace=True)

    _NON_NULLABLE_FIELDS: ClassVar[tuple[str, ...]] = (
        "title",
        "description",
        "status",
        "priority",
        "position",
        "is_active",
    )

    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: TaskStatus | None = Field(default=None)
    priority: TaskPriority | None = Field(default=None)
    position: float | None = Field(default=None, ge=0.0, le=1e9, allow_inf_nan=False)
    deadline: datetime | None = Field(default=None)
    assignee_to_id: int | None = Field(default=None)
    is_active: bool | None = Field(default=None)

    @model_validator(mode="after")
    def reject_explicit_null_on_required_fields(self) -> Self:
        for field_name in self._NON_NULLABLE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"Field '{field_name}' cannot be null.")
        return self


class MoveTaskRequest(BaseModel):
    """Schema for Kanban drag-and-drop workflow transition."""

    status: TaskStatus
    position: float = Field(ge=0.0, le=1e9, allow_inf_nan=False)


class TaskResponse(BaseModel):
    """Detailed response schema for a task with assignee and comment metadata."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    position: float
    deadline: datetime | None = None
    completed_at: datetime | None = None
    is_active: bool
    creator_id: int | None = None
    creator_username: str | None = None
    assignee_to_id: int | None = None
    assignee_username: str | None = None
    assignee_name: str | None = None
    assignee_avatar_url: str | None = None
    project_id: int
    comments_count: int = 0
    comments: list[TaskCommentResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class KanbanBoardResponse(BaseModel):
    """Kanban board layout grouping project tasks into ordered workflow columns."""

    project_id: int
    project_title: str
    columns: dict[TaskStatus, list[TaskResponse]]