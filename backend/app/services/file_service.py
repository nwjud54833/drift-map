"""Safe, read-only file access for cloned repositories.

Every read goes through resolve_safe_file_path, then eligibility filters
(ignored/secret names, binary detection, size cap), then UTF-8 decoding with a
safe fallback. No absolute paths are ever returned to the client.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from app.core.config import Settings
from app.core.errors import (
    FileTooLargeError,
    FileTooLargeForLLMError,
    ForbiddenPathError,
    PathNotFoundError,
    UnsupportedFileTypeError,
)
from app.core.security import resolve_safe_file_path
from app.utils.file_filters import is_binary_extension, is_ignored_file, is_lockfile
from app.utils.language_detection import detect_language

logger = logging.getLogger(__name__)

# How many raw bytes to sniff for binary detection.
_SNIFF_BYTES = 8192


class FileContent:
    """Decoded, display-ready file content."""

    def __init__(self, path: str, language: str, content: str, size_bytes: int) -> None:
        self.path = path
        self.language = language
        self.content = content
        self.size_bytes = size_bytes

    @property
    def line_count(self) -> int:
        return len(self.content.splitlines())


def read_file(repo_root: Path, relative_path: str, settings: Settings) -> FileContent:
    """Read one allowed text file from a cloned repository."""
    resolved = resolve_safe_file_path(repo_root, relative_path)

    if not resolved.exists() or not resolved.is_file():
        raise PathNotFoundError()
    # Re-verify containment after resolution (guards against fs races).
    root = repo_root.resolve()
    root_str = str(root)
    if not str(resolved).startswith(root_str + os.sep) and resolved != root:
        raise ForbiddenPathError()

    size = resolved.stat().st_size
    if size > settings.MAX_FILE_BYTES:
        raise FileTooLargeError()
    if is_ignored_file(resolved.name):
        raise ForbiddenPathError()
    if is_binary_extension(resolved.name):
        raise UnsupportedFileTypeError()

    raw = resolved.read_bytes()
    if _looks_binary(raw):
        raise UnsupportedFileTypeError()

    text = _decode(raw).replace("\r\n", "\n").replace("\r", "\n")
    return FileContent(
        path=relative_path.strip(),
        language=detect_language(resolved.name),
        content=text,
        size_bytes=size,
    )


def read_file_for_llm(repo_root: Path, relative_path: str, settings: Settings) -> FileContent:
    """Like read_file but also enforces lockfile exclusion and LLM context cap."""
    content = read_file(repo_root, relative_path, settings)
    if is_lockfile(Path(content.path).name):
        raise ForbiddenPathError("Lockfiles are not sent to the AI.")
    if len(content.content) > settings.MAX_LLM_CONTEXT_CHARS:
        raise FileTooLargeForLLMError()
    return content


def _looks_binary(data: bytes) -> bool:
    """Null-byte check plus a conservative control-character heuristic."""
    if not data:
        return False
    if b"\x00" in data[:_SNIFF_BYTES]:
        return True
    sample = data[:_SNIFF_BYTES]
    # Treat >10% odd control chars (excluding \t \n \r \f \v \b) as binary.
    control = sum(1 for b in sample if b < 9 or (13 < b < 27) or (27 < b < 32))
    return control / len(sample) > 0.10


def _decode(data: bytes) -> str:
    """UTF-8 first; fall back to utf-8 with replacement for display only."""
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("utf-8", errors="replace")
