"""Unified application exception hierarchy.

All domain exceptions in the platform inherit from ``AppException``.
Handlers in ``src.exc.handlers`` catch these and map them to standard
``ErrorResponse`` envelopes.
"""

from typing import Any


class AppException(Exception):
    """Base exception class for all domain-specific application errors.

    Attributes:
        message: Human-readable error description.
        error_code: Machine-readable uppercase identifier (e.g., "USER_NOT_FOUND").
        status_code: HTTP status code to return.
        details: Optional structured contextual details (e.g., validation info).
    """

    def __init__(
        self,
        message: str,
        error_code: str,
        status_code: int = 500,
        details: Any | None = None,
    ) -> None:
        """Initializes the base application exception.

        Args:
            message: Human-readable error description.
            error_code: Machine-readable error identifier.
            status_code: HTTP status code. Defaults to 500.
            details: Optional structured details dictionary or list.
        """
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details
        super().__init__(self.message)


class NotFoundException(AppException):
    """Raised when a requested entity does not exist in the database."""

    def __init__(self, entity: str, identifier: str | int) -> None:
        """Initializes the not-found exception.

        Args:
            entity: The type of entity that was not found (e.g., "User").
            identifier: The lookup key used.
        """
        super().__init__(
            message=f"{entity} with identifier '{identifier}' was not found.",
            error_code=f"{entity.upper()}_NOT_FOUND",
            status_code=404,
        )


class AlreadyExistsException(AppException):
    """Raised when an operation violates a uniqueness constraint."""

    def __init__(self, entity: str, field: str, value: str | int) -> None:
        """Initializes the already-exists exception.

        Args:
            entity: The entity type.
            field: The conflicting attribute.
            value: The conflicting value.
        """
        super().__init__(
            message=f"{entity} with {field} '{value}' already exists.",
            error_code=f"{entity.upper()}_ALREADY_EXISTS",
            status_code=409,
        )


class AccessDeniedException(AppException):
    """Raised when authentication credentials are completely missing or invalid."""

    def __init__(self, message: str = "Access denied.") -> None:
        super().__init__(
            message=message,
            error_code="ACCESS_DENIED",
            status_code=403,
        )


class PermissionDeniedException(AppException):
    """Raised when an authenticated user lacks permissions for a specific action."""

    def __init__(self, message: str = "Permission denied.") -> None:
        super().__init__(
            message=message,
            error_code="PERMISSION_DENIED",
            status_code=403,
        )


class ForbiddenException(AppException):
    """Raised when access to a resource or action is forbidden."""

    def __init__(
        self,
        message: str = "Access to this resource is forbidden.",
        error_code: str = "FORBIDDEN",
        details: Any | None = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=403,
            details=details,
        )



class InactiveEntityException(AppException):
    """Raised when attempting an operation on a soft-deleted or inactive entity."""

    def __init__(self, entity: str, identifier: str | int) -> None:
        super().__init__(
            message=f"{entity} with identifier '{identifier}' is inactive.",
            error_code=f"{entity.upper()}_INACTIVE",
            status_code=403,
        )


class InvalidCredentialsException(AppException):
    """Raised when login credentials or JWT verification fails."""

    def __init__(self, message: str = "Invalid email or password.") -> None:
        super().__init__(
            message=message,
            error_code="INVALID_CREDENTIALS",
            status_code=401,
        )


class TokenRevokedException(AppException):
    """Raised when a refresh token has been revoked or expired."""

    def __init__(self, message: str = "Refresh token has been revoked or is invalid.") -> None:
        super().__init__(
            message=message,
            error_code="TOKEN_REVOKED",
            status_code=401,
        )


class TokenStaleException(AppException):
    """Raised when an access token was signed under an outdated security version."""

    def __init__(
        self,
        message: str = "Session has been invalidated due to credential changes. Please log in again.",
    ) -> None:
        super().__init__(
            message=message,
            error_code="TOKEN_STALE",
            status_code=401,
        )


class BusinessRuleViolationException(AppException):
    """Raised when an operation violates a domain invariant or business rule."""

    def __init__(
        self,
        message: str,
        error_code: str = "BUSINESS_RULE_VIOLATION",
        details: Any | None = None,
    ) -> None:
        super().__init__(
            message=message,
            error_code=error_code,
            status_code=422,
            details=details,
        )
