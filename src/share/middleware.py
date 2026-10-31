"""HTTP middleware for distributed correlation tracing and security contexts."""

import contextvars
import uuid
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

request_id_ctx_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)


def get_current_request_id() -> str | None:
    """Retrieves the correlation request ID bound to the current async context."""
    return request_id_ctx_var.get()


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Assigns or propagates an X-Request-ID header on every HTTP transaction."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        req_id = request.headers.get("X-Request-ID")
        if not req_id:
            req_id = uuid.uuid4().hex

        request.state.request_id = req_id
        token = request_id_ctx_var.set(req_id)

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = req_id
            return response
        finally:
            request_id_ctx_var.reset(token)
