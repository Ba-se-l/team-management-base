"""Audit log repository providing audit query and recording operations."""

from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import BaseRepository
from src.share.responses import PageResult
from .model import AuditLog


class AuditRepository(BaseRepository[AuditLog]):
    """Data repository for AuditLog records."""

    def __init__(self, session: AsyncSession) -> None:
        """Initializes with AuditLog model.

        Args:
            session: Active asynchronous database session.
        """
        super().__init__(class_=AuditLog, session=session)

    async def log_event(
        self,
        *,
        action: str,
        entity_type: str,
        entity_id: str | None = None,
        user_id: int | None = None,
        changes_payload: dict[str, Any] | None = None,
        ip_address: str | None = None,
    ) -> AuditLog:
        """Appends an immutable audit log entry.

        Args:
            action: Action tag (e.g. 'AUTH_LOGIN', 'TEAM_CREATE').
            entity_type: Target entity name (e.g. 'Team', 'Project').
            entity_id: Target entity identifier.
            user_id: Performing user ID if authenticated.
            changes_payload: Optional before/after change details.
            ip_address: Client IP address.

        Returns:
            Created AuditLog instance.
        """
        entry = AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            changes_payload=changes_payload,
            ip_address=ip_address,
        )
        return await self.create(entry)

    async def list_filtered(
        self,
        user_id: int | None = None,
        action: str | None = None,
        entity_type: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[AuditLog]:
        """Queries audit log records with optional filtering.

        Args:
            user_id: Optional actor user ID filter.
            action: Optional action string filter.
            entity_type: Optional entity type filter.
            offset: Record offset.
            limit: Record limit.

        Returns:
            PageResult of AuditLog instances.
        """
        stmt = (
            select(AuditLog)
            .options(selectinload(AuditLog.user))
            .order_by(AuditLog.id.desc())
        )
        if user_id is not None:
            stmt = stmt.where(AuditLog.user_id == user_id)
        if action is not None:
            stmt = stmt.where(AuditLog.action == action)
        if entity_type is not None:
            stmt = stmt.where(AuditLog.entity_type == entity_type)

        return await self.paginate(stmt, offset=offset, limit=limit)
