"""Service inquiry request and response schemas."""

from datetime import datetime
from pydantic import AliasChoices, BaseModel, ConfigDict, EmailStr, Field

from src.database.enums import InquiryServiceType, InquiryStatus


class CreateInquiryRequest(BaseModel):
    """Public proposal submission request with bot honeypot protection."""

    model_config = ConfigDict(populate_by_name=True)

    client_name: str = Field(
        validation_alias=AliasChoices("client_name", "name"),
        min_length=2,
        max_length=100,
    )
    client_email: EmailStr = Field(
        validation_alias=AliasChoices("client_email", "email"),
    )
    company_name: str | None = Field(
        default=None,
        validation_alias=AliasChoices("company_name", "company"),
        max_length=150,
    )
    service_type: InquiryServiceType = Field(default=InquiryServiceType.OTHER)
    budget_range: str | None = Field(
        default=None,
        validation_alias=AliasChoices("budget_range", "budget"),
        max_length=50,
    )
    message: str = Field(min_length=10, max_length=3000)
    honeypot: str | None = Field(
        default=None,
        validation_alias=AliasChoices("honeypot", "company_website"),
        description="Hidden bot trap field",
    )


class UpdateInquiryStatusRequest(BaseModel):
    """Administrative inquiry triage and notes schema."""

    status: InquiryStatus
    admin_notes: str | None = Field(default=None, max_length=1000)


class InquiryResponse(BaseModel):
    """Detailed representation of an inquiry."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    client_name: str
    client_email: str
    company_name: str | None = None
    service_type: InquiryServiceType
    budget_range: str | None = None
    message: str
    status: InquiryStatus
    created_at: datetime
    updated_at: datetime
