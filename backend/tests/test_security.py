"""Security tests: GitHub URL validation and filesystem path safety."""

from __future__ import annotations

import uuid
from pathlib import Path

import pytest

from app.core.errors import ForbiddenPathError, InvalidUrlError
from app.core.security import (
    resolve_safe_file_path,
    validate_github_repo_url,
    validate_repo_id,
)

VALID = [
    ("https://github.com/owner/repo", "owner", "repo"),
    ("https://github.com/owner/repo/", "owner", "repo"),
    ("https://github.com/owner/repo.git", "owner", "repo"),
    ("https://github.com/Owner/Repo/", "Owner", "Repo"),
]

INVALID = [
    "http://github.com/owner/repo",
    "git://github.com/owner/repo.git",
    "git@github.com:owner/repo.git",
    "ssh://git@github.com/owner/repo.git",
    "file:///etc/passwd",
    "https://gitlab.com/owner/repo",
    "https://github.com.evil.com/owner/repo",
    "https://127.0.0.1/owner/repo",
    "https://github.com:443/owner/repo",
    "https://user:pass@github.com/owner/repo",
    "https://github.com/owner/repo?foo=bar",
    "https://github.com/owner/repo#readme",
    "https://github.com/owner",
    "https://github.com/owner/repo/tree/main",
    "https://github.com/settings/profile",
    "https://github.com//owner/repo",
    "not a url",
    "",
    "   ",
]


@pytest.mark.parametrize(("raw", "owner", "repo"), VALID)
def test_valid_urls_normalize(raw: str, owner: str, repo: str) -> None:
    result = validate_github_repo_url(raw)
    assert result.owner == owner
    assert result.repo == repo
    assert result.url == f"https://github.com/{owner}/{repo}"


@pytest.mark.parametrize("raw", INVALID)
def test_invalid_urls_rejected(raw: str) -> None:
    with pytest.raises(InvalidUrlError):
        validate_github_repo_url(raw)


def test_repo_id_must_be_uuid() -> None:
    with pytest.raises(ForbiddenPathError):
        validate_repo_id("../evil")
    with pytest.raises(ForbiddenPathError):
        validate_repo_id("12345")
    parsed = validate_repo_id(str(uuid.uuid4()))
    assert parsed.version == 4


# ---------------------------------------------------------------------------
# Path safety
# ---------------------------------------------------------------------------


@pytest.fixture
def repo_root(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "src").mkdir(parents=True)
    (root / "src" / "main.py").write_text("print('hi')\n")
    (root / "README.md").write_text("# hi\n")
    return root


@pytest.mark.parametrize(
    "bad",
    [
        "../secret.txt",
        "src/../../secret.txt",
        "..\\secret.txt",
        "/etc/passwd",
        "~/secrets",
        "C:/Windows/win.ini",
        "src/../../../x",
        "a/b/../../../c",
        "src\x00/main.py",
    ],
)
def test_traversal_and_absolute_paths_blocked(repo_root: Path, bad: str) -> None:
    with pytest.raises(ForbiddenPathError):
        resolve_safe_file_path(repo_root, bad)


def test_valid_relative_path_resolves_inside(repo_root: Path) -> None:
    resolved = resolve_safe_file_path(repo_root, "src/main.py")
    assert resolved.is_file()
    assert (
        repo_root.resolve() in resolved.resolve().parents
        or resolved.resolve().parent == (repo_root / "src").resolve()
    )


def test_nested_dotdot_that_stays_inside_is_blocked(repo_root: Path) -> None:
    # Even a traversal that happens to land inside the repo is disallowed by rule.
    with pytest.raises(ForbiddenPathError):
        resolve_safe_file_path(repo_root, "src/../README.md")


def test_missing_file_is_not_a_security_error(repo_root: Path) -> None:
    resolved = resolve_safe_file_path(repo_root, "src/does_not_exist.py")
    assert not resolved.exists()
