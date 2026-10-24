"""Casbin rule declarative ORM model bound to platform Base metadata."""

from casbin_async_sqlalchemy_adapter import create_casbin_rule_model
from src.database.base import Base

CasbinRule = create_casbin_rule_model(Base, table_name="casbin_rule")

__all__ = (
    "CasbinRule",
)
