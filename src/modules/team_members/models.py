from datetime import datetime
from typing import TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base
from src.database.enums import TeamRole, str_enum_column

if TYPE_CHECKING:
    from src.modules.team import Team
    from src.modules.user import User


class TeamMember(Base):
    """Membership mapping linking developers to teams with scoped roles."""

    __tablename__ = "team_members"

    member_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    team_id: Mapped[int] = mapped_column(
        ForeignKey("teams.id", ondelete="CASCADE"),
        primary_key=True,
    )

    role: Mapped[TeamRole] = mapped_column(
        str_enum_column(TeamRole, length=32),
        nullable=False,
        default=TeamRole.DEVELOPER,
    )

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    member: Mapped["User"] = relationship(
        "User",
        back_populates="teams_memberships",
        foreign_keys=[member_id],
    )

    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="members",
        foreign_keys=[team_id],
    )

    def __repr__(self) -> str:
        return f"TeamMember(member_id={self.member_id}, team_id={self.team_id}, role={self.role})"

    

