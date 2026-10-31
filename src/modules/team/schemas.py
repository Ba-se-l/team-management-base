"""Team domain request and response Pydantic schemas."""

from datetime import datetime
from typing import ClassVar, Self
from pydantic import BaseModel, ConfigDict, Field, model_validator


class CreateTeamRequest(BaseModel):
    """Schema for creating a new team workspace."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=2, max_length=100)
    slug: str | None = Field(default=None, max_length=120)
    description: str | None = Field(default=None, max_length=500)


class UpdateTeamRequest(BaseModel):
    """Schema for updating team workspace details."""

    model_config = ConfigDict(str_strip_whitespace=True)

    _NON_NULLABLE_FIELDS: ClassVar[tuple[str, ...]] = ("name", "is_active")

    name: str | None = Field(default=None, min_length=2, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    is_active: bool | None = Field(default=None)

    @model_validator(mode="after")
    def reject_explicit_null_on_required_fields(self) -> Self:
        for field_name in self._NON_NULLABLE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"Field '{field_name}' cannot be null.")
        return self


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
