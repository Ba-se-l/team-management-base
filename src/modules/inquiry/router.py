"""Inquiry routers: public proposal submission endpoint and super admin triage router."""

from typing import Annotated
from fastapi import APIRouter, Depends, Path, Query, Request, status

from src.conf import settings
from src.database.enums import InquiryServiceType, InquiryStatus
from src.security.guards import require_super_admin
from src.share.dependencies import SessionDep
from src.share.helpers import resolve_client_ip
from src.share.rate_limit import RateLimiter
from src.share.responses import PageResult
from . import service
from .schemas import CreateInquiryRequest, InquiryResponse, UpdateInquiryStatusRequest

public_router = APIRouter(prefix=f"{settings.API_PREFIX}/public/inquiries", tags=["Public Inquiries"])
admin_router = APIRouter(
    prefix=f"{settings.API_PREFIX}/inquiries",
    tags=["Inquiries"],
    dependencies=[Depends(require_super_admin)],
)

inquiry_rate_limiter = RateLimiter(requests_limit=settings.INQUIRY_RATE_LIMIT, window_seconds=60)


@public_router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Submit client inquiry or collaboration proposal",
    dependencies=[Depends(inquiry_rate_limiter)],
)
async def submit_public_inquiry(
    request: Request,
    payload: CreateInquiryRequest,
    session: SessionDep,
) -> InquiryResponse:
    """Receives client inquiries and developer requests with honeypot bot defense."""
    client_ip = resolve_client_ip(request)
    return await service.submit_inquiry(
        schema=payload,
        ip_address=client_ip,
        session=session,
    )


@admin_router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List client inquiries",
)
async def list_admin_inquiries(
    session: SessionDep,
    status_filter: Annotated[InquiryStatus | None, Query(alias="status")] = None,
    service_type: Annotated[InquiryServiceType | None, Query()] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageResult[InquiryResponse]:
    """Retrieves paginated client inquiries. Super administrator privileges required."""
    return await service.list_inquiries(
        session=session,
        status=status_filter,
        service_type=service_type,
        offset=offset,
        limit=limit,
    )


@admin_router.get(
    "/{inquiry_id}",
    status_code=status.HTTP_200_OK,
    summary="Get inquiry details",
)
async def get_admin_inquiry(
    inquiry_id: Annotated[int, Path(ge=1, description="Inquiry ID")],
    session: SessionDep,
) -> InquiryResponse:
    """Retrieves specific inquiry details for triage."""
    return await service.get_inquiry(inquiry_id=inquiry_id, session=session)


@admin_router.patch(
    "/{inquiry_id}",
    status_code=status.HTTP_200_OK,
    summary="Update inquiry status",
)
async def update_admin_inquiry(
    inquiry_id: Annotated[int, Path(ge=1, description="Inquiry ID")],
    payload: UpdateInquiryStatusRequest,
    session: SessionDep,
) -> InquiryResponse:
    """Updates status for an inquiry."""
    return await service.update_inquiry_status(
        inquiry_id=inquiry_id,
        schema=payload,
        session=session,
    )
