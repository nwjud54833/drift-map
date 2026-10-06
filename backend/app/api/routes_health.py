"""Health endpoint with component status (db, redis, llm)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter

from app.core.config import APP_VERSION, SERVICE_NAME
from app.db.session import check_db
from app.services.llm_health import check_llm
from app.services.redis_client import check_redis

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, Any]:
    """Liveness + identity + component status. Never raises on component failure."""
    components = {
        "db": check_db(),
        "redis": check_redis(),
        "llm": check_llm(),
    }
    # Overall status: ok when the API itself is serving; components carry detail.
    return {
        "status": "ok",
        "service": SERVICE_NAME,
        "version": APP_VERSION,
        "components": components,
    }
