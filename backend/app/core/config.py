from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Look for .env at repo root (../  when running from backend/) then fall back to local .env
    model_config = SettingsConfigDict(env_file=["../.env", ".env"], env_file_encoding="utf-8", extra="ignore")

    # App
    APP_NAME: str = "Job Agent"
    DEBUG: bool = False
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development | production

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/jobagent"

    # Redis / Celery
    REDIS_URL: str = "redis://localhost:6379"

    # JWT
    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI — Claude (Anthropic)
    ANTHROPIC_API_KEY: str = ""
    DEFAULT_CLAUDE_MODEL: str = "claude-sonnet-4-6"

    # AI — Gemini (Google)
    GEMINI_API_KEY: Optional[str] = None
    DEFAULT_GEMINI_MODEL: str = "gemini-2.0-flash"

    # Default LLM provider: "claude" | "gemini"
    DEFAULT_LLM_PROVIDER: str = "claude"

    # OpenAI (optional)
    OPENAI_API_KEY: Optional[str] = None

    # Scraping
    BRIGHT_DATA_API_KEY: Optional[str] = None
    MAX_RESULTS_PER_SCRAPE: int = 50

    # Observability
    LANGFUSE_PUBLIC_KEY: Optional[str] = None
    LANGFUSE_SECRET_KEY: Optional[str] = None
    LANGFUSE_HOST: str = "https://cloud.langfuse.com"

    # Security
    RATE_LIMIT_LOGIN: str = "10/minute"
    RATE_LIMIT_API: str = "200/minute"
    MIN_PASSWORD_LENGTH: int = 8

    # Frontend
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001"]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"


settings = Settings()
