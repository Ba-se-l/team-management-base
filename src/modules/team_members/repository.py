"""Team member domain repository for membership persistence."""

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import BaseRepository
from src.database.enums import TeamRole
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.share.responses import PageResult


class TeamMemberRepository(BaseRepository[TeamMember]):
    """Data repository for TeamMember operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initializes with the TeamMember model.

        Args:
            session: Active asynchronous database session.
        """
        super().__init__(class_=TeamMember, session=session)

    async def get_membership(self, member_id: int, team_id: int) -> TeamMember | None:
        """Retrieves a specific membership record by composite primary key.

        Args:
            member_id: User integer primary key.
            team_id: Team integer primary key.

        Returns:
            TeamMember instance or None.
        """
        return await self.get_by_attr(member_id=member_id, team_id=team_id)

    async def count_active_admins(self, team_id: int) -> int:
        """Counts how many active users hold ADMIN role within a team with write lock.

        Args:
            team_id: Target team integer ID.

        Returns:
            Total count of active team administrators.
        """
        # Touch team record to convert transaction to exclusive lock, preventing race conditions
        await self.session.execute(
            update(Team).where(Team.id == team_id).values(updated_at=func.now())
        )
        stmt = (
            select(TeamMember)
            .where(
                TeamMember.team_id == team_id,
                TeamMember.role == TeamRole.ADMIN,
                TeamMember.is_active.is_(True),
            )
            .with_for_update()
        )
        result = await self.session.execute(stmt)
        return len(result.scalars().all())

    async def get_team_members(
        self,
        team_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[TeamMember]:
        """Retrieves paginated members of a team workspace with eager-loaded user records.

        Args:
            team_id: Target team integer ID.
            offset: Record offset.
            limit: Limit per page.

        Returns:
            PageResult of TeamMember instances with User populated.
        """
        stmt = (
            select(TeamMember)
            .options(selectinload(TeamMember.member))
            .where(
                TeamMember.team_id == team_id,
                TeamMember.is_active.is_(True),
            )
            .order_by(TeamMember.joined_at.asc())
        )
        return await self.paginate(stmt, offset=offset, limit=limit)