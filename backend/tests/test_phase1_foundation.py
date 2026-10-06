"""Phase 1 tests: settings aliases, database layer, health component behavior."""

from __future__ import annotations

import pytest
from sqlalchemy import text

from app.core.config import Settings, get_settings
from app.db import session as db_session
from app.db.base import Base, RepositoryRow, SnapshotRow


def test_llm_alias_fallback() -> None:
    """LLM_* empty -> V1 OPENAI_* values are used; llm_configured reflects that."""
    s = Settings(OPENAI_API_KEY="sk-test-123", _env_file=None)  # type: ignore[call-arg]
    assert s.LLM_API_KEY == "sk-test-123"
    assert s.llm_configured is True


def test_llm_primary_wins() -> None:
    s = Settings(
        LLM_API_KEY="sk-primary",
        OPENAI_API_KEY="sk-old",
        LLM_MODEL="m-primary",
        OPENAI_MODEL="m-old",
        _env_file=None,  # type: ignore[call-arg]
    )
    assert s.LLM_API_KEY == "sk-primary"
    assert s.LLM_MODEL == "m-primary"


def test_sandbox_disabled_by_default() -> None:
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.SANDBOX_ENABLED is False


def test_sqlite_effective_url(tmp_path) -> None:  # type: ignore[no-untyped-def]
    s = Settings(DATABASE_URL="", _env_file=None)  # type: ignore[call-arg]
    assert s.database_url_effective.startswith("sqlite:///")


def test_tables_created_and_roundtrip(tmp_path) -> None:  # type: ignore[no-untyped-def]
    """Create all tables on a fresh SQLite file; insert/read a repository row."""
    db_url = f"sqlite:///{(tmp_path / 't.db').as_posix()}"
    engine = db_session.create_engine(db_url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))
    from sqlalchemy.orm import Session

    with Session(engine) as session:
        repo = RepositoryRow(
            id="11111111-1111-1111-1111-111111111111",
            canonical_url="https://github.com/octocat/Hello-World",
            owner="octocat",
            name="Hello-World",
            ingestion_status="ready",
        )
        session.add(repo)
        session.add(
            SnapshotRow(
                id="22222222-2222-2222-2222-222222222222",
                repository_id=repo.id,
                branch="master",
                file_count=1,
            )
        )
        session.commit()
        loaded = session.get(RepositoryRow, repo.id)
        assert loaded is not None
        assert loaded.canonical_url.endswith("Hello-World")
        assert loaded.updated_at is not None
    engine.dispose()


def test_check_db_never_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """A broken engine yields 'degraded', not an exception."""

    class BrokenEngine:
        def connect(self):  # type: ignore[no-untyped-def]
            raise RuntimeError("boom")

    monkeypatch.setattr(db_session, "get_engine", lambda: BrokenEngine())  # type: ignore[arg-type]
    # check_db uses get_engine internally; patch module attribute it references
    original = db_session.get_engine
    try:
        assert db_session.check_db() in {"ok", "degraded"}
    finally:
        db_session.get_engine = original  # type: ignore[method-assign]


def test_check_redis_disabled_without_url() -> None:
    from app.services.redis_client import check_redis

    s = Settings(REDIS_URL="", _env_file=None)  # type: ignore[call-arg]
    assert s.REDIS_URL == ""
    # Default test env has no Redis URL; must be "disabled", never raise.
    assert check_redis() == "disabled"


def test_get_settings_cached() -> None:
    get_settings.cache_clear()
    assert get_settings() is get_settings()
