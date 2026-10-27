"""Team domain request and response Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CreateTeamRequest(BaseModel):
    """Schema for creating a new team workspace."""

    name: str = Field(min_length=2, max_length=100)
    slug: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class UpdateTeamRequest(BaseModel):
    """Schema for updating team workspace details."""

    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = Field(default=None)


class TeamResponse(BaseModel):
    """Schema for team data in API responses."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    description: str | None = None
    is_active: bool
    creator_id: int | None = None
    members_count: int = 0
    projects_count: int = 0
    created_at: datetime
    updated_at: datetime
