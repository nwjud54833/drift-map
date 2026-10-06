"""LLM configuration status for /health (never sends data anywhere)."""

from __future__ import annotations

from app.core.config import get_settings


def check_llm() -> str:
    """Return 'ok' | 'disabled' for /health.

    'ok' means a key is configured. No network call is made here: an invalid key
    surfaces later as a clean LLM_UPSTREAM_ERROR instead of failing health.
    """
    settings = get_settings()
    return "ok" if settings.llm_configured else "disabled"
