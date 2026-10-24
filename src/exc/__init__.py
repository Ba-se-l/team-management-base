"""Exceptions facade package.

Exports the platform-wide exception hierarchy and global FastAPI error handlers.
"""

from .base import (
    AccessDeniedException,
    AlreadyExistsException,
    AppException,
    BusinessRuleViolationException,
    ForbiddenException,
    InactiveEntityException,
    InvalidCredentialsException,
    NotFoundException,
    PermissionDeniedException,
    TokenRevokedException,
    TokenStaleException,
)
from .handlers import (
    app_exception_handler,
    global_exception_handler,
    http_exception_handler,
    register_exception_handlers,
    validation_exception_handler,
)

__all__ = (
    "AppException",
    "NotFoundException",
    "AlreadyExistsException",
    "AccessDeniedException",
    "ForbiddenException",
    "PermissionDeniedException",
    "InactiveEntityException",
    "InvalidCredentialsException",
    "TokenRevokedException",
    "TokenStaleException",
    "BusinessRuleViolationException",
    "register_exception_handlers",
    "app_exception_handler",
    "validation_exception_handler",
    "http_exception_handler",
    "global_exception_handler",
)
