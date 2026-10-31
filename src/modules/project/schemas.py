"""Project domain request and response Pydantic schemas."""

from datetime import datetime
from typing import ClassVar, Self
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.database.enums import ProjectStatus, ProjectVisibility, TechnologyCategory


class ProjectTechnologySummary(BaseModel):
    """Compact summary of a technology linked to a project."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    category: TechnologyCategory
    icon_url: str | None = None


class CreateProjectRequest(BaseModel):
    """Schema for creating a new project in a team workspace."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=2, max_length=150)
    slug: str | None = Field(default=None, max_length=160)
    short_description: str = Field(min_length=5, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    visibility: ProjectVisibility = Field(default=ProjectVisibility.PRIVATE)
    status: ProjectStatus = Field(default=ProjectStatus.PLANNING)
    demo_url: str | None = Field(default=None, max_length=500)
    repo_url: str | None = Field(default=None, max_length=500)
    deadline: datetime | None = Field(default=None)
    technology_ids: list[int] = Field(default_factory=list)


class UpdateProjectRequest(BaseModel):
    """Schema for updating an existing project."""

    model_config = ConfigDict(str_strip_whitespace=True)

    _NON_NULLABLE_FIELDS: ClassVar[tuple[str, ...]] = (
        "title",
        "short_description",
        "status",
        "visibility",
        "is_active",
        "technology_ids",
    )

    title: str | None = Field(default=None, min_length=2, max_length=150)
    short_description: str | None = Field(default=None, min_length=5, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    status: ProjectStatus | None = Field(default=None)
    visibility: ProjectVisibility | None = Field(default=None)
    demo_url: str | None = Field(default=None, max_length=500)
    repo_url: str | None = Field(default=None, max_length=500)
    deadline: datetime | None = Field(default=None)
    is_active: bool | None = Field(default=None)
    technology_ids: list[int] | None = Field(default=None)

    @model_validator(mode="after")
    def reject_explicit_null_on_required_fields(self) -> Self:
        for field_name in self._NON_NULLABLE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"Field '{field_name}' cannot be null.")
        return self


class ProjectResponse(BaseModel):
    """Comprehensive schema for project details in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: str
    description: str | None = None
    is_active: bool
    featured: bool = False
    visibility: ProjectVisibility
    status: ProjectStatus
    demo_url: str | None = None
    repo_url: str | None = None
    deadline: datetime | None = None
    released_at: datetime | None = None
    creator_id: int | None = None
    team_id: int
    technologies: list[ProjectTechnologySummary] = Field(default_factory=list)
    tasks_count: int = 0
    tasks_completed_count: int = 0
    created_at: datetime
    updated_at: datetime