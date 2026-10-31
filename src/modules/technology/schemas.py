from datetime import datetime
from typing import ClassVar, Self
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.database.enums import TechnologyCategory


class CreateTechnologyRequest(BaseModel):
    """Request payload for creating a technology catalog entry."""

    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=50)
    category: TechnologyCategory = Field(default=TechnologyCategory.TOOL)
    description: str | None = Field(default=None, min_length=10, max_length=255)
    documentation_url: str | None = Field(default=None, max_length=500)
    icon_url: str | None = Field(default=None, max_length=500)


class UpdateTechnologyRequest(BaseModel):
    """Request payload for updating a technology catalog entry."""

    model_config = ConfigDict(str_strip_whitespace=True)

    _NON_NULLABLE_FIELDS: ClassVar[tuple[str, ...]] = ("name", "category")

    name: str | None = Field(default=None, min_length=1, max_length=50)
    category: TechnologyCategory | None = Field(default=None)
    description: str | None = Field(default=None, min_length=10, max_length=255)
    documentation_url: str | None = Field(default=None, max_length=500)
    icon_url: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def reject_explicit_null_on_required_fields(self) -> Self:
        for field_name in self._NON_NULLABLE_FIELDS:
            if field_name in self.model_fields_set and getattr(self, field_name) is None:
                raise ValueError(f"Field '{field_name}' cannot be null.")
        return self


class TechnologyResponse(BaseModel):
    """Response payload representing a technology catalog entry."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    category: TechnologyCategory
    description: str | None
    documentation_url: str | None
    icon_url: str | None = None
    created_at: datetime
    updated_at: datetime
