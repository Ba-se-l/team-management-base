"""Inquiry module facade exporting model, repository, schemas, and routers."""

from .models import ServiceInquiry
from .repository import InquiryRepository
from .router import admin_router, public_router
from .schemas import CreateInquiryRequest, InquiryResponse, UpdateInquiryStatusRequest

__all__ = (
    "ServiceInquiry",
    "InquiryRepository",
    "CreateInquiryRequest",
    "UpdateInquiryStatusRequest",
    "InquiryResponse",
    "public_router",
    "admin_router",
)
