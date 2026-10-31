"""Inquiry repository providing persistence operations for service proposals."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import BaseRepository
from src.database.enums import InquiryServiceType, InquiryStatus
from src.share.responses import PageResult
from .models import ServiceInquiry


class InquiryRepository(BaseRepository[ServiceInquiry]):
    """Data repository for ServiceInquiry entities."""

    def __init__(self, session: AsyncSession) -> None:
        """Initializes with ServiceInquiry model.

        Args:
            session: Active asynchronous database session.
        """
        super().__init__(class_=ServiceInquiry, session=session)

    async def list_filtered(
        self,
        status: InquiryStatus | None = None,
        service_type: InquiryServiceType | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[ServiceInquiry]:
        """Queries inquiries with optional status and service_type filters.

        Args:
            status: Optional InquiryStatus filter.
            service_type: Optional InquiryServiceType filter.
            offset: Record offset.
            limit: Record limit.

        Returns:
            PageResult of ServiceInquiry instances.
        """
        stmt = select(ServiceInquiry).order_by(ServiceInquiry.id.desc())
        if status is not None:
            stmt = stmt.where(ServiceInquiry.status == status)
        if service_type is not None:
            stmt = stmt.where(ServiceInquiry.service_type == service_type)

        return await self.paginate(stmt, offset=offset, limit=limit)
