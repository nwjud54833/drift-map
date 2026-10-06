"""Database engine and session management.

Phase 1 policy:
- DATABASE_URL (e.g. postgresql+psycopg://...) is used when provided.
- Otherwise a local SQLite file (backend/local.db) keeps native dev runnable
  without external services; tests use their own sqlite file or overrides.
"""

from __future__ import annotations

import logging
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import URL, create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger(__name__)

_BACKEND_ROOT = Path(__file__).resolve().parents[2]
_DEFAULT_SQLITE_URL = f"sqlite:///{(_BACKEND_ROOT / 'local.db').as_posix()}"

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def _normalize_url(url: str) -> str:
    """Make defaults explicit and ensure psycopg3 driver for Postgres."""
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


def _sqlite_url_object(url: str) -> URL:
    """Build a SQLite URL without string parsing.

    Windows drive letters (E:/...) are misread as host:port by make_url, so the
    database path is passed explicitly via URL.create.
    """
    prefix = "sqlite:///"
    database = url[len(prefix) :] if url.startswith(prefix) else ""
    return URL.create("sqlite", database=database)


def get_engine() -> Engine:
    """Create (once) and return the SQLAlchemy engine."""
    global _engine, _session_factory
    if _engine is None:
        settings = get_settings()
        url = _normalize_url(settings.database_url_effective)
        if url.startswith("sqlite"):
            _engine = create_engine(
                _sqlite_url_object(url), connect_args={"check_same_thread": False}
            )
        else:
            _engine = create_engine(url, pool_pre_ping=True)
        _session_factory = sessionmaker(bind=_engine, expire_on_commit=False)
        logger.info("Database engine ready (%s)", url.split("://")[0])
    return _engine


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a session."""
    factory = _session_factory or sessionmaker(bind=get_engine(), expire_on_commit=False)
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def check_db() -> str:
    """Return 'ok' or 'degraded' for /health; never raises."""
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
        return "ok"
    except Exception as exc:  # noqa: BLE001 - health must not raise
        logger.info("Database health check failed: %s", type(exc).__name__)
        return "degraded"


def reset_engine() -> None:
    """Dispose and clear cached engine (used by tests)."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
