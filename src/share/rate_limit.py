"""In-memory sliding-window rate limiter dependency for FastAPI routes."""

import time
from collections import defaultdict
from fastapi import Request
from src.exc import AppException
from .helpers import resolve_client_ip


class RateLimiter:
    """Sliding-window rate limiter tracking requests by client IP and path."""

    _instances: list["RateLimiter"] = []

    def __init__(self, requests_limit: int, window_seconds: int = 60) -> None:
        """Initializes the rate limiter.

        Args:
            requests_limit: Maximum allowed requests within the time window.
            window_seconds: Duration of the rolling window in seconds. Defaults to 60.
        """
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self._history: dict[str, list[float]] = defaultdict(list)
        RateLimiter._instances.append(self)

    def reset(self) -> None:
        """Clears the request history."""
        self._history.clear()

    @classmethod
    def reset_all(cls) -> None:
        """Clears request history for all instantiated rate limiters."""
        for instance in cls._instances:
            instance.reset()

    async def __call__(self, request: Request) -> None:
        """Evaluates incoming request and raises HTTP 429 if threshold is exceeded."""
        client_ip = resolve_client_ip(request)
        route_path = request.url.path
        key = f"{client_ip}:{route_path}"
        now = time.monotonic()

        window_start = now - self.window_seconds
        # Evict timestamps outside the active rolling window
        timestamps = [ts for ts in self._history[key] if ts > window_start]
        self._history[key] = timestamps

        if len(timestamps) >= self.requests_limit:
            retry_after = int(self.window_seconds - (now - timestamps[0]))
            raise AppException(
                message=f"Rate limit exceeded. Try again in {max(1, retry_after)} seconds.",
                error_code="RATE_LIMIT_EXCEEDED",
                status_code=429,
                details={"retry_after_seconds": max(1, retry_after)},
            )

        self._history[key].append(now)
