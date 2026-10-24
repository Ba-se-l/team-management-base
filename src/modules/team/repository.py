"""Team domain repository for database interactions."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import BaseRepository
from src.modules.project.models import Project
from src.modules.team.models import Team
from src.modules.team_members.models import TeamMember
from src.share.responses import PageResult


class TeamRepository(BaseRepository[Team]):
    """Data repository for Team workspace persistence operations."""

    def __init__(self, session: AsyncSession) -> None:
        """Initializes with the Team model.

        Args:
            session: Active asynchronous database session.
        """
        super().__init__(model=Team, session=session)

    async def get_by_slug(self, slug: str) -> Team | None:
        """Retrieves a team workspace by its unique URL slug.

        Args:
            slug: URL slug string.

        Returns:
            Team instance or None.
        """
        return await self.get_by_attr(slug=slug)

    async def get_active_teams(self, offset: int = 0, limit: int = 20) -> PageResult[Team]:
        """Retrieves paginated active teams.

        Args:
            offset: Record offset.
            limit: Page size limit.

        Returns:
            PageResult of teams.
        """
        stmt = (
            select(Team)
            .where(Team.is_active.is_(True))
            .order_by(Team.id.desc())
        )
        return await self.paginate(stmt, offset=offset, limit=limit)

    async def get_user_teams(
        self,
        user_id: int,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[Team]:
        """Retrieves paginated teams that the user is an active member of.

        Args:
            user_id: The member's user integer primary key.
            offset: Record offset.
            limit: Page size limit.

        Returns:
            PageResult of Team instances.
        """
        stmt = (
            select(Team)
            .join(TeamMember, TeamMember.team_id == Team.id)
            .where(
                TeamMember.member_id == user_id,
                TeamMember.is_active.is_(True),
                Team.is_active.is_(True),
            )
            .order_by(Team.id.desc())
        )
        return await self.paginate(stmt, offset=offset, limit=limit)

    async def get_team_metrics(self, team_id: int) -> tuple[int, int]:
        """Returns the member count and project count for a given team.

        Args:
            team_id: Team integer ID.

        Returns:
            Tuple of (members_count, projects_count).
        """
        members_stmt = select(func.count(TeamMember.member_id)).where(
            TeamMember.team_id == team_id,
            TeamMember.is_active.is_(True),
        )
        projects_stmt = select(func.count(Project.id)).where(
            Project.team_id == team_id,
            Project.is_active.is_(True),
        )

        members_count = await self.session.scalar(members_stmt) or 0
        projects_count = await self.session.scalar(projects_stmt) or 0
        return members_count, projects_count