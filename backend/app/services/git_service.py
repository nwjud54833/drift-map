"""Git cloning service.

Safety properties:
- The URL has already been validated/normalized by app.core.security.
- Only GitPython APIs are used; no shell, no shell=True, no string commands.
- Shallow clone (--depth 1) to limit work; credential prompts disabled.
- The cloned repo's .git directory is removed after a successful clone: this app
  is read-only and never needs git metadata again.
- Any failure cleans up the partial workspace directory.
"""

from __future__ import annotations

import logging
import os
import shutil
import threading
import uuid
from pathlib import Path

import git

from app.core.config import Settings
from app.core.errors import CloneFailedError, RepoNotFoundError, TimeoutError
from app.core.paths import WORKSPACES_DIR
from app.core.security import GitHubRepoUrl, workspace_repo_root

logger = logging.getLogger(__name__)


class CloneResult:
    """Outcome of a successful clone."""

    def __init__(self, repo_id: str, repo_root: Path, default_branch: str | None) -> None:
        self.repo_id = repo_id
        self.repo_root = repo_root
        self.default_branch = default_branch


def clone_repository(
    validated_url: GitHubRepoUrl,
    branch: str | None,
    settings: Settings,
) -> CloneResult:
    """Clone a validated public GitHub URL into workspace/<uuid>/repo."""
    repo_id = str(uuid.uuid4())
    workspace_dir = WORKSPACES_DIR / repo_id
    repo_root = workspace_repo_root(WORKSPACES_DIR, repo_id)

    workspace_dir.mkdir(parents=True, exist_ok=True)

    # Keep git from prompting for credentials (would hang the request).
    clone_env = dict(os.environ)
    clone_env["GIT_TERMINAL_PROMPT"] = "0"
    clone_env["GIT_ASKPASS"] = "echo"
    clone_env["GIT_CONFIG_NOSYSTEM"] = "1"

    clone_kwargs: dict[str, object] = {
        "depth": 1,
        "single_branch": True,
        "env": clone_env,
    }
    if branch:
        clone_kwargs["branch"] = branch

    # Enforce the timeout with a worker thread: GitPython's kill_after_timeout is
    # not supported on Windows, so we never pass it.
    outcome: dict[str, object] = {}

    def _clone_work() -> None:
        try:
            outcome["repo"] = git.Repo.clone_from(
                validated_url.url,
                str(repo_root),
                **clone_kwargs,  # type: ignore[arg-type]
            )
        except Exception as exc:  # noqa: BLE001 - re-raised in the caller
            outcome["error"] = exc

    worker = threading.Thread(target=_clone_work, daemon=True)
    worker.start()
    worker.join(timeout=float(settings.CLONE_TIMEOUT_SECONDS))

    if worker.is_alive():
        # Best-effort cleanup; the daemon thread dies with the process.
        _cleanup(workspace_dir)
        logger.info("Clone timed out after %ss", settings.CLONE_TIMEOUT_SECONDS)
        raise TimeoutError()

    if "error" in outcome:
        exc = outcome["error"]
        _cleanup(workspace_dir)
        if isinstance(exc, git.exc.GitCommandError):
            stderr = exc.stderr if isinstance(exc.stderr, str) else ""
            lowered = stderr.lower()
            if "not found" in lowered or "does not appear to be a git" in lowered:
                raise CloneFailedError(
                    "Repository not found or not accessible."
                    " Only public repositories are supported."
                ) from exc
            if "authentication failed" in lowered or "could not read from remote" in lowered:
                raise CloneFailedError(
                    "Repository requires authentication. Only public repositories are supported."
                ) from exc
            logger.info("Clone failed for a validated URL: %s", type(exc).__name__)
            raise CloneFailedError() from exc
        logger.info("Clone failed unexpectedly: %s", type(exc).__name__)
        raise CloneFailedError() from exc

    repo = outcome["repo"]
    assert isinstance(repo, git.Repo)  # noqa: S101 - internal invariant
    default_branch: str | None
    try:
        default_branch = repo.active_branch.name
    except (TypeError, ValueError):
        default_branch = branch
    repo.close()

    # Read-only app: drop git metadata after cloning (hooks etc. are never used).
    git_dir = repo_root / ".git"
    if git_dir.exists():
        shutil.rmtree(git_dir, ignore_errors=True)

    logger.info(
        "Cloned repository %s/%s into workspace %s",
        validated_url.owner,
        validated_url.repo,
        repo_id,
    )
    return CloneResult(repo_id=repo_id, repo_root=repo_root, default_branch=default_branch)


def get_repo_root_for(repo_id: str) -> Path:
    """Validated repo root for an existing clone; 404 when missing."""
    repo_root = workspace_repo_root(WORKSPACES_DIR, repo_id)
    if not repo_root.is_dir():
        raise RepoNotFoundError()
    return repo_root


def _cleanup(workspace_dir: Path) -> None:
    """Remove a partial workspace after a failed clone; never raise."""
    try:
        if workspace_dir.exists():
            shutil.rmtree(workspace_dir, ignore_errors=True)
    except OSError:
        logger.info("Cleanup of a partial workspace failed; leaving it for manual removal.")
