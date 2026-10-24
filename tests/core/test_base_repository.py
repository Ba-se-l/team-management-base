"""Unit and integration tests for BaseRepository operations."""

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.base_repo import BaseRepository
from src.modules.technology.models import Technology


@pytest.mark.asyncio
async def test_repository_create_flushes_and_refreshes_generated_fields(
    db_session: AsyncSession,
) -> None:
    """Verifies that create stages the record and refreshes server-generated fields immediately."""
    repo = BaseRepository(Technology, db_session)

    tech = Technology(
        name="Python",
        description="Programming language",
        documentation_url="https://python.org",
    )
    created = await repo.create(tech)

    # Verify ID and created_at are generated and accessible without MissingGreenlet error
    assert created.id is not None
    assert created.id > 0
    assert created.created_at is not None
    assert created.updated_at is not None


@pytest.mark.asyncio
async def test_repository_get_by_id_and_by_attr(db_session: AsyncSession) -> None:
    """Verifies retrieval by primary key and keyword attributes."""
    repo = BaseRepository(Technology, db_session)

    tech = await repo.create(Technology(name="FastAPI", description="Web framework"))

    fetched_by_id = await repo.get_by_id(tech.id)
    assert fetched_by_id is not None
    assert fetched_by_id.name == "FastAPI"

    fetched_by_attr = await repo.get_by_attr(name="FastAPI")
    assert fetched_by_attr is not None
    assert fetched_by_attr.id == tech.id

    not_found = await repo.get_by_attr(name="NonExistentTech")
    assert not_found is None


@pytest.mark.asyncio
async def test_repository_exists_check(db_session: AsyncSession) -> None:
    """Verifies exists query returns True for present records and False otherwise."""
    repo = BaseRepository(Technology, db_session)

    await repo.create(Technology(name="PostgreSQL", description="Relational database"))

    assert await repo.exists(name="PostgreSQL") is True
    assert await repo.exists(name="MySQL") is False


@pytest.mark.asyncio
async def test_repository_paginate_calculates_filtered_total_correctly(
    db_session: AsyncSession,
) -> None:
    """Verifies that paginate counts matching records of the filtered query rather than the whole table."""
    repo = BaseRepository(Technology, db_session)

    # Insert 5 backend technologies and 3 frontend technologies
    for i in range(5):
        await repo.create(Technology(name=f"BackendTool_{i}", description="backend service"))
    for i in range(3):
        await repo.create(Technology(name=f"FrontendTool_{i}", description="frontend UI"))

    # Query filtered specifically for "backend service"
    filter_stmt = select(Technology).where(Technology.description == "backend service").order_by(Technology.id)

    # Paginate: page size 2, offset 0 -> should return 2 items, total matching must be 5 (not 8!)
    page_1 = await repo.paginate(filter_stmt, offset=0, limit=2)
    assert len(page_1.items) == 2
    assert page_1.total == 5
    assert page_1.items[0].name == "BackendTool_0"
    assert page_1.items[1].name == "BackendTool_1"

    # Next page: offset 2, limit 2
    page_2 = await repo.paginate(filter_stmt, offset=2, limit=2)
    assert len(page_2.items) == 2
    assert page_2.total == 5
    assert page_2.items[0].name == "BackendTool_2"

    # Last page: offset 4, limit 2 -> 1 item remaining
    page_3 = await repo.paginate(filter_stmt, offset=4, limit=2)
    assert len(page_3.items) == 1
    assert page_3.total == 5
    assert page_3.items[0].name == "BackendTool_4"


@pytest.mark.asyncio
async def test_repository_update_modifies_attributes_and_refreshes(
    db_session: AsyncSession,
) -> None:
    """Verifies that update modifies attributes and auto-refreshes."""
    repo = BaseRepository(Technology, db_session)

    tech = await repo.create(Technology(name="Vue", description="Old description"))
    first_updated_at = tech.updated_at

    updated = await repo.update(tech, {"description": "Progressive framework"})
    assert updated.description == "Progressive framework"
    assert updated.updated_at >= first_updated_at


@pytest.mark.asyncio
async def test_repository_delete(db_session: AsyncSession) -> None:
    """Verifies that delete stages deletion and removes the record."""
    repo = BaseRepository(Technology, db_session)

    tech = await repo.create(Technology(name="TemporaryTool"))
    tech_id = tech.id

    deleted = await repo.delete(tech)
    assert deleted is True

    record = await repo.get_by_id(tech_id)
    assert record is None
