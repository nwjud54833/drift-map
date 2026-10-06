"""File-aware chat endpoint backed by the LLM service."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.concurrency import run_in_threadpool

from app.core.config import Settings, get_settings
from app.core.errors import RepoNotFoundError
from app.core.security import validate_repo_id
from app.models.chat import ChatRequest, ChatResponse
from app.services import file_service, git_service, llm_service

router = APIRouter(tags=["chat"])


@router.post("/api/chat", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    settings: Annotated[Settings, Depends(get_settings)],
) -> ChatResponse:
    """Answer a question grounded strictly in the selected file, with citations."""
    validate_repo_id(payload.repo_id)
    repo_root = git_service.get_repo_root_for(payload.repo_id)
    if repo_root is None or not repo_root.is_dir():
        raise RepoNotFoundError()

    # File eligibility + LLM context limits (lockfiles rejected, 50k char cap).
    content = await run_in_threadpool(
        file_service.read_file_for_llm, repo_root, payload.file_path, settings
    )
    outcome = await run_in_threadpool(
        llm_service.answer_question, payload.question, content, settings
    )
    return ChatResponse(
        answer=outcome.answer,
        citations=outcome.citations,
        model=outcome.model,
    )
