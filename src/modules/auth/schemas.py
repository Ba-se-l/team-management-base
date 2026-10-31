"""Authentication domain request and response Pydantic schemas."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from src.modules.user.schemas import UserResponse


class LoginRequest(BaseModel):
    """Schema for user login credentials."""

    email: EmailStr = Field()
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email", mode="after")
    @classmethod
    def normalize_email(cls, v: EmailStr) -> str:
        """Normalizes email to lowercase and strips whitespace."""
        return str(v).strip().lower()


class TokenResponse(BaseModel):
    """Schema returned on successful login and token rotation."""

    access_token: str
    token_type: str = "bearer"
    expires_in: int = 1800
    user: UserResponse


class RefreshRequest(BaseModel):
    """Optional payload for token refresh when HttpOnly cookie is unavailable."""

    refresh_token: str | None = Field(default=None)


class UserMeMembershipResponse(BaseModel):
    """Represents a user's active membership in a team workspace."""

    model_config = ConfigDict(from_attributes=True)

    team_id: int
    team_name: str
    team_slug: str
    role: str


class UserMeResponse(BaseModel):
    """Full authenticated user identity profile with workspace memberships."""

    model_config = ConfigDict(from_attributes=True)

    user: UserResponse
    memberships: list[UserMeMembershipResponse]