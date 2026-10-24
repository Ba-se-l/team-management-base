"""Reusable declarative model mixins for automated timestamp tracking."""

from datetime import datetime
from sqlalchemy import DateTime, func
from sqlalchemy.orm import Mapped, mapped_column


class CreatedAtUpdatedAtMixin:
    """Provides server-default UTC timestamps for creation and updates."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class DateTimeMixin(CreatedAtUpdatedAtMixin):
    """Alias for compatibility with foundation codebase naming."""
