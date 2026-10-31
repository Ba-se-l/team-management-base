"""Global pytest test fixtures and configuration.

Sets up transactional in-memory database sessions, ASGI test clients,
and test isolation teardowns.
"""

from collections.abc import AsyncGenerator
from typing import Any
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from src.database.base import Base
from src.database.session import get_session
from src.main import app
from src.modules.audit.service import register_audit_subscribers
from src.security.authorization import configure_casbin_engine, reset_casbin_enforcer
from src.security.casbin_rule import CasbinRule
from src.share.event_bus import event_bus
from src.share.rate_limit import RateLimiter

# In-memory SQLite async engine dedicated for automated test execution
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_async_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(test_async_engine.sync_engine, "connect")
def _set_test_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = async_sessionmaker(
    bind=test_async_engine,
    class_=AsyncSession,
    autoflush=False,
    expire_on_commit=False,
)


@pytest.fixture(autouse=True)
async def setup_test_database() -> AsyncGenerator[None, None]:
    """Creates all database tables before every test and drops them on teardown."""
    # Import registry to guarantee all 12 declarative models are indexed
    import src.database.registry  # noqa: F401

    RateLimiter.reset_all()
    register_audit_subscribers()
    configure_casbin_engine(test_async_engine)
    await reset_casbin_enforcer()

    async with test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(CasbinRule.metadata.create_all)

    yield

    async with test_async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(CasbinRule.metadata.drop_all)

    RateLimiter.reset_all()
    await event_bus.clear()
    configure_casbin_engine(None)
    await reset_casbin_enforcer()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides an isolated database session for direct repository tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture(scope="function")
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Provides an asynchronous HTTP test client wired to the FastAPI application."""

    async def _override_get_session() -> AsyncGenerator[AsyncSession, None]:
        async with TestingSessionLocal() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_session] = _override_get_session

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client_instance:
        yield client_instance

    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def async_client(client: AsyncClient) -> AsyncClient:
    """Backward-compatible alias for canonical client fixture."""
    return client
