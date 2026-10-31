"""Public showcase request and response schemas strictly isolating public presentation data."""

from datetime import datetime
from pydantic import AliasChoices, BaseModel, ConfigDict, Field

from src.database.enums import ProjectStatus, TechnologyCategory


class PublicTechnologySummary(BaseModel):
    """Publicly visible technology data."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    category: TechnologyCategory
    icon_url: str | None = None


class PublicMember(BaseModel):
    """Public profile representation for opt-in agency developers."""

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: int
    name: str
    username: str
    avatar_url: str | None = None
    job_title: str | None = None
    bio: str | None = None
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("portfolio_url", "website_url"),
    )


class PublicProjectCard(BaseModel):
    """Compact public project showcase card."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    slug: str
    short_description: str
    featured: bool
    status: ProjectStatus
    demo_url: str | None = None
    repo_url: str | None = None
    team_name: str | None = None
    team_slug: str | None = None
    technologies: list[PublicTechnologySummary] = Field(default_factory=list)


class PublicProjectDetail(PublicProjectCard):
    """Comprehensive public portfolio view for an individual project."""

    description: str | None = None
    released_at: datetime | None = None
    created_at: datetime


class PublicOverview(BaseModel):
    """Landing page platform statistics, featured portfolio items, and top tech stack."""

    total_teams: int
    total_projects: int
    total_public_members: int
    featured_projects: list[PublicProjectCard] = Field(default_factory=list)
    technologies: list[PublicTechnologySummary] = Field(default_factory=list)
