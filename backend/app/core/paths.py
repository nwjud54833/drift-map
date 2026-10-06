"""Shared filesystem locations for the application."""

from __future__ import annotations

from pathlib import Path

# backend/app/core/paths.py -> parents[2] is backend/
BACKEND_ROOT = Path(__file__).resolve().parents[2]
WORKSPACES_DIR = BACKEND_ROOT / "workspace"
