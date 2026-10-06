"""Repository endpoints: clone, tree, and file content.

Routes are thin: validate -> service call -> response model.
"""

from __future__ import annotations

from datetime import UTC
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.core.errors import RepoNotFoundError
from app.core.security import validate_github_repo_url, validate_repo_id
from app.models.repository import CloneRequest, FileContentResponse, RepositoryResponse
from app.services import file_service, git_service, repository_scanner, workspace_meta

router = APIRouter(prefix="/api/repositories", tags=["repositories"])


def _existing_repo_root(repo_id: str):
    """Validate the UUID repo id and return its repo root; 404 when absent."""
    validate_repo_id(repo_id)
    root = git_service.get_repo_root_for(repo_id)
    if root is None or not root.is_dir():
        raise RepoNotFoundError()
    return root


@router.post("/clone", response_model=RepositoryResponse, status_code=201)
async def clone_repository(
    payload: CloneRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RepositoryResponse:
    """Validate, clone (shallow), and scan a public GitHub repository."""
    validated_url = validate_github_repo_url(payload.repo_url)
    result = await run_in_threadpool(
        git_service.clone_repository, validated_url, payload.branch, settings
    )
    scan = await run_in_threadpool(repository_scanner.scan_repository, result.repo_root, settings)

    workspace_meta.save_meta(
        workspace_meta.WorkspaceMeta(
            repo_id=result.repo_id,
            repo_name=validated_url.repo_name,
            repo_url=validated_url.url,
            default_branch=result.default_branch,
            cloned_at_utc=_utc_now_iso(),
        )
    )

    return RepositoryResponse(
        repo_id=result.repo_id,
        repo_name=validated_url.repo_name,
        repo_url=validated_url.url,
        default_branch=result.default_branch,
        total_files=scan.total_files,
        detected_languages=scan.languages,
        file_tree=scan.tree,
        warnings=scan.all_warnings,
    )


@router.get("/{repo_id}/tree", response_model=RepositoryResponse)
async def get_tree(
    repo_id: str,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RepositoryResponse:
    """Return the file tree and language stats for a previously cloned repository."""
    root = _existing_repo_root(repo_id)
    scan = await run_in_threadpool(repository_scanner.scan_repository, root, settings)
    meta = workspace_meta.load_meta(repo_id)
    if meta is None:
        raise RepoNotFoundError()
    return RepositoryResponse(
        repo_id=repo_id,
        repo_name=meta["repo_name"],
        repo_url=meta["repo_url"],
        default_branch=meta["default_branch"],
        total_files=scan.total_files,
        detected_languages=scan.languages,
        file_tree=scan.tree,
        warnings=scan.all_warnings,
    )


@router.get("/{repo_id}/file", response_model=FileContentResponse)
async def get_file(
    repo_id: str,
    path: Annotated[str, Query(min_length=1, max_length=1024)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileContentResponse:
    """Return display-ready content for one allowed file in the repository."""
    root = _existing_repo_root(repo_id)
    content = await run_in_threadpool(file_service.read_file, root, path, settings)
    return FileContentResponse(
        repo_id=repo_id,
        path=content.path,
        language=content.language,
        content=content.content,
        line_count=content.line_count,
        size_bytes=content.size_bytes,
    )


def _utc_now_iso() -> str:
    from datetime import datetime

    return datetime.now(UTC).isoformat(timespec="seconds")
