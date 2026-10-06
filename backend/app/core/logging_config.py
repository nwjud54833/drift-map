"""Logging configuration with best-effort secret redaction.

Never log API keys, full prompts, or file contents. The redaction filter below is
a safety net for key-shaped strings; call sites must still avoid logging secrets.
"""

from __future__ import annotations

import logging
import re

_SECRET_PATTERNS = re.compile(
    r"(sk-[A-Za-z0-9_-]{8,})"  # OpenAI-style keys
    r"|(Bearer\s+[A-Za-z0-9._-]{8,})"  # bearer tokens
    r"|(gh[pousr]_[A-Za-z0-9_]{8,})"  # GitHub tokens
    r"|(eyJ[A-Za-z0-9_-]{20,})"  # JWT-looking strings
)


class SecretRedactionFilter(logging.Filter):
    """Best-effort redaction of key-shaped strings in every log record."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
            if _SECRET_PATTERNS.search(message):
                record.msg = _SECRET_PATTERNS.sub("[REDACTED]", message)
                record.args = None
        except Exception:  # never break logging
            pass
        return True


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logging once with a compact format and secret redaction."""
    root = logging.getLogger()
    if getattr(root, "_personal_agent_configured", False):
        return
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s"))
    handler.addFilter(SecretRedactionFilter())
    root.handlers = [handler]
    root.setLevel(level)
    root._personal_agent_configured = True  # type: ignore[attr-defined]
