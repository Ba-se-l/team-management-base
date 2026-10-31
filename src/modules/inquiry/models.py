"""Public portal service inquiry and developer join request ORM model."""

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from src.database import Base, CreatedAtUpdatedAtMixin
from src.database.enums import InquiryServiceType, InquiryStatus, str_enum_column


class ServiceInquiry(Base, CreatedAtUpdatedAtMixin):
    """Client proposal or developer collaboration inquiry received via the public portal."""

    __tablename__ = "service_inquiries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    client_name: Mapped[str] = mapped_column(String(100), nullable=False)

    client_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    company_name: Mapped[str | None] = mapped_column(String(150), nullable=True, default=None)

    service_type: Mapped[InquiryServiceType] = mapped_column(
        str_enum_column(InquiryServiceType, length=32),
        default=InquiryServiceType.OTHER,
        nullable=False,
    )

    budget_range: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)

    message: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[InquiryStatus] = mapped_column(
        str_enum_column(InquiryStatus, length=32),
        default=InquiryStatus.NEW,
        nullable=False,
    )

    admin_notes: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True, default=None)

    def __repr__(self) -> str:
        return f"ServiceInquiry(id={self.id}, client_email='{self.client_email}', status={self.status})"
