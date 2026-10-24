"""Helper utilities for networking, IP resolution, slugification, and audit serialization."""

import ipaddress
import re
import unicodedata
from typing import Any
from fastapi import Request
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import DeclarativeBase

from src.conf import settings
from .limits import AUDIT_USER_AGENT_MAX
from .schemas import AuditContext, AuditContextDict


def _is_trusted_proxy(host: str) -> bool:
    """Checks whether an incoming IP host belongs to any configured trusted proxy network."""
    if not settings.TRUSTED_PROXIES:
        return False
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False

    for net_str in settings.TRUSTED_PROXIES:
        try:
            if ip in ipaddress.ip_network(net_str, strict=False):
                return True
        except ValueError:
            continue
    return False


def resolve_client_ip(request: Request) -> str:
    """Resolves client IP, parsing X-Forwarded-For up to TRUSTED_PROXY_COUNT if from trusted proxies.

    Args:
        request: FastAPI HTTP request instance.

    Returns:
        Validated IP address string or fallback socket host.
    """
    peer = request.client.host if request.client else "127.0.0.1"
    if not (settings.TRUST_PROXY_HEADERS and peer and _is_trusted_proxy(peer)):
        return peer

    chain = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
    if not chain:
        return peer

    # Parse chain backwards respecting trusted proxy count
    candidate = peer
    proxies_seen = 0
    for raw in reversed(chain):
        try:
            ip = str(ipaddress.ip_address(raw))
        except ValueError:
            return peer

        if proxies_seen < settings.TRUSTED_PROXY_COUNT and _is_trusted_proxy(ip):
            proxies_seen += 1
            candidate = ip
        else:
            return ip

    return candidate


def slugify(text: str, fallback: str = "item") -> str:
    """Generates a URL-friendly slug supporting both ASCII and Unicode (Arabic/multilingual).

    Args:
        text: Input string to slugify.
        fallback: Fallback string if text contains only stripped symbols.

    Returns:
        Clean hyphen-delimited lowercase slug.
    """
    if not text:
        return fallback

    text = unicodedata.normalize("NFKC", text).lower().strip()
    # Replace spaces and underscores with hyphens
    text = re.sub(r"[\s_]+", "-", text)
    # Remove characters that are neither word characters nor hyphens
    text = re.sub(r"[^\w\-]+", "", text, flags=re.UNICODE)
    # Collapse multiple hyphens
    text = re.sub(r"-+", "-", text).strip("-")

    return text or fallback


def get_extra_dict_for_updates(
    *,
    update_dict: dict[str, Any],
    old_state: dict[str, Any] | DeclarativeBase | None = None,
) -> dict[str, dict[str, Any]]:
    """Builds a structured dictionary tracking old vs new values for audit logging.

    Args:
        update_dict: Dictionary of modified fields and their new values.
        old_state: Pre-update state as either a dictionary or ORM model snapshot.

    Returns:
        Structured diff dictionary: {field: {"old": ..., "new": ...}}.
    """
    if not update_dict:
        return {"update_dict": {}}

    old_map: dict[str, Any] = {}
    if isinstance(old_state, dict):
        old_map = old_state
    elif old_state is not None:
        old_map = {k: getattr(old_state, k, None) for k in update_dict}

    diff = {
        k: {"old": old_map.get(k), "new": v}
        for k, v in update_dict.items()
    }

    return jsonable_encoder(diff)


def get_audit_context(request: Request) -> AuditContext:
    """Extracts client IP, user agent, and request ID from an HTTP request.

    Args:
        request: Incoming FastAPI HTTP request.

    Returns:
        Immutable AuditContext instance.
    """
    ip = resolve_client_ip(request)
    ua = request.headers.get("user-agent")
    if ua is not None:
        ua = ua[:AUDIT_USER_AGENT_MAX]

    req_id = getattr(request.state, "request_id", None)

    return AuditContext(
        ip_address=ip,
        user_agent=ua,
        request_id=req_id,
    )


def get_audit_context_dict(ctx: AuditContext | None = None) -> AuditContextDict:
    """Converts an AuditContext instance into a TypedDict representation.

    Args:
        ctx: Optional AuditContext instance.

    Returns:
        Standardized AuditContextDict.
    """
    return AuditContextDict(
        ip=ctx.ip_address if ctx else None,
        ua=ctx.user_agent if ctx else None,
        req_id=ctx.request_id if ctx else None,
    )
