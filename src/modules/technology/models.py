from typing import TYPE_CHECKING
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from src.database import Base, CreatedAtUpdatedAtMixin
from src.database.enums import TechnologyCategory, str_enum_column
from src.modules.m2m import ProjectsTechnologies

if TYPE_CHECKING:
    from src.modules.project import Project


class Technology(Base, CreatedAtUpdatedAtMixin):
    """Technical tool, framework, or language leveraged in projects."""

    __tablename__ = "technologies"

    # ======================
    # ==== MAIN COLUMNS ====
    # ======================
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    name: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)

    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)

    category: Mapped[TechnologyCategory] = mapped_column(
        str_enum_column(TechnologyCategory, length=32),
        default=TechnologyCategory.TOOL,
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(String(255), nullable=True, default=None)

    documentation_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    icon_url: Mapped[str | None] = mapped_column(String(500), nullable=True, default=None)

    # ======================
    # === RELATIONSHIPS ====
    # ======================
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="technologies",
        secondary=ProjectsTechnologies,
    )

    def __init__(self, **kwargs) -> None:
        from src.share.helpers import slugify

        if "name" in kwargs and "slug" not in kwargs:
            kwargs["slug"] = slugify(kwargs["name"])
        super().__init__(**kwargs)

    def __repr__(self) -> str:
        return f"Technology(id={self.id}, slug='{self.slug}', name='{self.name}')"