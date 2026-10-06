"""Shared pytest fixtures: temp workspace sandbox and offline settings."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core import paths as paths_module
from app.core.config import Settings


@pytest.fixture
def settings() -> Settings:
    """Offline test settings (no env file, no key)."""
    return Settings(
        OPENAI_API_KEY="",
        _env_file=None,  # type: ignore[call-arg]
    )


@pytest.fixture
def sandbox(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Point WORKSPACES_DIR at a per-test temp dir and return it."""
    workspaces = tmp_path / "workspace"
    workspaces.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(paths_module, "WORKSPACES_DIR", workspaces)
    return workspaces
