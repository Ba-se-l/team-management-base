"""Security package public facade."""

from typing import Any
from .authorization import check_permission, get_casbin_enforcer, init_default_casbin_policies
from .casbin_rule import CasbinRule
from .security import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    hash_password,
    hash_password_async,
    verify_password,
    verify_password_async,
)


def __getattr__(name: str) -> Any:
    """Lazy imports domain-dependent guards to prevent package-level circular imports (PEP 562)."""
    if name in ("require_super_admin", "require_team_permission"):
        from . import guards

        return getattr(guards, name)
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")


__all__ = (
    "CasbinRule",
    "hash_password",
    "hash_password_async",
    "verify_password",
    "verify_password_async",
    "create_access_token",
    "create_refresh_token",
    "decode_access_token",
    "decode_refresh_token",
    "get_casbin_enforcer",
    "check_permission",
    "init_default_casbin_policies",
    "require_super_admin",
    "require_team_permission",
)

