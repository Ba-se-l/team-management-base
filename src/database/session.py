"""Database session management and FastAPI transactional dependency provider."""

from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from src.conf import settings
from .engine import async_engine

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    autoflush=settings.AUTO_FLUSH,
    expire_on_commit=settings.EXPIRE_ON_COMMIT,
)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency providing a transactional AsyncSession.

    Transaction boundary contract:
        - Commits automatically upon successful endpoint execution.
        - Rolls back on any raised exception and propagates to error handlers.

    Yields:
        Active asynchronous database session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise