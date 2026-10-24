"""Shared kernel package facade.

Exposes domain event bus, uniform response envelopes, telemetry schemas,
middleware, rate limiters, and common helper functions.
"""

from .event_bus import AsyncEventBus, event_bus
from .helpers import (
    get_audit_context,
    get_audit_context_dict,
    get_extra_dict_for_updates,
    resolve_client_ip,
    slugify,
)
from .limits import (
    AUDIT_IP_MAX,
    AUDIT_REQUEST_ID_MAX,
    AUDIT_USER_AGENT_MAX,
    AUDIT_USER_ID_MAX,
)
from .middleware import RequestIdMiddleware, get_current_request_id
from .rate_limit import RateLimiter
from .responses import (
    ErrorDetail,
    ErrorResponse,
    MessageResponse,
    PageResult,
    PaginatedResponse,
    PaginationMeta,
    PaginationParams,
    SuccessResponse,
)
from .schemas import (
    _HTTP_ERROR_CODE_MAP,
    AuditContext,
    AuditContextDict,
    DomainEvent,
    TokenPayload,
    TokenResponse,
    TokenType,
)

__all__ = (
    "AsyncEventBus",
    "event_bus",
    "get_audit_context",
    "get_audit_context_dict",
    "get_extra_dict_for_updates",
    "resolve_client_ip",
    "slugify",
    "AUDIT_IP_MAX",
    "AUDIT_REQUEST_ID_MAX",
    "AUDIT_USER_AGENT_MAX",
    "AUDIT_USER_ID_MAX",
    "RequestIdMiddleware",
    "get_current_request_id",
    "RateLimiter",
    "ErrorDetail",
    "ErrorResponse",
    "MessageResponse",
    "PageResult",
    "PaginatedResponse",
    "PaginationMeta",
    "PaginationParams",
    "SuccessResponse",
    "_HTTP_ERROR_CODE_MAP",
    "AuditContext",
    "AuditContextDict",
    "DomainEvent",
    "TokenPayload",
    "TokenResponse",
    "TokenType",
)
