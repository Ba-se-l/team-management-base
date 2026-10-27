from pydantic import BaseModel, ConfigDict, Field, EmailStr
from datetime import datetime


from src.database import UserStatus, JobTitle


class CreateUserRequest(BaseModel):
    """Schema for administrator user creation request."""

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

    is_super_admin: bool = Field(default=False)
    """Whether the user receives platform super administrator privileges."""


class UpdateSchemaRequest(BaseModel):
    """Schema for updating user profile"""

    name: str | None = Field(default=None, min_length=1, max_length=100)
    """Updated full name"""

    job_title: JobTitle | None = Field(default=None)
    """Updated job title"""

    bio: str | None = Field(default=None, max_length=500)
    """Updated biography"""


class ChangePasswordRequest(BaseModel):
    """Schema for password change request"""

    old_password: str = Field(min_length=8)
    """Current password for verification"""

    new_password: str = Field(min_length=8, max_length=100)
    """New password to set"""



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





