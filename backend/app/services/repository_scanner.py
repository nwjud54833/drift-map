"""Read-only repository scanner: file tree, language stats, warnings.

Safety: uses pathlib only (no shell), never follows directory symlinks, skips
ignored/secret/binary/oversized files, enforces depth and file-count limits, and
produces only non-sensitive metadata (counts, names, sizes).
"""

from __future__ import annotations

import logging
from collections import Counter
from pathlib import Path

from app.core.config import Settings
from app.models.repository import DirectoryNode, FileNode, TreeNode
from app.utils.file_filters import (
    is_binary_extension,
    is_ignored_directory,
    is_ignored_file,
)
from app.utils.language_detection import detect_language

logger = logging.getLogger(__name__)

# Project signal files worth mentioning in metadata (names, case-insensitive).
_PROJECT_SIGNAL_FILES: set[str] = {
    "readme.md",
    "readme.rst",
    "readme.txt",
    "readme",
    "package.json",
    "pyproject.toml",
    "requirements.txt",
    "dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
}

SIGNAL_LABELS: dict[str, str] = {
    "readme.md": "README",
    "readme.rst": "README",
    "readme.txt": "README",
    "readme": "README",
    "package.json": "package.json (Node.js project)",
    "pyproject.toml": "pyproject.toml (Python project)",
    "requirements.txt": "requirements.txt (Python dependencies)",
    "dockerfile": "Dockerfile",
    "docker-compose.yml": "Docker Compose",
    "docker-compose.yaml": "Docker Compose",
    "compose.yml": "Docker Compose",
    "compose.yaml": "Docker Compose",
}


class ScanResult:
    """Aggregated scan output."""

    def __init__(
        self,
        tree: list[TreeNode],
        total_files: int,
        languages: dict[str, int],
        warnings: list[str],
        signals: list[str],
    ) -> None:
        self.tree = tree
        self.total_files = total_files
        self.languages = languages
        self.warnings = warnings
        self.signals = signals

    @property
    def all_warnings(self) -> list[str]:
        """Signals rendered as warnings, per the API contract."""
        return self.signals + self.warnings


def _is_allowed_file(path: Path, settings: Settings) -> bool:
    """Eligibility for appearing in the tree at all."""
    if is_ignored_file(path.name):
        return False
    if is_binary_extension(path.name):
        return False
    try:
        if path.is_symlink() or not path.is_file():
            return False
        if path.stat().st_size > settings.MAX_FILE_BYTES:
            return False
    except OSError:
        return False
    return True


def scan_repository(repo_root: Path, settings: Settings) -> ScanResult:
    """Walk repo_root and build the tree, language stats, and warnings."""
    warnings_counter: Counter[str] = Counter()
    languages: Counter[str] = Counter()
    signals: set[str] = set()
    total_files = 0
    truncated = False

    def walk(directory: Path, depth: int) -> list[TreeNode]:
        nonlocal total_files, truncated
        if depth > settings.MAX_TREE_DEPTH:
            warnings_counter["directories beyond max depth skipped"] += 1
            return []
        try:
            entries = sorted(directory.iterdir(), key=lambda p: p.name.lower())
        except (OSError, PermissionError):
            warnings_counter["unreadable directories skipped"] += 1
            return []

        directories: list[DirectoryNode] = []
        files: list[FileNode] = []

        for entry in entries:
            name = entry.name
            try:
                if entry.is_symlink():
                    warnings_counter["symlinks skipped"] += 1
                    continue
                if entry.is_dir():
                    if is_ignored_directory(name):
                        warnings_counter["ignored directories skipped"] += 1
                        continue
                    if total_files + len(files) + len(directories) >= settings.MAX_SCAN_FILES:
                        truncated = True
                        continue
                    children = walk(entry, depth + 1)
                    directories.append(
                        DirectoryNode(
                            name=name,
                            path=entry.relative_to(repo_root).as_posix(),
                            children=children,
                        )
                    )
                    continue
                if entry.is_file():
                    if name.lower() in _PROJECT_SIGNAL_FILES:
                        signals.add(SIGNAL_LABELS.get(name.lower(), name))
                    if total_files >= settings.MAX_SCAN_FILES:
                        truncated = True
                        continue
                    if not _is_allowed_file(entry, settings):
                        warnings_counter["files skipped (ignored, binary, or too large)"] += 1
                        continue
                    total_files += 1
                    languages[detect_language(name)] += 1
                    files.append(
                        FileNode(
                            name=name,
                            path=entry.relative_to(repo_root).as_posix(),
                            extension=_extension_of(name),
                            language=detect_language(name),
                            size_bytes=entry.stat().st_size,
                        )
                    )
            except OSError:
                warnings_counter["unreadable entries skipped"] += 1
                continue

        # Directories before files, alphabetical case-insensitive.
        directories.sort(key=lambda d: d.name.lower())
        files.sort(key=lambda f: f.name.lower())
        return [*directories, *files]

    tree = walk(repo_root, 1)

    warnings: list[str] = [
        f"{count} {reason}" for reason, count in sorted(warnings_counter.items())
    ]
    if truncated:
        warnings.append(
            f"scan truncated at the {settings.MAX_SCAN_FILES}-file limit; tree may be incomplete"
        )

    return ScanResult(
        tree=tree,
        total_files=total_files,
        languages=dict(languages),
        warnings=warnings,
        signals=sorted(signals),
    )


def _extension_of(name: str) -> str:
    dot = name.rfind(".")
    if dot <= 0:
        return ""
    return name[dot:].lower()
