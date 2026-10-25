"""Shared domain event models, telemetry contexts, and HTTP mappings."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import StrEnum
from typing import Any
from typing_extensions import TypedDict
from pydantic import BaseModel, ConfigDict


class TokenType(StrEnum):
    """Supported JSON Web Token types."""

    ACCESS = "access"
    """Short-lived authorization token."""

    REFRESH = "refresh"
    """Long-lived rotational session token."""


_HTTP_ERROR_CODE_MAP: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    408: "REQUEST_TIMEOUT",
    409: "CONFLICT",
    413: "PAYLOAD_TOO_LARGE",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_SERVER_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
    504: "GATEWAY_TIMEOUT",
}


@dataclass(frozen=True, slots=True)
class AuditContext:
    """Telemetry context captured at the HTTP boundary."""

    ip_address: str | None = None
    """Client IP address resolved from socket or trusted proxy."""

    user_agent: str | None = None
    """Truncated HTTP User-Agent header."""

    request_id: str | None = None
    """Distributed correlation request ID."""


class AuditContextDict(TypedDict, total=True):
    """Dictionary representation of request telemetry for persistence."""

    ip: str | None
    ua: str | None
    req_id: str | None


@dataclass(frozen=True, slots=True, kw_only=True)
class DomainEvent:
    """Immutable base class for every domain fact published on the async event bus.

    Subclasses MUST be declared with ``kw_only=True`` to allow non-default
    fields in derived classes without breaking dataclass ordering rules.
    """

    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    """UTC timestamp when the event occurred."""

    audit_ctx: AuditContext | None = None
    """Optional telemetry context captured when the event was emitted."""


@dataclass(frozen=True, slots=True, kw_only=True)
class AuditEvent(DomainEvent):
    """Domain event representing an auditable action across business domains."""

    action: str
    """Action identifier (e.g. 'TASK_CREATED', 'TASK_MOVED', 'PROJECT_CREATED')."""

    entity_type: str
    """Target entity type name (e.g. 'Task', 'Project', 'Team', 'Inquiry')."""

    entity_id: str | None = None
    """Identifier of the entity affected."""

    user_id: int | None = None
    """ID of the user who performed the action."""

    changes_payload: dict[str, Any] | None = None
    """Structured diff or payload of changes."""

    ip_address: str | None = None
    """Client IP address recorded during the action."""


class TokenPayload(BaseModel):
    """Structured JWT claims representation."""

    model_config = ConfigDict(extra="ignore")

    sub: str
    """User primary key identifier encoded as string."""

    type: TokenType
    """Token type claim ('access' or 'refresh')."""

    jti: str | None = None
    """Unique JWT ID claim for session rotation and revocation."""

    fid: str | None = None
    """Family lineage ID tracking token rotations across an active session."""

    sec_ver: int = 1
    """Security version tracking credential invalidation."""

    iat: datetime
    """Issued-at timestamp."""

    exp: datetime
    """Expiration timestamp."""


class TokenResponse(BaseModel):
    """OAuth2-compatible dual token response schema."""

    access_token: str
    """Signed JWT access token."""

    refresh_token: str | None = None
    """Rotational JWT refresh token (omitted when delivered via HttpOnly cookie)."""

    token_type: str = "Bearer"
    """Standard Bearer token authorization scheme."""
