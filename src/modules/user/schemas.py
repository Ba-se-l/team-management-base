from datetime import datetime
from typing import ClassVar, Self
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from src.database import JobTitle, UserStatus


class CreateUserRequest(BaseModel):
    """Schema for administrator user creation request."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=100)
    """The user's full name."""

    email: EmailStr = Field()
    """The user's email address, must be unique."""

    password: str = Field(min_length=8, max_length=100)
    """The user's plain-text password. Will be hashed before storage."""

    username: str | None = Field(default=None, min_length=3, max_length=50)
    """Optional unique username. Generated from email if omitted."""

    job_title: JobTitle | None = Field(default=None)
    """Optional initial job title."""

    bio: str | None = Field(default=None, max_length=500)
    """Optional user biography."""

    avatar_url: str | None = Field(default=None, max_length=500)
    """Optional avatar URL."""

    github_url: str | None = Field(default=None, max_length=255)
    """Optional GitHub profile URL."""

    linkedin_url: str | None = Field(default=None, max_length=255)
    """Optional LinkedIn profile URL."""

    website_url: str | None = Field(default=None, max_length=255)
    """Optional personal website/portfolio URL."""

    is_super_admin: bool = Field(default=False)
    """Whether the user receives platform super administrator privileges."""

    is_public_member: bool = Field(default=False)
    """Explicit opt-in flag for displaying profile in the public showcase."""

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        """Normalizes email to lowercase and strips whitespace."""
        return str(v).strip().lower()


class UpdateSchemaRequest(BaseModel):
    """Schema for updating user profile."""

    model_config = ConfigDict(str_strip_whitespace=True)

    _NON_NULLABLE_FIELDS: ClassVar[tuple[str, ...]] = (
        "name",
        "is_public_member",
        "status",
    )

    name: str | None = Field(default=None, min_length=1, max_length=100)
    """Updated full name."""

    job_title: JobTitle | None = Field(default=None)
    """Updated job title."""

    bio: str | None = Field(default=None, max_length=500)
    """Updated biography."""

    avatar_url: str | None = Field(default=None, max_length=500)
    """Updated avatar URL."""

    github_url: str | None = Field(default=None, max_length=255)
    """Updated GitHub profile URL."""

    linkedin_url: str | None = Field(default=None, max_length=255)
    """Updated LinkedIn profile URL."""

    website_url: str | None = Field(default=None, max_length=255)
    """Updated personal website/portfolio URL."""

    is_public_member: bool | None = Field(default=None)
    """Updated public showcase opt-in flag."""

    status: UserStatus | None = Field(default=None)
    """Updated user availability status."""

    @model_validator(mode="after")
    def reject_explicit_null_on_required_fields(self) -> Self:
        for field_name in self._NON_NULLABLE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"Field '{field_name}' cannot be null.")
        return self


class ChangePasswordRequest(BaseModel):
    """Schema for password change request."""

    old_password: str = Field(min_length=8, max_length=128)
    """Current password for verification."""

    new_password: str = Field(min_length=8, max_length=100)
    """New password to set."""


class UserResponse(BaseModel):
    """Schema for user data in API responses, excluding sensitive fields."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    username: str
    email: str
    avatar_url: str | None = None
    bio: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    website_url: str | None = None
    is_active: bool
    is_public_member: bool = False
    is_super_admin: bool
    status: UserStatus
    job_title: JobTitle | None = None
    security_version: int = 1
    created_at: datetime
    updated_at: datetime


class DeveloperDashboardResponse(BaseModel):
    """Aggregated workload statistics and metric counts for developer dashboard."""

    total_assigned_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    review_tasks: int
    completed_tasks: int
    overdue_tasks: int
    active_teams_count: int
    active_projects_count: int





