from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime



class CreateTechnologyRequest(BaseModel):

    name: str = Field(max_length=100)
    description: str | None = Field(default=None, min_length=10, max_length=1000)
    documentation_url: str | None = Field(default=None, max_length=500)


class UpdateTechnologyRequest(BaseModel):

    name: str | None = Field(default=None, max_length=100)
    description: str | None = Field(default=None, min_length=10, max_length=1000)
    documentation_url: str | None = Field(default=None, max_length=500)


class TechnologyResponse(BaseModel):

    # To enable ORM validate -> ModelClass.model_validate(orm_instance)
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    documentation_url: str | None
    created_at: datetime
    updated_at: datetime
