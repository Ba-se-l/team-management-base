from datetime import datetime, timezone
from sqlalchemy import delete, or_, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import BaseRepository
from .model import RefreshSession



class RefreshSessionRepository(BaseRepository[RefreshSession]):
    """Repository for RefreshSession CRUD and revocation operations.

    Attributes:
        model: The RefreshSession ORM class.
        session: The active async database session.
    """

    def __init__(self, session: AsyncSession):
        """Initializes with the RefreshSession model.

        Args:
            session: The active async database session.
        """
        super().__init__(class_=RefreshSession, session=session)

    async def get_by_jti(self, jti: str) -> RefreshSession | None:
        """Fetches a refresh session by its unique JTI claim.

        Args:
            jti: The JWT ID string.

        Returns:
            The RefreshSession instance or None if not found.
        """
        return await self.get_one_by_attribute(refresh_token_jti=jti)

    async def revoke_by_jti(self, jti: str) -> None:
        """Revokes a single refresh session by JTI.

        Args:
            jti: The JWT ID string to revoke.
        """
        stmt = (
            update(RefreshSession)
            .where(RefreshSession.refresh_token_jti == jti)
            .values(is_revoked=True)
        )
        await self.session.execute(stmt)

    async def consume_session_atomically(self, jti: str) -> bool:
        """Atomically transitions an unrevoked refresh session to revoked.

        Prevents TOCTOU race conditions during concurrent refresh token rotation.

        Args:
            jti: The JWT ID string to consume.

        Returns:
            True if the session was active and is now revoked; False if already revoked or absent.
        """
        stmt = (
            update(RefreshSession)
            .where(
                RefreshSession.refresh_token_jti == jti,
                RefreshSession.is_revoked.is_(False),
            )
            .values(is_revoked=True)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return (result.rowcount or 0) == 1

    async def purge_expired_or_revoked(self) -> int:
        """Deletes all expired or revoked refresh sessions from storage.

        Returns:
            Number of rows deleted.
        """
        now = datetime.now(timezone.utc)
        stmt = delete(RefreshSession).where(
            or_(
                RefreshSession.is_revoked.is_(True),
                RefreshSession.expires_at < now,
            )
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount or 0

    async def revoke_all_for_user(self, user_id: int) -> None:
        """Revokes all active refresh sessions for a user.

        Used for logout-all-devices and post-password-change invalidation.

        Args:
            user_id: The user's primary key.
        """
        stmt = (
            update(RefreshSession)
            .where(
                RefreshSession.user_id == user_id,
                RefreshSession.is_revoked == False,
            )
            .values(is_revoked=True)
        )
        await self.session.execute(stmt)

    async def revoke_family(self, family_id: str) -> None:
        """Revokes all sessions belonging to a specific session family.

        Used when token replay attacks are detected.

        Args:
            family_id: The session family identifier.
        """
        stmt = (
            update(RefreshSession)
            .where(RefreshSession.family_id == family_id)
            .values(is_revoked=True)
        )
        await self.session.execute(stmt)



