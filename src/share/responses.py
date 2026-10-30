"""Standardized API pagination schemas, error envelopes, and response models.

Paginated endpoints return ``PageResult[T]`` (``items``, ``total``, ``offset``, ``limit``),
single-item endpoints return their domain response schema directly, and all error
handlers uniformly return ``ErrorResponse``.
"""

import math
from typing import Annotated, Any
from fastapi import Query
from pydantic import BaseModel, ConfigDict, Field


class PaginationParams:
    """FastAPI dependency for reading standard pagination query parameters."""

    def __init__(
        self,
        page: Annotated[int, Query(ge=1, description="Page number (1-indexed)")] = 1,
        page_size: Annotated[int, Query(ge=1, le=100, description="Items per page")] = 20,
    ) -> None:
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size


class PaginationMeta(BaseModel):
    """Pagination metadata included in every paginated response."""

    page: int
    """Current page number (1-indexed)."""

    page_size: int
    """Number of items per page."""

    total: int
    """Total number of items matching the query."""

    pages: int
    """Total number of pages calculated from total and page_size."""

    @classmethod
    def from_params(
        cls,
        *,
        page: int,
        page_size: int,
        total: int,
    ) -> "PaginationMeta":
        """Constructs PaginationMeta and computes the total page count.

        Args:
            page: Current page number.
            page_size: Number of items per page.
            total: Total matching records count.

        Returns:
            Fully populated PaginationMeta instance.
        """
        return cls(
            page=page,
            page_size=page_size,
            total=total,
            pages=max(1, math.ceil(total / page_size)),
        )


class PageResult[T](BaseModel):
    """Internal repository return model containing items, total count, and pagination window."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    items: list[T]
    """List of retrieved model instances."""

    total: int
    """Total matching rows in the database."""

    offset: int = 0
    """Record offset."""

    limit: int = 20
    """Record limit."""


class PaginatedResponse[T](BaseModel):
    """Generic envelope for paginated collection responses."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    success: bool = True
    """Always True for successful operations."""

    data: list[T]
    """Current slice of items."""

    pagination: PaginationMeta
    """Pagination metadata window."""


class ErrorDetail(BaseModel):
    """Structured error payload nested within ErrorResponse."""

    code: str
    """Machine-readable error identifier."""

    message: str
    """Human-readable error description."""

    details: Any | None = None
    """Optional validation errors or contextual debugging details."""


class ErrorResponse(BaseModel):
    """Unified error envelope returned by all exception handlers."""

    success: bool = False
    """Always False for error responses."""

    error: ErrorDetail
    """Structured error information."""

    request_id: str | None = None
    """Distributed correlation ID for server-side log tracing."""


class SuccessResponse[T](BaseModel):
    """Generic single-item success response envelope."""

    model_config = ConfigDict(arbitrary_types_allowed=True)

    success: bool = True
    """Always True for successful operations."""

    data: T
    """Result payload."""


class MessageResponse(BaseModel):
    """Simple confirmation envelope for write operations."""

    success: bool = True
    """Always True for successful operations."""

    message: str
    """Human-readable confirmation message."""
