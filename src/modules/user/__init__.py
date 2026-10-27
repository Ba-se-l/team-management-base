"""User module public API.

Exposes ORM models, exceptions, repositories, schemas, and the FastAPI router.
"""

from .models import User
from .repository import UserRepository
from .exceptions import UserNotFoundException, UserAlreadyExistsException, UserInactiveException
from .schemas import UserResponse

__all__ = (
    # from models.py
    'User',

    # from repository.py
    'UserRepository',

    # from exceptions.py
    'UserNotFoundException',
    'UserAlreadyExistsException',
    'UserInactiveException',

    # from schemas.py
    'UserResponse',

    # from router.py
    'router',
)


def __getattr__(name: str):
    """PEP 562 lazy loading for router to prevent circular dependencies."""
    if name == "router":
        from .router import router
        return router
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")