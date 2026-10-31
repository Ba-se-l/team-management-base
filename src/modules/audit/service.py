"""Audit logging service managing immutable event recording and querying."""

from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from src.share import AuditEvent, event_bus
from src.share.responses import PageResult
from .model import AuditLog
from .repository import AuditRepository
from .schemas import AuditLogResponse


async def on_audit_event(event: AuditEvent, session: AsyncSession | None) -> None:
    """Asynchronous event bus handler that records domain facts to the audit trail."""
    if session is None:
        return
    await record_audit_event(
        session=session,
        action=event.action,
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        user_id=event.user_id,
        changes_payload=event.changes_payload,
        ip_address=event.ip_address or (event.audit_ctx.ip_address if event.audit_ctx else None),
    )


def register_audit_subscribers() -> None:
    """Subscribes the audit handler to domain events on the event bus."""
    event_bus.subscribe(AuditEvent, on_audit_event)


register_audit_subscribers()


def _build_audit_response(log: AuditLog) -> AuditLogResponse:
    """Builds an AuditLogResponse with hydrated actor username."""
    user = getattr(log, "user", None)
    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        user_username=user.username if user else None,
        action=log.action,
        entity_type=log.entity_type,
        entity_id=log.entity_id,
        changes_payload=log.changes_payload,
        ip_address=log.ip_address,
        created_at=log.created_at,
    )


async def record_audit_event(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    user_id: int | None = None,
    changes_payload: dict[str, Any] | None = None,
    ip_address: str | None = None,
) -> AuditLog:
    """Appends an audit record within the current transaction.

    Args:
        session: Active asynchronous database session.
        action: Identifier for the action (e.g. 'AUTH_LOGIN', 'PROJECT_DELETED').
        entity_type: Target domain entity (e.g. 'Project', 'User').
        entity_id: Target entity identifier.
        user_id: Performing user ID.
        changes_payload: Optional structured metadata.
        ip_address: Client IP address.

    Returns:
        Persisted AuditLog record.
    """
    repo = AuditRepository(session=session)
    async with session.begin_nested():
        return await repo.log_event(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            changes_payload=changes_payload,
            ip_address=ip_address,
        )


async def list_audit_logs(
    session: AsyncSession,
    user_id: int | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> PageResult[AuditLogResponse]:
    """Retrieves paginated audit log entries for administrators.

    Args:
        session: Active asynchronous database session.
        user_id: Optional actor user ID filter.
        action: Optional action string filter.
        entity_type: Optional entity type filter.
        offset: Record offset.
        limit: Record limit.

    Returns:
        PageResult of AuditLogResponse DTOs.
    """
    repo = AuditRepository(session=session)
    page = await repo.list_filtered(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        offset=offset,
        limit=limit,
    )
    return PageResult(
        items=[_build_audit_response(item) for item in page.items],
        total=page.total,
        offset=page.offset,
        limit=page.limit,
    )
