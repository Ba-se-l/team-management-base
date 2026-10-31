"""Audit log router providing access to platform audit logs for super administrators."""

from typing import Annotated
from fastapi import APIRouter, Depends, Query, status

from src.conf import settings
from src.security.guards import require_super_admin
from src.share.dependencies import SessionDep
from src.share.responses import PageResult
from . import service
from .schemas import AuditLogResponse

router = APIRouter(
    prefix=f"{settings.API_PREFIX}/audit",
    tags=["Audit Logs"],
    dependencies=[Depends(require_super_admin)],
)


@router.get(
    "",
    status_code=status.HTTP_200_OK,
    summary="List platform audit logs",
)
async def list_audit_logs(
    session: SessionDep,
    user_id: Annotated[int | None, Query(description="Filter by actor user ID")] = None,
    action: Annotated[str | None, Query(description="Filter by action string")] = None,
    entity_type: Annotated[str | None, Query(description="Filter by entity type")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
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
