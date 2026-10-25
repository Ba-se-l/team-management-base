"""Asynchronous SQLAlchemy engine configuration supporting SQLite and PostgreSQL."""

from typing import Any
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool

from src.conf import settings


def create_engine_instance(database_url: str | None = None, **kwargs: Any) -> AsyncEngine:
    """Builds an AsyncEngine configured with dialect-specific connection parameters.

    Args:
        database_url: Optional database connection URL. Defaults to settings.DATABASE_URL.
        **kwargs: Additional parameters passed to create_async_engine.

    Returns:
        Configured AsyncEngine instance.
    """
    url = database_url or settings.DATABASE_URL
    is_sqlite = url.startswith("sqlite")

    engine_kwargs: dict[str, Any] = {
        "echo": settings.ECHO,
        **kwargs,
    }

    if not is_sqlite:
        engine_kwargs.setdefault("pool_size", settings.POOL_SIZE)
        engine_kwargs.setdefault("max_overflow", settings.MAX_OVERFLOW)
        engine_kwargs.setdefault("pool_timeout", settings.POOL_TIMEOUT)
        engine_kwargs.setdefault("pool_pre_ping", settings.POOL_PRE_PING)

    engine = create_async_engine(url, **engine_kwargs)

    if is_sqlite:
        # Enforce foreign key constraints and WAL concurrency on SQLite connections
        @event.listens_for(engine.sync_engine, "connect")
        def _set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA synchronous=NORMAL")
            cursor.close()

    return engine


async_engine = create_engine_instance()