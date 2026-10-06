"""Language detection by file extension and special filenames."""

from __future__ import annotations

EXTENSION_TO_LANGUAGE: dict[str, str] = {
    ".py": "Python",
    ".js": "JavaScript",
    ".mjs": "JavaScript",
    ".cjs": "JavaScript",
    ".ts": "TypeScript",
    ".tsx": "TSX",
    ".jsx": "JSX",
    ".json": "JSON",
    ".jsonc": "JSON",
    ".html": "HTML",
    ".htm": "HTML",
    ".css": "CSS",
    ".scss": "SCSS",
    ".sass": "Sass",
    ".md": "Markdown",
    ".markdown": "Markdown",
    ".mdx": "Markdown",
    ".yml": "YAML",
    ".yaml": "YAML",
    ".toml": "TOML",
    ".sql": "SQL",
    ".java": "Java",
    ".c": "C",
    ".h": "C",
    ".cpp": "C++",
    ".cc": "C++",
    ".cxx": "C++",
    ".hpp": "C++",
    ".hh": "C++",
    ".cs": "C#",
    ".go": "Go",
    ".rs": "Rust",
    ".php": "PHP",
    ".rb": "Ruby",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".swift": "Swift",
    ".sh": "Bash",
    ".bash": "Bash",
    ".zsh": "Bash",
    ".ps1": "PowerShell",
    ".xml": "XML",
    ".ini": "INI",
    ".cfg": "INI",
    ".txt": "Text",
    ".graphql": "GraphQL",
    ".proto": "Protocol Buffers",
    ".vue": "Vue",
    ".lua": "Lua",
    ".pl": "Perl",
    ".r": "R",
}

# Special filenames recognized without extensions (checked case-insensitively).
SPECIAL_FILENAMES: dict[str, str] = {
    "dockerfile": "Dockerfile",
    "makefile": "Makefile",
    "rakefile": "Ruby",
    "gemfile": "Ruby",
    "justfile": "Justfile",
    "vagrantfile": "Ruby",
    "cmakelists.txt": "CMake",
}

_UNKNOWN = "Unknown"


def detect_language(filename: str) -> str:
    """Return the language name for a filename, or 'Unknown'."""
    name = filename.lower()
    if name in SPECIAL_FILENAMES:
        return SPECIAL_FILENAMES[name]
    dot = filename.rfind(".")
    if dot <= 0:  # no dot, or dotfile with no further extension
        return _UNKNOWN
    return EXTENSION_TO_LANGUAGE.get(filename[dot:].lower(), _UNKNOWN)
