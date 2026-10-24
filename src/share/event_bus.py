"""In-process asynchronous publish-subscribe event bus for domain events.

Allows decoupled communication across bounded contexts. Handlers are executed
sequentially in registration order to ensure safety on shared database sessions.
"""

from collections import defaultdict
from collections.abc import Awaitable, Callable
import logging
from typing import Any
from sqlalchemy.ext.asyncio import AsyncSession

from .schemas import DomainEvent

logger = logging.getLogger(__name__)

type EventHandler[E: DomainEvent] = Callable[[E, AsyncSession | None], Awaitable[None]]


class AsyncEventBus:
    """Asynchronous in-memory event dispatcher supporting domain event subscription."""

    def __init__(self) -> None:
        self._handlers: dict[type[DomainEvent], list[EventHandler[Any]]] = defaultdict(list)

    def subscribe[E: DomainEvent](
        self,
        event_type: type[E],
        handler: EventHandler[E],
    ) -> None:
        """Registers an asynchronous handler for an exact domain event type (idempotent).

        Args:
            event_type: Concrete DomainEvent subclass to listen for.
            handler: Async callable receiving the event instance and an optional session.
        """
        handlers = self._handlers[event_type]
        if handler in handlers:
            return
        handlers.append(handler)

    async def publish(
        self,
        event: DomainEvent,
        *,
        session: AsyncSession | None = None,
    ) -> None:
        """Dispatches a domain event to all subscribed handlers sequentially.

        Args:
            event: The immutable domain fact to broadcast.
            session: Optional active transaction session forwarded to handlers.
        """
        for handler in self._handlers.get(type(event), ()):
            await self._run(handler, event, session)

    async def clear(self) -> None:
        """Removes all registered handlers. Primarily used for test isolation."""
        self._handlers.clear()

    async def _run(
        self,
        handler: EventHandler[Any],
        event: DomainEvent,
        session: AsyncSession | None,
    ) -> None:
        """Safely executes a single handler with error isolation and logging.

        Args:
            handler: Handler function to execute.
            event: Domain event instance.
            session: Optional database session.
        """
        try:
            await handler(event, session)
        except Exception as exc:
            logger.error(
                "Unhandled error in event handler [%s] for event [%s]: %s",
                getattr(handler, "__name__", repr(handler)),
                type(event).__name__,
                exc,
                exc_info=True,
            )


event_bus = AsyncEventBus()
