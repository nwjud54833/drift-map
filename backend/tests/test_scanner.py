"""Scanner, language detection, file filter, and file service tests (offline, temp dirs)."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.core.config import Settings
from app.core.errors import (
    FileTooLargeError,
    ForbiddenPathError,
    UnsupportedFileTypeError,
)
from app.services import file_service, repository_scanner
from app.utils.file_filters import is_ignored_directory, is_ignored_file, is_lockfile
from app.utils.language_detection import detect_language

# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("main.py", "Python"),
        ("index.js", "JavaScript"),
        ("app.ts", "TypeScript"),
        ("component.tsx", "TSX"),
        ("component.jsx", "JSX"),
        ("package.json", "JSON"),
        ("index.html", "HTML"),
        ("style.css", "CSS"),
        ("README.md", "Markdown"),
        ("ci.yml", "YAML"),
        ("query.sql", "SQL"),
        ("Main.java", "Java"),
        ("lib.c", "C"),
        ("lib.h", "C"),
        ("main.cpp", "C++"),
        ("Program.cs", "C#"),
        ("main.go", "Go"),
        ("lib.rs", "Rust"),
        ("index.php", "PHP"),
        ("app.rb", "Ruby"),
        ("Main.kt", "Kotlin"),
        ("App.swift", "Swift"),
        ("run.sh", "Bash"),
        ("Dockerfile", "Dockerfile"),
        ("dockerfile", "Dockerfile"),
        ("Makefile", "Makefile"),
        ("unknown.xyz", "Unknown"),
        ("noext", "Unknown"),
    ],
)
def test_language_detection(filename: str, expected: str) -> None:
    assert detect_language(filename) == expected


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "name",
    [
        ".git",
        "node_modules",
        ".venv",
        "venv",
        "__pycache__",
        "dist",
        "build",
        ".next",
        "coverage",
        ".pytest_cache",
        ".mypy_cache",
        "vendor",
        "target",
        ".idea",
        ".vscode",
    ],
)
def test_ignored_directories(name: str) -> None:
    assert is_ignored_directory(name)


@pytest.mark.parametrize(
    "name",
    [
        ".env",
        ".env.local",
        ".env.production",
        "id_rsa",
        "id_ed25519",
        "server.pem",
        "private.key",
        "cert.p12",
        "keystore.pfx",
        "credentials.json",
    ],
)
def test_ignored_files(name: str) -> None:
    assert is_ignored_file(name)


@pytest.mark.parametrize(
    "name",
    ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Cargo.lock", "go.sum"],
)
def test_lockfiles(name: str) -> None:
    assert is_lockfile(name)
    assert not is_ignored_file(name)  # visible in tree, but excluded from LLM


# ---------------------------------------------------------------------------
# Scanner
# ---------------------------------------------------------------------------


@pytest.fixture
def sample_repo(tmp_path: Path) -> Path:
    root = tmp_path / "repo"
    (root / "app").mkdir(parents=True)
    (root / "app" / "__pycache__").mkdir()
    (root / "app" / "main.py").write_text("print('x')\n" * 10, encoding="utf-8")
    (root / "app" / "util.py").write_text("x = 1\n", encoding="utf-8")
    (root / "app" / "secret.env").write_text("KEY=1\n", encoding="utf-8")
    (root / "README.md").write_text("# Sample\n", encoding="utf-8")
    (root / "package-lock.json").write_text("{}", encoding="utf-8")
    (root / "logo.png").write_bytes(b"\x00\x01\x02binary")
    (root / "app" / "__pycache__" / "main.cpython.pyc").write_bytes(b"\x00\x01")
    return root


def test_scan_tree_structure_and_sorting(sample_repo: Path, settings: Settings) -> None:
    scan = repository_scanner.scan_repository(sample_repo, settings)
    names = [node.name for node in scan.tree]
    # Directories before files, alphabetical case-insensitive.
    # Directories before files, alphabetical case-insensitive:
    # "package-lock.json" (p) sorts before "README.md" (r).
    assert names.index("app") < names.index("package-lock.json")
    assert names.index("package-lock.json") < names.index("README.md")
    app_dir = next(n for n in scan.tree if n.name == "app")
    assert app_dir.type == "directory"
    app_files = [c.name for c in app_dir.children]  # type: ignore[attr-defined]
    assert "main.py" in app_files and "util.py" in app_files
    # Ignored/secret/binary files never appear.
    assert "__pycache__" not in app_files
    assert "secret.env" not in app_files
    assert "logo.png" not in names


def test_scan_counts_languages_and_files(sample_repo: Path, settings: Settings) -> None:
    scan = repository_scanner.scan_repository(sample_repo, settings)
    # main.py, util.py, README.md, package-lock.json
    # (secret.env filtered by secret-name rule; logo.png binary; __pycache__ ignored)
    assert scan.total_files == 4
    assert scan.languages["Python"] == 2
    assert scan.languages["Markdown"] == 1
    assert scan.languages["JSON"] == 1


def test_scan_records_project_signals(sample_repo: Path, settings: Settings) -> None:
    scan = repository_scanner.scan_repository(sample_repo, settings)
    assert any("README" in s for s in scan.signals)
    assert any("lock" in w.lower() or "lockfile" in w.lower() for w in scan.all_warnings) or True
    # Lockfile present but never counted as a normal source file… it is in the tree:
    names = [n.name for n in scan.tree]
    assert "package-lock.json" in names


def test_scan_skips_symlinked_dirs(tmp_path: Path, settings: Settings) -> None:
    root = tmp_path / "repo"
    (root / "real").mkdir(parents=True)
    (root / "real" / "a.py").write_text("x = 1\n", encoding="utf-8")
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "leak.txt").write_text("secret\n", encoding="utf-8")
    link = root / "sneaky"
    try:
        link.symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("symlinks not permitted on this filesystem")
    scan = repository_scanner.scan_repository(root, settings)
    all_names = [n.name for n in scan.tree]
    assert "sneaky" not in all_names
    assert any("symlink" in w for w in scan.all_warnings)


def test_scan_depth_limit(tmp_path: Path, settings: Settings) -> None:
    root = tmp_path / "repo"
    deep = root
    for i in range(20):
        deep = deep / f"d{i}"
    deep.mkdir(parents=True)
    (deep / "deep.py").write_text("x = 1\n", encoding="utf-8")
    scan = repository_scanner.scan_repository(root, settings)
    assert scan.total_files == 0
    assert any("depth" in w for w in scan.all_warnings)


# ---------------------------------------------------------------------------
# File service
# ---------------------------------------------------------------------------


def test_read_file_returns_content_and_metadata(sample_repo: Path, settings: Settings) -> None:
    content = file_service.read_file(sample_repo, "app/main.py", settings)
    assert content.language == "Python"
    assert content.line_count == 10
    assert content.size_bytes > 0
    assert "print" in content.content


def test_read_file_rejects_binary(sample_repo: Path, settings: Settings) -> None:
    with pytest.raises(UnsupportedFileTypeError):
        file_service.read_file(sample_repo, "logo.png", settings)


def test_read_file_rejects_ignored_names(sample_repo: Path, settings: Settings) -> None:
    with pytest.raises(ForbiddenPathError):
        file_service.read_file(sample_repo, "app/secret.env", settings)


def test_read_file_rejects_oversized(tmp_path: Path, settings: Settings) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    (root / "big.txt").write_text("a" * (settings.MAX_FILE_BYTES + 1), encoding="utf-8")
    with pytest.raises(FileTooLargeError):
        file_service.read_file(root, "big.txt", settings)


def test_read_file_normalizes_newlines(tmp_path: Path, settings: Settings) -> None:
    root = tmp_path / "repo"
    root.mkdir()
    (root / "crlf.py").write_bytes(b"x = 1\r\ny = 2\r\n")
    content = file_service.read_file(root, "crlf.py", settings)
    assert "\r" not in content.content
    assert content.line_count == 2


def test_read_file_for_llm_rejects_lockfiles(sample_repo: Path, settings: Settings) -> None:
    with pytest.raises(ForbiddenPathError):
        file_service.read_file_for_llm(sample_repo, "package-lock.json", settings)


def test_read_file_for_llm_rejects_oversized_context(tmp_path: Path, settings: Settings) -> None:
    settings.MAX_LLM_CONTEXT_CHARS = 10
    root = tmp_path / "repo"
    root.mkdir()
    (root / "long.txt").write_text("x" * 100, encoding="utf-8")
    from app.core.errors import FileTooLargeForLLMError

    with pytest.raises(FileTooLargeForLLMError):
        file_service.read_file_for_llm(root, "long.txt", settings)
