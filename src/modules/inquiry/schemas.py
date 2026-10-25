"""Service inquiry request and response schemas."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from src.database.enums import InquiryServiceType, InquiryStatus


class CreateInquiryRequest(BaseModel):
    """Public proposal submission request with bot honeypot protection."""

    model_config = ConfigDict(populate_by_name=True)

    client_name: str = Field(..., min_length=2, max_length=100)
    client_email: EmailStr = Field(...)
    company_name: str | None = Field(default=None, max_length=150)
    service_type: InquiryServiceType = Field(default=InquiryServiceType.OTHER)
    budget_range: str | None = Field(default=None, max_length=50)
    message: str = Field(..., min_length=10, max_length=3000)
    honeypot: str | None = Field(default=None, description="Hidden bot trap field")

    @model_validator(mode="before")
    @classmethod
    def _remap_aliases(cls, data: object) -> object:
        """Seamlessly maps frontend field aliases to canonical schema fields."""
        if isinstance(data, dict):
            mapped = dict(data)
            if "name" in mapped and "client_name" not in mapped:
                mapped["client_name"] = mapped.pop("name")
            if "email" in mapped and "client_email" not in mapped:
                mapped["client_email"] = mapped.pop("email")
            if "company" in mapped and "company_name" not in mapped:
                mapped["company_name"] = mapped.pop("company")
            if "budget" in mapped and "budget_range" not in mapped:
                mapped["budget_range"] = mapped.pop("budget")
            if "company_website" in mapped and "honeypot" not in mapped:
                mapped["honeypot"] = mapped.pop("company_website")
            return mapped
        return data


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
