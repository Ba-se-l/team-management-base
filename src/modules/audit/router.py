"""Audit log router providing access to platform audit logs for super administrators."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.conf import settings
from src.database.session import get_session
from src.security.guards import require_super_admin
from src.share.responses import PageResult
from . import service
from .schemas import AuditLogResponse

router = APIRouter(prefix=f"{settings.API_PREFIX}/audit", tags=["Audit Logs"])


@router.get(
    "",
    response_model=PageResult[AuditLogResponse],
    status_code=status.HTTP_200_OK,
    summary="List platform audit logs",
    dependencies=[Depends(require_super_admin)],
)
async def list_audit_logs(
    user_id: int | None = Query(default=None, description="Filter by actor user ID"),
    action: str | None = Query(default=None, description="Filter by action string"),
    entity_type: str | None = Query(default=None, description="Filter by entity type"),
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    session: AsyncSession = Depends(get_session),
) -> PageResult[AuditLogResponse]:
    """Retrieves paginated audit log entries. Super administrator privileges required."""
    return await service.list_audit_logs(
        session=session,
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        offset=offset,
        limit=limit,
    )
