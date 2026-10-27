"""Main application entry point.

Initializes the FastAPI application, registers security middleware,
uniform exception handlers, and mounts domain routers and static files.
"""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.conf import settings
from src.database.engine import async_engine
from src.exc import register_exception_handlers
from src.modules import api_router
from src.share import RequestIdMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application lifecycle events.

    On startup: Initializes connection pools.
    On shutdown: Disposes engine connection pools cleanly.
    """
    yield
    await async_engine.dispose()


app = FastAPI(
    title="Team Management Platform API",
    version="1.0.0",
    description="Backend API for the developer workspace and agency team management platform.",
    lifespan=lifespan,
)

# Register request correlation tracing middleware
app.add_middleware(RequestIdMiddleware)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register uniform ErrorResponse exception handlers
register_exception_handlers(app)


@app.get("/health", tags=["Health"])
async def health_check() -> dict[str, str]:
    """Health check probe returning service status."""
    return {"status": "healthy", "service": "team-management-base"}


# Include the master API router
app.include_router(api_router)

# Serve the static frontend SPA via native FastAPI frontend routing
app.frontend("/", directory="static")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.RELOAD,
    )
