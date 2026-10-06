"""Filename and directory filtering rules used by the scanner and file service.

A path that matches any of these rules is never scanned, listed, served, or sent
to the LLM.
"""

from __future__ import annotations

import fnmatch

# Directory names always skipped during scan (name match, at any depth).
IGNORED_DIRECTORIES: set[str] = {
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
}

# File names (case-insensitive) always skipped.
IGNORED_FILENAMES: set[str] = {
    ".env",
    ".ds_store",
    "thumbs.db",
    "desktop.ini",
    ".npmrc",
    ".pypirc",
    "id_rsa",
    "id_dsa",
    "id_ecdsa",
    "id_ed25519",
    "credentials",
    "credentials.json",
    ".netrc",
    ".htpasswd",
}

# fnmatch-style patterns (case-insensitive) always skipped.
IGNORED_FILE_PATTERNS: tuple[str, ...] = (
    ".env.*",  # .env.local, .env.production ...
    "*.env",  # secret-like: secret.env, prod.env ...
    "*.pem",
    "*.key",
    "*.p12",
    "*.pfx",
    "*.jks",
    "*.keystore",
    "*.crt",
    "*.der",
    "*.tfstate",
    "*.tfvars",
    "*.secrets.*",
    "*.secret.*",
    "*.min.js",  # generated bundles
    "*.min.css",
)

# Known lockfiles: visible in the tree, but never sent to the LLM.
LOCKFILE_NAMES: set[str] = {
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "poetry.lock",
    "Pipfile.lock",
    "composer.lock",
    "Gemfile.lock",
    "Cargo.lock",
    "go.sum",
    "uv.lock",
    "bun.lockb",
}

# Binary-ish extensions that should never be opened as text.
BINARY_EXTENSIONS: set[str] = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".ico",
    ".tiff",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".tgz",
    ".bz2",
    ".xz",
    ".7z",
    ".rar",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".o",
    ".a",
    ".obj",
    ".lib",
    ".woff",
    ".woff2",
    ".ttf",
    ".otf",
    ".eot",
    ".mp3",
    ".mp4",
    ".avi",
    ".mov",
    ".mkv",
    ".wav",
    ".flac",
    ".ogg",
    ".sqlite",
    ".db",
    ".pdb",
    ".class",
    ".jar",
    ".pyc",
    ".pyo",
    ".wasm",
    ".onnx",
    ".pt",
    ".pth",
    ".safetensors",
    ".parquet",
    ".arrow",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".psd",
    ".ai",
    ".sketch",
    ".fig",
}


def is_ignored_directory(name: str) -> bool:
    """True when a directory must never be entered during scan."""
    return name in IGNORED_DIRECTORIES


def _matches_any(name_lower: str, patterns: tuple[str, ...]) -> bool:
    return any(fnmatch.fnmatch(name_lower, pat) for pat in patterns)


def is_ignored_file(name: str) -> bool:
    """True when a file must never appear in the tree or be served."""
    lower = name.lower()
    if lower in IGNORED_FILENAMES:
        return True
    return _matches_any(lower, IGNORED_FILE_PATTERNS)


def is_lockfile(name: str) -> bool:
    """True for known lockfiles (tree-visible, LLM-excluded)."""
    return name in LOCKFILE_NAMES


def is_binary_extension(name: str) -> bool:
    """True when the file extension is a known binary format."""
    dot = name.rfind(".")
    if dot < 0:
        return False
    return name[dot:].lower() in BINARY_EXTENSIONS
