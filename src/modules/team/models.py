from typing import TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base, CreatedAtUpdatedAtMixin

if TYPE_CHECKING:
    from src.modules.project import Project
    from src.modules.team_members import TeamMember
    from src.modules.user import User


class Team(Base, CreatedAtUpdatedAtMixin):
    """Team workspace representing an engineering division or project pod."""

    __tablename__ = "teams"

    # ======================
    # ==== MAIN COLUMNS ====
    # ======================
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(100), nullable=False)

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True, nullable=False)

    description: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # ======================
    # === RELATIONSHIPS ====
    # ======================
    creator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_by: Mapped["User | None"] = relationship(
        "User",
        back_populates="teams_established",
        foreign_keys=[creator_id],
    )

    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="team",
        cascade="all, delete-orphan",
    )

    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan",
    )

    def __init__(self, **kwargs) -> None:
        from src.share.helpers import slugify

        if "name" in kwargs and "slug" not in kwargs:
            kwargs["slug"] = slugify(kwargs["name"])
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"Team(id={self.id}, slug='{self.slug}', name='{self.name}')"