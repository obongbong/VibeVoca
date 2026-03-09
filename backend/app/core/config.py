"""
VibeVoca - Application Configuration
Pydantic v2 settings loaded from environment variables.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ── App ──────────────────────────────────────────────────
    APP_NAME: str = "VibeVoca"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # ── Database ─────────────────────────────────────────────
    POSTGRES_USER: str = "vibevoca"
    POSTGRES_PASSWORD: str = "vibevoca_secret"
    POSTGRES_DB: str = "vibevoca"
    POSTGRES_HOST: str = "db"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def SYNC_DATABASE_URL(self) -> str:
        """Used by Alembic (sync driver)."""
        return (
            f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── JWT ──────────────────────────────────────────────────
    SECRET_KEY: str = "REQUIRED_SECRET_KEY"  # Must be set via environment variable
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # ── Social OAuth ──────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""

    # ── CORS ─────────────────────────────────────────────────
    CORS_ORIGINS: list[str] = []


@lru_cache
def get_settings() -> Settings:
    return Settings()
