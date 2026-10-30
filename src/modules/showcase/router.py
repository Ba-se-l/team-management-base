"""Public showcase router providing unauthenticated read access to agency portfolio and team profiles."""

from typing import Annotated
from fastapi import APIRouter, Path, Query, Response, status

from src.conf import settings
from src.share.dependencies import SessionDep
from src.share.responses import PageResult
from . import service
from .schemas import (
    PublicMember,
    PublicOverview,
    PublicProjectCard,
    PublicProjectDetail,
    PublicTechnologySummary,
)

router = APIRouter(prefix=f"{settings.API_PREFIX}/public", tags=["Public Showcase"])


def _set_cache_headers(response: Response, max_age: int | None = None) -> None:
    """Sets standard Cache-Control header for static public endpoints."""
    ttl = max_age if max_age is not None else settings.PUBLIC_CACHE_MAX_AGE_SECONDS
    response.headers["Cache-Control"] = f"public, max-age={ttl}"


@router.get(
    "/overview",
    status_code=status.HTTP_200_OK,
    summary="Get public agency overview and statistics",
)
async def get_overview(
    response: Response,
    session: SessionDep,
) -> PublicOverview:
    """Retrieves high-level platform statistics, featured portfolio projects, and tech catalog."""
    _set_cache_headers(response)
    return await service.get_public_overview(session=session)


@router.get(
    "/projects",
    status_code=status.HTTP_200_OK,
    summary="List public showcase projects",
)
async def list_projects(
    response: Response,
    session: SessionDep,
    technology: Annotated[str | None, Query(description="Filter by technology slug")] = None,
    featured: Annotated[bool | None, Query(description="Filter by featured status")] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageResult[PublicProjectCard]:
    """Retrieves paginated projects marked with public visibility."""
    _set_cache_headers(response)
    return await service.list_public_projects(
        session=session,
        technology_slug=technology,
        featured=featured,
        offset=offset,
        limit=limit,
    )


@router.get(
    "/projects/{slug}",
    status_code=status.HTTP_200_OK,
    summary="Get public project details",
)
async def get_project(
    slug: Annotated[str, Path(min_length=1, description="Project slug")],
    response: Response,
    session: SessionDep,
) -> PublicProjectDetail:
    """Retrieves public project portfolio details, tech stack, and metadata."""
    _set_cache_headers(response)
    return await service.get_public_project(slug=slug, session=session)


@router.get(
    "/members",
    status_code=status.HTTP_200_OK,
    summary="List public agency team members",
)
async def list_members(
    response: Response,
    session: SessionDep,
    offset: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> PageResult[PublicMember]:
    """Retrieves developers who opted into the public agency roster."""
    _set_cache_headers(response)
    return await service.list_public_members(session=session, offset=offset, limit=limit)


@router.get(
    "/technologies",
    status_code=status.HTTP_200_OK,
    summary="List available showcase technologies",
)
async def list_technologies(
    response: Response,
    session: SessionDep,
) -> list[PublicTechnologySummary]:
    """Retrieves technology catalog for showcase filtering."""
    _set_cache_headers(response)
    return await service.list_public_technologies(session=session)
