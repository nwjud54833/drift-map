"""Pydantic models for repository endpoints (requests, tree nodes, responses)."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator

# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------


class CloneRequest(BaseModel):
    """POST /api/repositories/clone request body."""

    repo_url: str = Field(min_length=1, max_length=2048, description="Public GitHub HTTPS URL")
    branch: str | None = Field(
        default=None,
        min_length=1,
        max_length=200,
        pattern=r"^[A-Za-z0-9._/\-]+$",
        description="Optional branch/tag to clone",
    )

    @field_validator("repo_url")
    @classmethod
    def _strip_url(cls, value: str) -> str:
        return value.strip()


# ---------------------------------------------------------------------------
# File tree
# ---------------------------------------------------------------------------


class FileNode(BaseModel):
    """A file leaf in the repository tree."""

    name: str
    path: str
    type: str = "file"  # literal "file"
    extension: str
    language: str
    size_bytes: int


class DirectoryNode(BaseModel):
    """A directory node in the repository tree; children are sorted dirs-first."""

    name: str
    path: str
    type: str = "directory"  # literal "directory"
    children: list[FileNode | DirectoryNode]


TreeNode = FileNode | DirectoryNode


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------


class RepositoryResponse(BaseModel):
    """Response for clone and tree endpoints."""

    repo_id: str
    repo_name: str
    repo_url: str
    default_branch: str | None = None
    total_files: int
    detected_languages: dict[str, int]
    file_tree: list[TreeNode]
    warnings: list[str] = Field(default_factory=list)


class FileContentResponse(BaseModel):
    """Response for GET /api/repositories/{repo_id}/file."""

    repo_id: str
    path: str
    language: str
    content: str
    line_count: int
    size_bytes: int
