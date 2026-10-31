"""Concrete generic repository providing robust asynchronous CRUD operations.

Follows the Orchestrator-Specialist pattern. Repositories handle SQLAlchemy
queries and session flushing without owning the transaction boundaries (which
remain with the session dependency).
"""

from datetime import datetime, timezone
import logging
from typing import Any, Generic, TypeVar
from sqlalchemy import Select, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.base import Base
from src.share.responses import PageResult

_O = TypeVar("_O", bound=Base)
logger = logging.getLogger(__name__)


class BaseRepository(Generic[_O]):
    """Generic repository providing hardened CRUD operations for SQLAlchemy models."""

    def __init__(self, class_: type[_O], session: AsyncSession) -> None:
        """Initializes the repository.

        Args:
            class_: Declarative model class managed by this repository.
            session: Active asynchronous database session.
        """
        self.model = class_
        self.session = session

    async def get_by_id(self, id: Any) -> _O | None:
        """Retrieves a single record by its primary key.

        Args:
            id: Primary key (integer, UUID, or composite).

        Returns:
            Model instance if found, otherwise None.
        """
        return await self.session.get(self.model, id)

    async def get_by_attr(self, **kw: Any) -> _O | None:
        """Retrieves a single record matching dynamic keyword attribute filters.

        Args:
            **kw: Model column attributes and their target values.

        Returns:
            The first matching model instance or None.
        """
        stmt = select(self.model).filter_by(**kw)
        result = await self.session.execute(stmt)
        return result.scalars().first()

    get_one_by_attribute = get_by_attr

    async def exists(self, **kw: Any) -> bool:
        """Checks if any record matches given criteria without loading entire entity.

        Args:
            **kw: Column name-value pairs to match.

        Returns:
            True if at least one matching row exists, False otherwise.
        """
        stmt = select(literal(1)).select_from(self.model).filter_by(**kw).limit(1)
        result = await self.session.execute(stmt)
        return result.scalar() is not None

    async def paginate(
        self,
        stmt: Select[tuple[_O]] | Select[_O],
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[_O]:
        """Paginates an arbitrary SQLAlchemy query, computing total matching rows via subquery.

        Args:
            stmt: SQLAlchemy Select statement to paginate.
            offset: Number of records to skip.
            limit: Maximum records to return.

        Returns:
            PageResult containing the slice of items and total matching count.
        """
        # Execute count on the filtered query as an aliased subquery
        count_subquery = stmt.order_by(None).subquery()
        count_stmt = select(func.count()).select_from(count_subquery)
        total = (await self.session.execute(count_stmt)).scalar_one()

        # Execute data fetch
        data_stmt = stmt.offset(offset).limit(limit)
        result = await self.session.execute(data_stmt)
        items = list(result.scalars().all())

        return PageResult(items=items, total=total, offset=offset, limit=limit)

    async def get_multi(
        self,
        *,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[_O]:
        """Retrieves a paginated list of all records for this model.

        Args:
            offset: Number of records to skip.
            limit: Maximum records to return.

        Returns:
            PageResult containing items and total count.
        """
        stmt = select(self.model)
        if hasattr(self.model, "id"):
            stmt = stmt.order_by(getattr(self.model, "id"))
        return await self.paginate(stmt, offset=offset, limit=limit)

    async def create(self, instance: _O) -> _O:
        """Persists a new entity instance, flushing and refreshing generated fields.

        Args:
            instance: Transient model instance to persist.

        Returns:
            The persisted and refreshed model instance.
        """
        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def update(self, instance: _O, update_data: dict[str, Any]) -> _O:
        """Applies an update dictionary to a tracked entity, updating timestamps.

        Args:
            instance: Tracked model instance to update.
            update_data: Dictionary of attribute names and new values.

        Returns:
            The updated and refreshed model instance.
        """
        if hasattr(instance, "updated_at") and "updated_at" not in update_data:
            update_data["updated_at"] = datetime.now(timezone.utc)

        for key, value in update_data.items():
            setattr(instance, key, value)

        self.session.add(instance)
        await self.session.flush()
        await self.session.refresh(instance)
        return instance

    async def delete(self, instance: _O) -> bool:
        """Deletes an entity instance within the current transaction.

        Args:
            instance: Tracked model instance to remove.

        Returns:
            True upon successful deletion stage.
        """
        await self.session.delete(instance)
        await self.session.flush()
        return True
