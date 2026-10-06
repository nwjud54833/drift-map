"""Redis connectivity helper for /health and (later) Celery.

Phase 1 policy: Redis is optional. When REDIS_URL is empty the component is
reported as "disabled" rather than degraded; when set but unreachable, "degraded".
"""

from __future__ import annotations

import logging

from app.core.config import get_settings

logger = logging.getLogger(__name__)


def check_redis() -> str:
    """Return 'ok' | 'degraded' | 'disabled' for /health; never raises."""
    settings = get_settings()
    if not settings.REDIS_URL.strip():
        return "disabled"
    try:
        import redis  # imported lazily so Redis stays optional

        client = redis.Redis.from_url(
            settings.REDIS_URL, socket_connect_timeout=1.0, socket_timeout=1.0
        )
        try:
            if client.ping():
                return "ok"
            return "degraded"
        finally:
            client.close()
    except Exception as exc:  # noqa: BLE001 - health must not raise
        logger.info("Redis health check failed: %s", type(exc).__name__)
        return "degraded"
