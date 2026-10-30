"""Application settings and environment configuration loaded via Pydantic Settings."""

from typing import Literal
from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_DEFAULT_SECRET = "dev-only-insecure-access-secret-key-do-not-use-in-prod-32b"
_DEV_DEFAULT_REFRESH_SECRET = "dev-only-insecure-refresh-secret-key-do-not-use-in-prod-32b"
_FORBIDDEN_PROD_PATTERNS: tuple[str, ...] = (
    "secret-key-in-production-time-in-this-place",
    "refresh-secret-key-in-production-time-in-this-place",
    "dev-secret-key-change-in-production",
    "dev-refresh-secret-key-change-in-production",
    "f3a9c8e7b1d204968574635241a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2",
    "your-super-secret-jwt-key",
    "your-different-super-secret",
    "change-in-production",
    "change_me",
    "changeme",
    "dev-only-insecure",
    "placeholder",
)


class EnvSettings(BaseSettings):
    """Platform configuration loaded from environment variables and `.env` file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Server Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    RELOAD: bool = False
    ENVIRONMENT: Literal["dev", "test", "prod"] = "dev"
    API_PREFIX: str = "/api/v1"

    # Database Configuration
    DATABASE_URL: str = "sqlite+aiosqlite:///./platform.db"
    ECHO: bool = False
    AUTO_FLUSH: bool = False
    EXPIRE_ON_COMMIT: bool = False
    POOL_SIZE: int = 20
    MAX_OVERFLOW: int = 10
    POOL_TIMEOUT: int = 30
    POOL_PRE_PING: bool = True

    # Security & Tokens
    SECRET_KEY: str = Field(default=_DEV_DEFAULT_SECRET)
    REFRESH_SECRET_KEY: str = Field(default=_DEV_DEFAULT_REFRESH_SECRET)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_COOKIE_NAME: str = "refresh_token"
    REFRESH_COOKIE_SECURE: bool = False
    ALLOW_PUBLIC_REGISTRATION: bool = False
    PUBLIC_CACHE_MAX_AGE_SECONDS: int = 60

    # CORS & Networking
    CORS_ORIGINS: list[str] = []
    TRUST_PROXY_HEADERS: bool = True
    TRUSTED_PROXIES: list[str] = ["127.0.0.1", "::1"]
    TRUSTED_PROXY_COUNT: int = 1

    # Rate Limiting (Requests per minute)
    LOGIN_RATE_LIMIT: int = 5
    INQUIRY_RATE_LIMIT: int = 3

    @model_validator(mode="after")
    def _validate_settings(self) -> "EnvSettings":
        """Enforces production safety invariants and environment defaults."""
        for field_name in ("SECRET_KEY", "REFRESH_SECRET_KEY"):
            val: str = getattr(self, field_name, "")
            if not val or len(val.strip()) < 32:
                raise ValueError(
                    f"FATAL: {field_name} must be at least 32 characters long."
                )

        if self.SECRET_KEY == self.REFRESH_SECRET_KEY:
            raise ValueError(
                "FATAL: SECRET_KEY and REFRESH_SECRET_KEY must be cryptographically distinct."
            )

        if self.ENVIRONMENT == "prod":
            self.REFRESH_COOKIE_SECURE = True

            for field_name in ("SECRET_KEY", "REFRESH_SECRET_KEY"):
                val_lower = getattr(self, field_name).lower()
                if any(pattern in val_lower for pattern in _FORBIDDEN_PROD_PATTERNS):
                    raise ValueError(
                        f"FATAL: {field_name} contains an insecure default or example placeholder. "
                        "A cryptographically strong secret must be set in `.env` for production."
                    )

            if self.ECHO:
                raise ValueError("FATAL: `ECHO` must be False in production to avoid leaking sensitive query data.")

        return self


settings = EnvSettings()