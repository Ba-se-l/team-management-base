"""Audit log domain response schemas."""

from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class AuditLogResponse(BaseModel):
    """Structured audit trail record response."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None = None
    user_username: str | None = None
    action: str
    entity_type: str
    entity_id: str | None = None
    changes_payload: dict[str, Any] | None = None
    ip_address: str | None = None
    created_at: datetime
