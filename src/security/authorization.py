"""Casbin RBAC authorization engine and policy enforcement service."""

from pathlib import Path
import casbin
from casbin_async_sqlalchemy_adapter import Adapter

from src.database.engine import async_engine
from src.database.enums import TeamRole
from src.security.casbin_rule import CasbinRule

_MODEL_PATH = Path(__file__).parent / "rbac_model.conf"

_enforcer: casbin.AsyncEnforcer | None = None


async def get_casbin_enforcer() -> casbin.AsyncEnforcer:
    """Provides a singleton async Casbin enforcer wired to the database adapter.

    Returns:
        Configured and synchronized AsyncEnforcer instance.
    """
    global _enforcer
    if _enforcer is None:
        adapter = Adapter(async_engine, CasbinRule)
        _enforcer = casbin.AsyncEnforcer(str(_MODEL_PATH), adapter)
        await _enforcer.load_policy()
        await init_default_casbin_policies(_enforcer)
    return _enforcer


async def init_default_casbin_policies(enforcer: casbin.AsyncEnforcer) -> None:
    """Initializes default role permission matrices in Casbin storage if absent.

    Args:
        enforcer: Active Casbin AsyncEnforcer instance.
    """
    default_policies: list[tuple[str, str, str, str]] = [
        # Team Admin has unrestricted access within their team
        (TeamRole.ADMIN.value, "*", "*", "*"),
        # Developer permissions
        (TeamRole.DEVELOPER.value, "*", "team", "read"),
        (TeamRole.DEVELOPER.value, "*", "member", "read"),
        (TeamRole.DEVELOPER.value, "*", "project", "read"),
        (TeamRole.DEVELOPER.value, "*", "project", "create"),
        (TeamRole.DEVELOPER.value, "*", "project", "update"),
        (TeamRole.DEVELOPER.value, "*", "task", "read"),
        (TeamRole.DEVELOPER.value, "*", "task", "create"),
        (TeamRole.DEVELOPER.value, "*", "task", "update"),
        (TeamRole.DEVELOPER.value, "*", "comment", "create"),
        (TeamRole.DEVELOPER.value, "*", "comment", "read"),
        (TeamRole.DEVELOPER.value, "*", "comment", "delete"),
        # Viewer permissions (read-only)
        (TeamRole.VIEWER.value, "*", "team", "read"),
        (TeamRole.VIEWER.value, "*", "member", "read"),
        (TeamRole.VIEWER.value, "*", "project", "read"),
        (TeamRole.VIEWER.value, "*", "task", "read"),
        (TeamRole.VIEWER.value, "*", "comment", "read"),
    ]

    modified = False
    for sub, dom, obj, act in default_policies:
        if not enforcer.has_policy(sub, dom, obj, act):
            await enforcer.add_policy(sub, dom, obj, act)
            modified = True

    if modified:
        await enforcer.save_policy()


async def check_permission(
    *,
    sub: str,
    dom: str,
    obj: str,
    act: str,
    enforcer: casbin.AsyncEnforcer | None = None,
) -> bool:
    """Evaluates whether subject has permission to execute action on object in domain.

    Args:
        sub: Role or subject identifier (e.g. 'admin', 'developer', 'viewer', 'super_admin').
        dom: Domain or team ID string (or '*' for wildcard).
        obj: Resource type (e.g. 'project', 'task', 'comment', 'member', 'team').
        act: Action (e.g. 'create', 'read', 'update', 'delete', '*').
        enforcer: Optional active enforcer instance.

    Returns:
        True if permitted, False otherwise.
    """
    enf = enforcer or await get_casbin_enforcer()
    return enf.enforce(sub, str(dom), obj, act)
