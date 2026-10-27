"""Technology domain service layer.

Contains business logic for managing the technology stack catalog.
Technologies are global entities (lookup table) referenced by projects
via a many-to-many relationship.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from typing import Sequence

from src.exc import AlreadyExistsException
from .models import Technology
from .schemas import CreateTechnologyRequest, UpdateTechnologyRequest
from .repository import TechnologyRepository
from .exceptions import TechonolgyNotFoundException


async def get_technology(tech_id: int, session: AsyncSession) -> Technology:
    """Internal helper: fetches a technology by ID or raises.

    Args:
        tech_id: The integer ID of the technology to fetch.
        session: The active database session.

    Returns:
        The ``Technology`` ORM instance.

    Raises:
        TechonolgyNotFoundException: If no technology with the given ID exists.
    """
    repo = TechnologyRepository(session=session)
    tech = await repo.get_by_id(id=tech_id)

    if tech is None:
        raise TechonolgyNotFoundException(identifier=str(tech_id))

    return tech


_get_technology = get_technology


async def create_technology(
    schema: CreateTechnologyRequest,
    session: AsyncSession
) -> Technology:
    """Creates a new technology entry in the global catalog.

    Checks that the technology name is unique before insertion.

    Args:
        schema: The validated technology creation request.
        session: The active database session.

    Returns:
        The newly created ``Technology`` ORM instance.

    Raises:
        AlreadyExistsException: If a technology with the same name exists.
    """
    repo = TechnologyRepository(session=session)

    # Step 1: Check uniqueness
    is_exist = await repo.check_if_exist(name=schema.name)
    if is_exist:
        raise AlreadyExistsException(entity="Technology", field="name", value=schema.name)

    # Step 2: Build ORM model
    tech = Technology(
        name=schema.name,
        description=schema.description,
        documentation_url=schema.documentation_url,
    )

    # Step 3: Persist
    tech = await repo.create(instance=tech)

    await session.flush()
    
    return tech


async def update_technology(
    tech_id: int,
    schema: UpdateTechnologyRequest,
    session: AsyncSession
) -> Technology:
    """Updates an existing technology entry.

    If the name is being updated, verifies the new name is unique.

    Args:
        tech_id: The integer ID of the technology to update.
        schema: The validated update request with optional fields.
        session: The active database session.

    Returns:
        The updated ``Technology`` ORM instance.

    Raises:
        TechonolgyNotFoundException: If the technology does not exist.
        AlreadyExistsException: If the new name is already taken.
    """
    repo = TechnologyRepository(session=session)

    # Step 1: Fetch
    tech = await get_technology(tech_id=tech_id, session=session)

    # Step 2: If name is changing, check uniqueness
    if schema.name is not None and schema.name != tech.name:
        is_exist = await repo.check_if_exist(name=schema.name)
        if is_exist:
            raise AlreadyExistsException(entity="Technology", field="name", value=schema.name)


    # Step 3: Apply update
    updated_tech = await repo.update(
        instance=tech,
        update_data=schema.model_dump(exclude_unset=True),
    )

    return updated_tech


async def delete_technology(tech_id: int, session: AsyncSession) -> Technology:
    """Hard-deletes a technology from the catalog.

    Note: Technologies are lookup entities. Deleting one will cascade or
    set-null on the `projects_technologies` join table depending on the
    foreign key constraint configuration.

    Args:
        tech_id: The integer ID of the technology to delete.
        session: The active database session.

    Returns:
        The deleted ``Technology`` ORM instance.

    Raises:
        TechonolgyNotFoundException: If the technology does not exist.
    """
    repo = TechnologyRepository(session=session)

    # Step 1: Fetch
    tech = await get_technology(tech_id=tech_id, session=session)

    # Step 2: Delete
    await repo.delete(instance=tech)

    return tech


async def list_technologies(
    session: AsyncSession,
    skip: int = 0,
    limit: int = 20,
) -> Sequence[Technology]:
    """Lists all technologies in the catalog with pagination.

    Args:
        session: The active database session.
        skip: Number of records to skip. Defaults to ``0``.
        limit: Maximum number of records to return. Defaults to ``20``.

    Returns:
        A list of ``Technology`` ORM instances.
    """
    repo = TechnologyRepository(session=session)

    page = await repo.get_multi(offset=skip, limit=limit)
    return page.items


async def search_technologies(
    query: str,
    session: AsyncSession,
    skip: int = 0,
    limit: int = 20,
) -> list[Technology]:
    """Searches the technology catalog by partial name match.

    Performs a case-insensitive `ILIKE` search.

    Args:
        query: The partial name string to search for.
        session: The active database session.
        skip: Number of records to skip. Defaults to ``0``.
        limit: Maximum number of records to return. Defaults to ``20``.

    Returns:
        A list of matching ``Technology`` ORM instances.
    """
    repo = TechnologyRepository(session=session)

    return await repo.search_by_name(query=query, skip=skip, limit=limit)
