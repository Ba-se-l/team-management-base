"""Task domain repository managing Kanban items and discussion comments."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from src.database import BaseRepository
from src.database.enums import TaskStatus
from src.modules.task.models import Task, TaskComment
from src.share.responses import PageResult


class TaskRepository(BaseRepository[Task]):
    """Data repository for Task entities and task discussion threads."""

    def __init__(self, session: AsyncSession) -> None:
        """Initializes with the Task model.

        Args:
            session: Active asynchronous database session.
        """
        super().__init__(model=Task, session=session)

    async def get_task_with_details(self, task_id: int) -> Task | None:
        """Retrieves a single task with author, assignee, and comments with author info.

        Args:
            task_id: Task integer primary key.

        Returns:
            Task instance or None.
        """
        stmt = (
            select(Task)
            .options(
                selectinload(Task.created_by),
                selectinload(Task.assignee_to),
                selectinload(Task.comments).selectinload(TaskComment.author),
            )
            .where(Task.id == task_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def get_project_tasks_ordered(self, project_id: int) -> list[Task]:
        """Retrieves all active tasks for a project ordered by column position for Kanban rendering.

        Args:
            project_id: Owning project integer ID.

        Returns:
            List of Task instances with relationships loaded.
        """
        stmt = (
            select(Task)
            .options(
                selectinload(Task.created_by),
                selectinload(Task.assignee_to),
                selectinload(Task.comments).selectinload(TaskComment.author),
            )
            .where(
                Task.project_id == project_id,
                Task.is_active.is_(True),
            )
            .order_by(Task.position.asc(), Task.id.asc())
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def get_next_position(self, project_id: int, status: TaskStatus) -> float:
        """Calculates the next position value for appending a task to a status column.

        Args:
            project_id: Project integer ID.
            status: Target workflow status column.

        Returns:
            Calculated float position.
        """
        stmt = select(func.max(Task.position)).where(
            Task.project_id == project_id,
            Task.status == status,
            Task.is_active.is_(True),
        )
        max_pos = await self.session.scalar(stmt)
        return float(max_pos + 1000.0) if max_pos is not None else 1000.0

    async def shift_positions_between(
        self,
        project_id: int,
        status: TaskStatus,
        start_pos: float,
        end_pos: float,
        delta: float,
    ) -> None:
        """Shifts positions of tasks in a specific range for atomic Kanban reordering.

        Args:
            project_id: Project integer ID.
            status: Task status column.
            start_pos: Lower/starting bound position.
            end_pos: Upper/ending bound position.
            delta: Shift amount (e.g. +1000.0 or -1000.0).
        """
        from sqlalchemy import update

        low = min(start_pos, end_pos)
        high = max(start_pos, end_pos)
        stmt = (
            update(Task)
            .where(
                Task.project_id == project_id,
                Task.status == status,
                Task.is_active.is_(True),
                Task.position >= low,
                Task.position <= high,
            )
            .values(position=Task.position + delta)
        )
        await self.session.execute(stmt)

    async def shift_positions_after(
        self,
        project_id: int,
        status: TaskStatus,
        from_pos: float,
        delta: float,
    ) -> None:
        """Shifts positions of all tasks appearing at or after from_pos.

        Args:
            project_id: Project integer ID.
            status: Task status column.
            from_pos: Starting position threshold.
            delta: Shift amount.
        """
        from sqlalchemy import update

        stmt = (
            update(Task)
            .where(
                Task.project_id == project_id,
                Task.status == status,
                Task.is_active.is_(True),
                Task.position >= from_pos,
            )
            .values(position=Task.position + delta)
        )
        await self.session.execute(stmt)

    async def get_user_assigned_tasks(
        self,
        user_id: int,
        offset: int = 0,
        limit: int = 50,
    ) -> PageResult[Task]:
        """Retrieves active tasks assigned to the user within their active team memberships.

        Args:
            user_id: Assignee user integer ID.
            offset: Record offset.
            limit: Limit per page.

        Returns:
            PageResult of Task instances.
        """
        from src.modules.project.models import Project
        from src.modules.team_members.models import TeamMember

        stmt = (
            select(Task)
            .options(
                selectinload(Task.created_by),
                selectinload(Task.assignee_to),
                selectinload(Task.comments).selectinload(TaskComment.author),
            )
            .join(Project, Project.id == Task.project_id)
            .join(
                TeamMember,
                (TeamMember.team_id == Project.team_id)
                & (TeamMember.member_id == user_id)
                & (TeamMember.is_active.is_(True)),
            )
            .where(
                Task.assignee_to_id == user_id,
                Task.is_active.is_(True),
                Project.is_active.is_(True),
            )
            .order_by(Task.deadline.asc().nulls_last(), Task.priority.desc(), Task.id.desc())
        )
        return await self.paginate(stmt, offset=offset, limit=limit)

    async def paginate_project_tasks(
        self,
        project_id: int,
        status: TaskStatus | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> PageResult[Task]:
        """Retrieves paginated tasks for a project with optional status filtering.

        Args:
            project_id: Project integer ID.
            status: Optional TaskStatus filter.
            offset: Record offset.
            limit: Limit per page.

        Returns:
            PageResult of Task instances.
        """
        stmt = (
            select(Task)
            .options(
                selectinload(Task.created_by),
                selectinload(Task.assignee_to),
                selectinload(Task.comments).selectinload(TaskComment.author),
            )
            .where(
                Task.project_id == project_id,
                Task.is_active.is_(True),
            )
            .order_by(Task.position.asc(), Task.id.desc())
        )

        if status is not None:
            stmt = stmt.where(Task.status == status)

        return await self.paginate(stmt, offset=offset, limit=limit)

    async def add_comment(self, task_id: int, author_id: int, content: str) -> TaskComment:
        """Creates and flushes a new comment attached to a task.

        Args:
            task_id: Target task integer ID.
            author_id: Author user integer ID.
            content: Textual comment content.

        Returns:
            Created TaskComment.
        """
        comment = TaskComment(
            task_id=task_id,
            author_id=author_id,
            content=content,
        )
        self.session.add(comment)
        await self.session.flush()
        await self.session.refresh(comment, attribute_names=["author"])
        return comment

    async def get_comment(self, comment_id: int) -> TaskComment | None:
        """Retrieves a single task comment by primary key.

        Args:
            comment_id: Comment integer ID.

        Returns:
            TaskComment or None.
        """
        stmt = (
            select(TaskComment)
            .options(selectinload(TaskComment.author))
            .where(TaskComment.id == comment_id)
        )
        result = await self.session.execute(stmt)
        return result.scalars().first()

    async def delete_comment(self, comment: TaskComment) -> None:
        """Deletes a task comment record.

        Args:
            comment: TaskComment instance to delete.
        """
        await self.session.delete(comment)
        await self.session.flush()