from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"
    PROJECT_NAME: str = "Biblioteca SaaS"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"

    # ── Database ─────────────────────────────────────────────────────────────
    DATABASE_URL: str = (
        "postgresql+asyncpg://biblioteca:biblioteca_secret@localhost:5432/biblioteca_db"
    )

    # ── JWT Auth ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production-must-be-at-least-32-characters"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── Google Gemini ─────────────────────────────────────────────────────────
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-1.5-flash-latest"

    # ── MinIO / S3 ────────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "http://localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin_secret"
    MINIO_BUCKET_NAME: str = "biblioteca-files"

    # ── CORS ──────────────────────────────────────────────────────────────────
    # Stored as comma-separated string — pydantic-settings v2 cannot reliably
    # coerce "a,b,c" into list[str] from env vars without JSON brackets.
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:80,http://localhost"

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 100
    RATE_LIMIT_AUTH_PER_MINUTE: int = 20
    RATE_LIMIT_AI_PER_MINUTE: int = 10

    # ── Cookie settings ───────────────────────────────────────────────────────
    COOKIE_SECURE: bool = False  # True in production (HTTPS)
    COOKIE_SAMESITE: Literal["lax", "strict", "none"] = "lax"
    COOKIE_DOMAIN: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        """Return CORS_ORIGINS as a parsed list, stripping whitespace."""
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
