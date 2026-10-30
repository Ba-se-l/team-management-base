"""Technology domain router.

Provides HTTP endpoints for managing the global technology catalog.
Since this is a global dictionary table, endpoints do not strictly
require team RBAC checks for MVP, but they do require authentication.
"""

from typing import Annotated
from fastapi import APIRouter, Path, Query, status

from src.conf import settings
from src.share.dependencies import CurrentUserDep, SessionDep, SuperAdminDep
from . import service
from .schemas import CreateTechnologyRequest, TechnologyResponse, UpdateTechnologyRequest

router = APIRouter(prefix=f"{settings.API_PREFIX}/technologies", tags=["Technologies"])


@router.post(
    "/",
    status_code=status.HTTP_201_CREATED,
    summary="Create a technology",
)
async def create_technology(
    request: CreateTechnologyRequest,
    current_user: SuperAdminDep,
    session: SessionDep,
) -> TechnologyResponse:
    """Creates a new technology entry in the global catalog."""
    tech = await service.create_technology(schema=request, session=session)
    return TechnologyResponse.model_validate(tech)


@router.get(
    "/search",
    status_code=status.HTTP_200_OK,
    summary="Search technologies",
)
async def search_technologies(
    q: Annotated[str, Query(min_length=1)],
    current_user: CurrentUserDep,
    session: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[TechnologyResponse]:
    """Searches the technology catalog by partial name match (case-insensitive)."""
    techs = await service.search_technologies(
        query=q,
        session=session,
        skip=skip,
        limit=limit,
    )
    return [TechnologyResponse.model_validate(t) for t in techs]


@router.get(
    "/",
    status_code=status.HTTP_200_OK,
    summary="List all technologies",
)
async def list_technologies(
    current_user: CurrentUserDep,
    session: SessionDep,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
) -> list[TechnologyResponse]:
    """Retrieves a paginated list of all technologies in the catalog."""
    techs = await service.list_technologies(
        session=session,
        skip=skip,
        limit=limit,
    )
    return [TechnologyResponse.model_validate(t) for t in techs]


@router.get(
    "/{tech_id}",
    status_code=status.HTTP_200_OK,
    summary="Get technology by ID",
)
async def get_technology(
    tech_id: Annotated[int, Path(ge=1, description="Technology ID")],
    current_user: CurrentUserDep,
    session: SessionDep,
) -> TechnologyResponse:
    """Fetches a specific technology by its integer ID."""
    tech = await service.get_technology(tech_id=tech_id, session=session)
    return TechnologyResponse.model_validate(tech)


@router.patch(
    "/{tech_id}",
    status_code=status.HTTP_200_OK,
    summary="Update a technology",
)
async def update_technology(
    tech_id: Annotated[int, Path(ge=1, description="Technology ID")],
    request: UpdateTechnologyRequest,
    current_user: SuperAdminDep,
    session: SessionDep,
) -> TechnologyResponse:
    """Updates an existing technology entry."""
    tech = await service.update_technology(
        tech_id=tech_id,
        schema=request,
        session=session,
    )
    return TechnologyResponse.model_validate(tech)


@router.delete(
    "/{tech_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a technology",
)
async def delete_technology(
    tech_id: Annotated[int, Path(ge=1, description="Technology ID")],
    current_user: SuperAdminDep,
    session: SessionDep,
) -> TechnologyResponse:
    """Hard-deletes a technology from the catalog."""
    tech = await service.delete_technology(tech_id=tech_id, session=session)
    return TechnologyResponse.model_validate(tech)
