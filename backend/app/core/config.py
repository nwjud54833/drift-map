"""Application configuration loaded from environment variables / .env file.

V2 additions: LLM_*, EMBEDDING_MODEL, DATABASE_URL, REDIS_URL, SANDBOX_ENABLED,
token/output budgets. V1 names (OPENAI_API_KEY/BASE_URL/MODEL) remain supported
as aliases; LLM_* takes precedence when both are set.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/core/config.py -> parents[2] is the backend/ directory
_BACKEND_ROOT = Path(__file__).resolve().parents[2]

APP_VERSION = "0.2.0"
SERVICE_NAME = "personal-ai-coding-agent-api"


class Settings(BaseSettings):
    """Typed application settings. All values come from the environment or .env."""

    model_config = SettingsConfigDict(
        env_file=(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM provider (OpenAI-compatible). Empty key means "not configured". ---
    LLM_API_KEY: str = ""
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_MODEL: str = "gpt-4o-mini"
    # V1 aliases (still honored when LLM_* are not set)
    OPENAI_API_KEY: str = ""
    OPENAI_BASE_URL: str = "https://api.openai.com/v1"
    OPENAI_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "local:sentence-transformers/all-MiniLM-L6-v2"

    @model_validator(mode="after")
    def _resolve_llm_aliases(self) -> Settings:
        """LLM_* wins when set; otherwise fall back to the V1 OPENAI_* values."""
        fields_set = self.model_fields_set
        if "LLM_API_KEY" not in fields_set:
            self.LLM_API_KEY = self.OPENAI_API_KEY
        if "LLM_BASE_URL" not in fields_set:
            self.LLM_BASE_URL = self.OPENAI_BASE_URL
        if "LLM_MODEL" not in fields_set:
            self.LLM_MODEL = self.OPENAI_MODEL
        return self

    # --- Infrastructure ---
    DATABASE_URL: str = ""  # empty -> local SQLite (backend/local.db)
    REDIS_URL: str = ""  # empty -> Redis disabled
    SANDBOX_ENABLED: bool = False  # execution stays off until explicitly configured

    # --- CORS: only the local dev frontend by default. ---
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # --- Limits (V1, preserved) ---
    MAX_FILE_BYTES: int = 1_000_000  # 1 MB per file
    MAX_LLM_CONTEXT_CHARS: int = 50_000  # max file text sent to the LLM
    MAX_QUESTION_CHARS: int = 2_000
    MAX_SCAN_FILES: int = 2_000
    MAX_TREE_DEPTH: int = 12
    CLONE_TIMEOUT_SECONDS: int = 120
    LLM_TIMEOUT_SECONDS: float = 90.0

    # --- Budgets (V2; enforced from Phase 4/5 onward) ---
    MAX_CONTEXT_TOKENS: int = 100_000
    MAX_OUTPUT_TOKENS: int = 4_000
    MAX_TOOL_CALLS_PER_RUN: int = 12
    MAX_PATCH_REVISIONS: int = 2
    MAX_RUN_WALLCLOCK_SECONDS: int = 600

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        """Allow BACKEND_CORS_ORIGINS to be a comma-separated string in env vars."""
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def llm_configured(self) -> bool:
        """True when an effective API key is present (LLM_* or OPENAI_*)."""
        return bool(self.LLM_API_KEY.strip())

    @property
    def database_url_effective(self) -> str:
        """The URL the db engine will actually use."""
        if self.DATABASE_URL.strip():
            return self.DATABASE_URL.strip()
        return f"sqlite:///{(_BACKEND_ROOT / 'local.db').as_posix()}"


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor (cache can be reset in tests via get_settings.cache_clear())."""
    return Settings()
