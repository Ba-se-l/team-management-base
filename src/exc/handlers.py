"""Global FastAPI exception handlers enforcing the uniform ErrorResponse envelope."""

import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.share.responses import ErrorDetail, ErrorResponse
from src.share.schemas import _HTTP_ERROR_CODE_MAP
from .base import AppException

logger = logging.getLogger(__name__)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Handles all domain exceptions inheriting from AppException."""
    req_id = getattr(request.state, "request_id", None)
    envelope = ErrorResponse(
        success=False,
        error=ErrorDetail(
            code=exc.error_code,
            message=exc.message,
            details=exc.details,
        ),
        request_id=req_id,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope.model_dump(exclude_none=True),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """Handles FastAPI/Pydantic request body and query parameter validation errors."""
    req_id = getattr(request.state, "request_id", None)
    envelope = ErrorResponse(
        success=False,
        error=ErrorDetail(
            code="VALIDATION_ERROR",
            message="Request validation failed.",
            details=exc.errors(),
        ),
        request_id=req_id,
    )
    return JSONResponse(
        status_code=422,
        content=envelope.model_dump(exclude_none=True),
    )


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Handles standard Starlette HTTP exceptions (e.g. 404, 405)."""
    req_id = getattr(request.state, "request_id", None)
    code = _HTTP_ERROR_CODE_MAP.get(exc.status_code, "HTTP_ERROR")
    envelope = ErrorResponse(
        success=False,
        error=ErrorDetail(
            code=code,
            message=str(exc.detail),
        ),
        request_id=req_id,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content=envelope.model_dump(exclude_none=True),
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Fallback handler catching unhandled exceptions and logging full trace with correlation ID."""
    req_id = getattr(request.state, "request_id", None)
    logger.exception(
        "Unhandled server error [request_id=%s]: %s",
        req_id or "N/A",
        exc,
    )
    envelope = ErrorResponse(
        success=False,
        error=ErrorDetail(
            code="INTERNAL_SERVER_ERROR",
            message="An unexpected server error occurred.",
        ),
        request_id=req_id,
    )
    return JSONResponse(
        status_code=500,
        content=envelope.model_dump(exclude_none=True),
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Registers all standardized envelope error handlers on the FastAPI application instance."""
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)
