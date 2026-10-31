"""User domain repository.

Extends ``BaseRepository`` with user-specific query methods such as
email lookups and active-user filtering.
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select

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
        """Checks whether a user with the given email exists (case-insensitive).

        Args:
            email: The email address to check.

        Returns:
            ``True`` if a user with this email exists, ``False`` otherwise.
        """
        return (await self.get_by_email(email=email)) is not None

    async def get_by_email(self, email: str) -> User | None:
        """Fetches a user by their normalized email address (case-insensitive).

        Args:
            email: The email address to look up.

        Returns:
            The ``User`` instance if found, otherwise ``None``.
        """
        normalized = email.strip().lower()
        stmt = select(User).where(func.lower(User.email) == normalized)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def count_active_super_admins(self) -> int:
        """Counts the number of currently active super administrators."""
        stmt = select(func.count(User.id)).where(
            User.is_super_admin.is_(True),
            User.is_active.is_(True),
        )
        return await self.session.scalar(stmt) or 0

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
