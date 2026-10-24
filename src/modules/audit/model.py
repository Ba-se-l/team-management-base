"""Audit logging ORM model capturing critical platform state changes."""

from datetime import datetime
from typing import TYPE_CHECKING, Any
from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base

if TYPE_CHECKING:
    from src.modules.user.models import User


class AuditLog(Base):
    """Immutable audit trail entry recording administrative and operational events."""

    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    entity_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)

    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    changes_payload: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True, default=None)

    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True, default=None)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    user: Mapped["User | None"] = relationship(
        "User",
        back_populates="audit_logs",
        foreign_keys=[user_id],
    )

    def __repr__(self) -> str:
        return f"AuditLog(id={self.id}, action='{self.action}', entity='{self.entity_type}:{self.entity_id}')"
