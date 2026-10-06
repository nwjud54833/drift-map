"""Security primitives: GitHub URL validation and safe filesystem path resolution.

These helpers are pure functions with no I/O beyond stat/symlink checks so they
can be unit-tested exhaustively. They are the single source of truth for the two
hard security boundaries of this app:

1. Which remote URLs may be cloned.
2. Which local paths may be read.
"""

from __future__ import annotations

import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath

from app.core.errors import ForbiddenPathError, InvalidUrlError

# Exactly owner/repository. GitHub allows alphanumerics and hyphens in names;
# the first path segment must not look like a special page (e.g. "settings", "orgs").
_REPO_PATH_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$")
_RESERVED_SEGMENTS = {
    "settings",
    "orgs",
    "topics",
    "trending",
    "search",
    "new",
    "import",
    "install",
    "marketplace",
    "sponsors",
    "features",
    "pricing",
    "security",
    "enterprise",
    "customer-stories",
    "readme",
    "login",
    "logout",
    "join",
    "explore",
    "notifications",
}


@dataclass(frozen=True)
class GitHubRepoUrl:
    """A normalized, validated public GitHub repository URL."""

    owner: str
    repo: str
    url: str  # canonical form: https://github.com/owner/repository

    @property
    def repo_name(self) -> str:
        return self.repo


def validate_github_repo_url(raw_url: str) -> GitHubRepoUrl:
    """Validate and normalize a public GitHub HTTPS repository URL.

    Accepts optional trailing slash and optional .git suffix. Rejects everything
    else: other schemes, other hosts, credentials, ports, queries, fragments,
    userinfo, IP addresses, multi-segment paths, and reserved page paths.
    """
    if not isinstance(raw_url, str) or not raw_url.strip():
        raise InvalidUrlError("Repository URL is required.")

    candidate = raw_url.strip()
    if "\r" in candidate or "\n" in candidate or "\t" in candidate:
        raise InvalidUrlError("Repository URL contains invalid characters.")

    from urllib.parse import urlsplit

    try:
        parts = urlsplit(candidate)
    except ValueError as exc:
        raise InvalidUrlError("Repository URL could not be parsed.") from exc

    # Scheme: exactly https (rejects git://, http://, ssh:, file:, etc.)
    if parts.scheme.lower() != "https":
        raise InvalidUrlError("Only https:// URLs are supported.")
    # Host: exactly github.com (rejects ssh form git@github.com, IPs, subdomains)
    if (parts.hostname or "").lower() != "github.com":
        raise InvalidUrlError("Only github.com repositories are supported.")
    # Never accept credentials or a non-default port.
    if parts.username is not None or parts.password is not None:
        raise InvalidUrlError("Credentials in the URL are not supported.")
    if parts.port is not None:
        raise InvalidUrlError("Custom ports are not supported.")
    if parts.query:
        raise InvalidUrlError("Query strings are not supported.")
    if parts.fragment:
        raise InvalidUrlError("URL fragments are not supported.")

    # Path: must be exactly owner/repository after normalization.
    # One leading empty segment (from the required leading slash) and one trailing
    # empty segment (optional trailing slash) are tolerated; interior empty
    # segments (duplicate slashes) are rejected.
    raw_path = parts.path or ""
    segments = raw_path.split("/")
    if segments and segments[0] == "":
        segments = segments[1:]
    if segments and segments[-1] == "":
        segments = segments[:-1]
    if not segments or any(seg == "" for seg in segments) or len(segments) != 2:
        raise InvalidUrlError("URL must be exactly github.com/<owner>/<repository>.")

    owner, repo = segments
    if owner.lower() in _RESERVED_SEGMENTS:
        raise InvalidUrlError("That URL does not point to a repository.")
    repo = re.sub(r"\.git$", "", repo, flags=re.IGNORECASE)
    if not _REPO_PATH_RE.match(owner) or not _REPO_PATH_RE.match(repo):
        raise InvalidUrlError("Repository owner or name contains invalid characters.")

    # Rebuild canonically from validated parts only (no user string is re-embedded raw).
    return GitHubRepoUrl(owner=owner, repo=repo, url=f"https://github.com/{owner}/{repo}")


# ---------------------------------------------------------------------------
# Filesystem safety
# ---------------------------------------------------------------------------

_UUID_RE = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)


def validate_repo_id(repo_id: str) -> uuid.UUID:
    """Repo IDs are always UUID4s. Validate before they ever touch a path."""
    if not _UUID_RE.match(repo_id or ""):
        raise ForbiddenPathError("Invalid repository identifier.")
    return uuid.UUID(repo_id)


def workspace_repo_root(workspaces_dir: Path, repo_id: str) -> Path:
    """Return the absolute repo root for a validated repo id, inside the sandbox."""
    parsed = validate_repo_id(repo_id)
    root = (workspaces_dir / str(parsed) / "repo").resolve()
    base = workspaces_dir.resolve()
    if not str(root).startswith(str(base) + os.sep):
        raise ForbiddenPathError("Resolved workspace path escaped the sandbox.")
    return root


def resolve_safe_file_path(repo_root: Path, relative_path: str) -> Path:
    """Resolve a user-supplied relative path strictly within the repository root.

    Raises ForbiddenPathError on traversal, absolute paths, drive letters, UNC
    paths, null bytes, backslash tricks, and symlink escapes. Callers then check
    existence themselves.
    """
    if not isinstance(relative_path, str) or not relative_path.strip():
        raise ForbiddenPathError("A file path is required.")
    if "\x00" in relative_path:
        raise ForbiddenPathError("Invalid path.")

    candidate = relative_path.strip()
    if "\\" in candidate:
        # Windows separators are not valid repo-relative paths; reject outright
        # to avoid any separator-conversion confusion.
        raise ForbiddenPathError("Invalid path separators.")
    if ":" in candidate:
        # Blocks Windows drive paths like "C:/x" and stream syntax like "file:py".
        raise ForbiddenPathError("Invalid path.")
    if candidate.startswith("/") or candidate.startswith("~"):
        raise ForbiddenPathError("Absolute paths are not allowed.")

    # Interpret as POSIX (git) path; reject '.' and '..' components explicitly.
    pure = PurePosixPath(candidate)
    for part in pure.parts:
        if part in (".", ".."):
            raise ForbiddenPathError("Path traversal is not allowed.")

    resolved_root = repo_root.resolve()
    resolved = (resolved_root / pure).resolve()

    # Defense in depth: the resolved path must remain inside the repo root.
    if resolved != resolved_root and not str(resolved).startswith(str(resolved_root) + os.sep):
        raise ForbiddenPathError("Path escapes the repository root.")

    # Symlink escape check: no component of the real path may leave the root.
    if not str(resolved).startswith(str(resolved_root)):
        raise ForbiddenPathError("Path escapes the repository root.")

    # If the target (or an ancestor) is a symlink pointing outside the repo, block it.
    probe = resolved_root
    for part in pure.parts:
        probe = probe / part
        if probe.is_symlink():
            target = probe.resolve()
            if not str(target).startswith(str(resolved_root) + os.sep) and target != resolved_root:
                raise ForbiddenPathError("Symbolic links are not allowed.")
    return resolved


def is_symlink_escape_free(path: Path, repo_root: Path) -> bool:
    """True when path (already resolved) is inside repo_root."""
    root = str(repo_root.resolve())
    try:
        return str(path.resolve()).startswith(root + os.sep)
    except OSError:
        return False
