"""User domain repository.

Extends ``BaseRepository`` with user-specific query methods such as
email lookups and active-user filtering.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database import BaseRepository
from .models import User
from .exceptions import UserNotFoundException


class UserRepository(BaseRepository[User]):
    """Repository for ``User`` ORM operations.

    Inherits generic CRUD from ``BaseRepository`` and adds
    domain-specific queries for the ``users`` table.
    """

    def __init__(self, session: AsyncSession):
        """Initializes the user repository.

        Args:
            session: The async database session instance.
        """
        super().__init__(class_=User, session=session)

    async def get_by_id_or_raise(self, id: int) -> User:
        """Fetches a user by primary key or raises if not found.

        Args:
            id: The integer ID of the user to fetch.

        Returns:
            The ``User`` ORM instance.

        Raises:
            UserNotFoundException: If no user with the given ID exists.
        """
        user = await self.get_by_id(id=id)
        if user is not None:
            return user
        raise UserNotFoundException(identifier=str(id))

    async def check_if_exist_by_email(self, email: str) -> bool:
        """Checks whether a user with the given email exists.

        Args:
            email: The email address to check.

        Returns:
            ``True`` if a user with this email exists, ``False`` otherwise.
        """
        return bool(await self.get_one_by_attribute(email=email))

    async def get_by_email(self, email: str) -> User | None:
        """Fetches a user by their email address.

        Args:
            email: The email address to look up.

        Returns:
            The ``User`` instance if found, otherwise ``None``.
        """
        return await self.get_one_by_attribute(email=email)

    async def get_active_users(self, skip: int = 0, limit: int = 20) -> list[User]:
        """Retrieves a paginated list of active users.

        Args:
            skip: Number of records to skip. Defaults to ``0``.
            limit: Maximum number of records to return. Defaults to ``20``.

        Returns:
            A list of active ``User`` ORM instances.
        """
        stmt = (
            select(self.model)
            .where(self.model.is_active.is_(True))
            .offset(skip)
            .limit(limit)
        )

        result = await self.session.execute(stmt)

        return list(result.scalars().all())
