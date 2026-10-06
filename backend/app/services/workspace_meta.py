"""Tiny JSON-file metadata store for cloned workspaces (no database).

Each workspace keeps workspace-meta.json alongside repo/ describing where the
clone came from. Only non-sensitive fields are stored.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import TypedDict

from app.core.paths import WORKSPACES_DIR

logger = logging.getLogger(__name__)

_META_FILENAME = "workspace-meta.json"


class WorkspaceMeta(TypedDict):
    repo_id: str
    repo_name: str
    repo_url: str
    default_branch: str | None
    cloned_at_utc: str


def _meta_path(repo_id: str) -> Path:
    return WORKSPACES_DIR / repo_id / _META_FILENAME


def save_meta(meta: WorkspaceMeta) -> None:
    """Persist workspace metadata; failures are logged and ignored (non-critical)."""
    path = _meta_path(meta["repo_id"])
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(meta, indent=2), encoding="utf-8")
    except OSError as exc:
        logger.warning("Could not save workspace metadata: %s", type(exc).__name__)


def load_meta(repo_id: str) -> WorkspaceMeta | None:
    """Load workspace metadata; returns None when missing or unreadable."""
    path = _meta_path(repo_id)
    try:
        if not path.is_file():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            return None
        return WorkspaceMeta(
            repo_id=str(data.get("repo_id", repo_id)),
            repo_name=str(data.get("repo_name", "repository")),
            repo_url=str(data.get("repo_url", "")),
            default_branch=data.get("default_branch"),
            cloned_at_utc=str(data.get("cloned_at_utc", "")),
        )
    except (OSError, ValueError):
        return None
