"""Team member domain request and response Pydantic schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field

from src.database.enums import TeamRole


class AddMemberRequest(BaseModel):
    """Schema for adding an existing developer to a team workspace."""

    user_id: int
    role: TeamRole = Field(default=TeamRole.DEVELOPER)


class UpdateMemberRoleRequest(BaseModel):
    """Schema for modifying a team member's role."""

    role: TeamRole


class MemberResponse(BaseModel):
    """Detailed response schema representing a team member."""

    model_config = ConfigDict(from_attributes=True)

    member_id: int
    team_id: int
    role: TeamRole
    is_active: bool
    joined_at: datetime
    name: str | None = None
    username: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    job_title: str | None = None
