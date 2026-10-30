"""Project domain repository providing query operations and relationship loading."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import BaseRepository
from src.database.enums import ProjectStatus, ProjectVisibility, TaskStatus
from src.modules.project.models import Project
from src.share.responses import PageResult


class ProjectRepository(BaseRepository[Project]):
    """Data repository for Project entities."""

    def __init__(self, session: AsyncSession) -> None:
        """Initializes with the Project model.

        Args:
            session: Active asynchronous database session.
        """
        super().__init__(class_=Project, session=session)

    async def get_by_slug(self, slug: str) -> Project | None:
        """Retrieves a project by its URL-friendly slug with technologies eager loaded.

        Args:
            slug: Project slug string.

        Returns:
            Project instance or None.
        """
        stmt = (
            select(Project)
            .options(selectinload(Project.technologies))
            .where(Project.slug == slug)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_by_id_with_techs(self, project_id: int) -> Project | None:
        """Retrieves a project by integer ID with technologies eager loaded.

        Args:
            project_id: Project integer primary key.

        Returns:
            Project instance or None.
        """
        stmt = (
            select(Project)
            .options(selectinload(Project.technologies))
            .where(Project.id == project_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_team_projects(
        self,
        team_id: int,
        status: ProjectStatus | None = None,
        visibility: ProjectVisibility | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[Project]:
        """Retrieves paginated projects belonging to a team workspace with optional filters.

        Args:
            team_id: Owning team integer ID.
            status: Optional ProjectStatus filter.
            visibility: Optional ProjectVisibility filter.
            offset: Record offset.
            limit: Page size limit.

        Returns:
            PageResult of Project instances with technologies loaded.
        """
        stmt = (
            select(Project)
            .options(selectinload(Project.technologies))
            .where(
                Project.team_id == team_id,
                Project.is_active.is_(True),
            )
            .order_by(Project.id.desc())
        )

        if status is not None:
            stmt = stmt.where(Project.status == status)

        if visibility is not None:
            stmt = stmt.where(Project.visibility == visibility)

        return await self.paginate(stmt, offset=offset, limit=limit)

    async def get_accessible_projects(
        self,
        user_id: int,
        is_super_admin: bool = False,
        offset: int = 0,
        limit: int = 50,
    ) -> PageResult[Project]:
        """Retrieves paginated active projects accessible to a user.

        Super admins can access all active projects across all teams.
        Standard users can only access active projects belonging to teams
        where they are an active member.

        Args:
            user_id: User integer primary key.
            is_super_admin: Whether the user is a super admin.
            offset: Record offset.
            limit: Page size limit.

        Returns:
            PageResult of Project instances with technologies loaded.
        """
        from src.modules.team.models import Team
        from src.modules.team_members.models import TeamMember

        stmt = (
            select(Project)
            .options(selectinload(Project.technologies))
            .join(Team, Team.id == Project.team_id)
            .where(
                Project.is_active.is_(True),
                Team.is_active.is_(True),
            )
        )

        if not is_super_admin:
            stmt = stmt.join(
                TeamMember,
                (TeamMember.team_id == Project.team_id)
                & (TeamMember.member_id == user_id)
                & (TeamMember.is_active.is_(True)),
            )

        stmt = stmt.order_by(Project.id.desc())
        return await self.paginate(stmt, offset=offset, limit=limit)

    async def list_all_projects(
        self,
        offset: int = 0,
        limit: int = 50,
    ) -> PageResult[Project]:
        """Retrieves paginated active projects with technologies eager loaded.

        Args:
            offset: Record offset.
            limit: Page size limit.

        Returns:
            PageResult of Project instances.
        """
        stmt = (
            select(Project)
            .options(selectinload(Project.technologies))
            .where(Project.is_active.is_(True))
            .order_by(Project.id.desc())
        )
        return await self.paginate(stmt, offset=offset, limit=limit)

    async def get_task_counts(self, project_id: int) -> tuple[int, int]:
        """Calculates total and completed task counts for a project.

        Args:
            project_id: Project integer primary key.

        Returns:
            Tuple of (total_tasks, completed_tasks).
        """
        from src.modules.task.models import Task

        total_stmt = select(func.count(Task.id)).where(
            Task.project_id == project_id,
            Task.is_active.is_(True),
        )
        completed_stmt = select(func.count(Task.id)).where(
            Task.project_id == project_id,
            Task.is_active.is_(True),
            Task.status == TaskStatus.DONE,
        )

        total_tasks = await self.session.scalar(total_stmt) or 0
        completed_tasks = await self.session.scalar(completed_stmt) or 0
        return total_tasks, completed_tasks

    async def get_batch_task_counts(self, project_ids: list[int]) -> dict[int, tuple[int, int]]:
        """Calculates (total_tasks, completed_tasks) for a batch of projects in a single GROUP BY query.

        Args:
            project_ids: List of project integer primary keys.

        Returns:
            Mapping of project_id -> (total_tasks, completed_tasks).
        """
        if not project_ids:
            return {}

        from sqlalchemy import case
        from src.modules.task.models import Task

        stmt = (
            select(
                Task.project_id,
                func.count(Task.id),
                func.coalesce(
                    func.sum(case((Task.status == TaskStatus.DONE, 1), else_=0)),
                    0,
                ),
            )
            .where(
                Task.project_id.in_(project_ids),
                Task.is_active.is_(True),
            )
            .group_by(Task.project_id)
        )
        rows = (await self.session.execute(stmt)).all()
        counts_map = {
            int(pid): (int(total or 0), int(done or 0))
            for pid, total, done in rows
        }
        return {pid: counts_map.get(pid, (0, 0)) for pid in project_ids}
