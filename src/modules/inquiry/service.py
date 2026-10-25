import logging
import random
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.enums import InquiryServiceType, InquiryStatus
from src.exc import NotFoundException
from src.share import AuditEvent, event_bus
from src.share.responses import PageResult
from .models import ServiceInquiry
from .repository import InquiryRepository
from .schemas import CreateInquiryRequest, InquiryResponse, UpdateInquiryStatusRequest

logger = logging.getLogger(__name__)


async def submit_inquiry(
    schema: CreateInquiryRequest,
    ip_address: str | None,
    session: AsyncSession,
) -> InquiryResponse:
    """Submits a client proposal or collaboration request with bot trap defense.

    Args:
        schema: Validated inquiry submission request.
        ip_address: Client IP address string.
        session: Active asynchronous database session.

    Returns:
        InquiryResponse DTO.
    """
    # Honeypot defense: If hidden bot field is filled, silently return fake success without persisting
    if schema.honeypot:
        logger.warning(
            "Honeypot trap triggered from IP: %s (trapped bot input: %s)",
            ip_address,
            schema.honeypot[:50],
        )
        fake_id = random.randint(10000, 99999)
        now = datetime.now(timezone.utc)
        return InquiryResponse(
            id=fake_id,
            client_name=schema.client_name,
            client_email=str(schema.client_email),
            company_name=schema.company_name,
            service_type=schema.service_type,
            budget_range=schema.budget_range,
            message=schema.message,
            status=InquiryStatus.NEW,
            created_at=now,
            updated_at=now,
        )

    repo = InquiryRepository(session=session)
    inquiry = ServiceInquiry(
        client_name=schema.client_name,
        client_email=str(schema.client_email),
        company_name=schema.company_name,
        service_type=schema.service_type,
        budget_range=schema.budget_range,
        message=schema.message,
        status=InquiryStatus.NEW,
        ip_address=ip_address,
    )
    inquiry = await repo.create(inquiry)
    await session.flush()

    await event_bus.publish(
        AuditEvent(
            action="INQUIRY_SUBMITTED",
            entity_type="Inquiry",
            entity_id=str(inquiry.id),
            user_id=None,
            changes_payload={
                "client_name": inquiry.client_name,
                "client_email": inquiry.client_email,
                "service_type": inquiry.service_type.value,
            },
            ip_address=ip_address,
        ),
        session=session,
    )

    return InquiryResponse.model_validate(inquiry)


async def list_inquiries(
    session: AsyncSession,
    status: InquiryStatus | None = None,
    service_type: InquiryServiceType | None = None,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[InquiryResponse]:
    """Retrieves paginated inquiries with optional status/type filtering for administrators.

    Args:
        session: Active asynchronous database session.
        status: Optional InquiryStatus filter.
        service_type: Optional InquiryServiceType filter.
        offset: Record offset.
        limit: Record limit.

    Returns:
        PageResult of InquiryResponse DTOs.
    """
    repo = InquiryRepository(session=session)
    page = await repo.list_filtered(
        status=status,
        service_type=service_type,
        offset=offset,
        limit=limit,
    )
    return PageResult(
        items=[InquiryResponse.model_validate(item) for item in page.items],
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )


async def get_inquiry(inquiry_id: int, session: AsyncSession) -> InquiryResponse:
    """Retrieves an inquiry by ID.

    Args:
        inquiry_id: Inquiry integer primary key.
        session: Active asynchronous database session.

    Returns:
        InquiryResponse DTO.

    Raises:
        NotFoundException: If inquiry does not exist.
    """
    repo = InquiryRepository(session=session)
    inquiry = await repo.get_by_id(inquiry_id)
    if inquiry is None:
        raise NotFoundException(entity="ServiceInquiry", identifier=inquiry_id)
    return InquiryResponse.model_validate(inquiry)


async def update_inquiry_status(
    inquiry_id: int,
    schema: UpdateInquiryStatusRequest,
    session: AsyncSession,
) -> InquiryResponse:
    """Updates an inquiry's status and records administrative notes.

    Args:
        inquiry_id: Target inquiry ID.
        schema: Status update request.
        session: Active asynchronous database session.

    Returns:
        Updated InquiryResponse.

    Raises:
        NotFoundException: If inquiry does not exist.
    """
    repo = InquiryRepository(session=session)
    inquiry = await repo.get_by_id(inquiry_id)
    if inquiry is None:
        raise NotFoundException(entity="ServiceInquiry", identifier=inquiry_id)

    update_dict = {"status": schema.status}
    inquiry = await repo.update(inquiry, update_dict)
    return InquiryResponse.model_validate(inquiry)
