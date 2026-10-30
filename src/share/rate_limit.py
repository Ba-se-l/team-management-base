"""In-memory sliding-window rate limiter dependency for FastAPI routes."""

import time
from collections import defaultdict
from fastapi import Request
from src.exc import AppException
from .helpers import resolve_client_ip


class RateLimiter:
    """Sliding-window rate limiter tracking requests by client IP and path."""

    _instances: list["RateLimiter"] = []

    def __init__(
        self,
        requests_limit: int,
        window_seconds: int = 60,
        max_keys: int = 10_000,
    ) -> None:
        """Initializes the rate limiter.

        Args:
            requests_limit: Maximum allowed requests within the time window.
            window_seconds: Duration of the rolling window in seconds. Defaults to 60.
            max_keys: Maximum number of tracked keys before pruning expired entries.
        """
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.max_keys = max_keys
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

    def _prune_stale_keys(self, window_start: float) -> None:
        """Removes expired or empty key entries to bound in-memory footprint."""
        stale_keys = [
            k for k, ts_list in self._history.items()
            if not ts_list or ts_list[-1] <= window_start
        ]
        for k in stale_keys:
            self._history.pop(k, None)
        if len(self._history) >= self.max_keys:
            oldest_key = min(
                self._history,
                key=lambda k: self._history[k][-1] if self._history[k] else 0.0,
            )
            self._history.pop(oldest_key, None)

    async def __call__(self, request: Request) -> None:
        """Evaluates incoming request and raises HTTP 429 if threshold is exceeded."""
        client_ip = resolve_client_ip(request)
        route_path = request.url.path
        key = f"{client_ip}:{route_path}"
        now = time.monotonic()

        window_start = now - self.window_seconds
        if len(self._history) >= self.max_keys:
            self._prune_stale_keys(window_start)

        # Evict timestamps outside the active rolling window
        timestamps = [ts for ts in self._history.get(key, []) if ts > window_start]
        if timestamps:
            self._history[key] = timestamps
        else:
            self._history.pop(key, None)

        if len(timestamps) >= self.requests_limit:
            retry_after = max(1, int(self.window_seconds - (now - timestamps[0])))
            raise AppException(
                message=f"Rate limit exceeded. Try again in {retry_after} seconds.",
                error_code="RATE_LIMIT_EXCEEDED",
                status_code=429,
                details={"retry_after_seconds": retry_after},
                headers={"Retry-After": str(retry_after)},
            )

        self._history[key].append(now)
