"""Application settings and environment configuration loaded via Pydantic Settings."""

from typing import Literal
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    SECRET_KEY: str = "secret-key-in-production-time-in-this-place"
    REFRESH_SECRET_KEY: str = "refresh-secret-key-in-production-time-in-this-place"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_COOKIE_NAME: str = "refresh_token"
    REFRESH_COOKIE_SECURE: bool = False

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
        """Enforces production safety invariants and defaults."""
        if self.ENVIRONMENT == "prod":
            if self.REFRESH_COOKIE_SECURE is False:
                self.REFRESH_COOKIE_SECURE = True

            placeholders = {
                "SECRET_KEY": "secret-key-in-production-time-in-this-place",
                "REFRESH_SECRET_KEY": "refresh-secret-key-in-production-time-in-this-place",
            }
            for field_name, placeholder in placeholders.items():
                val: str = getattr(self, field_name)
                if val.startswith(placeholder):
                    raise ValueError(
                        f"FATAL: {field_name} contains an insecure default placeholder. "
                        "A cryptographically strong secret must be set in `.env` for production."
                    )

            if self.ECHO:
                raise ValueError("FATAL: `ECHO` must be False in production to avoid leaking sensitive query data.")

        return self


settings = EnvSettings()