"""Pydantic models for the file-aware chat endpoint."""

from __future__ import annotations

from pydantic import BaseModel, Field, field_validator


class ChatRequest(BaseModel):
    """POST /api/chat request body."""

    repo_id: str = Field(min_length=36, max_length=36)
    file_path: str = Field(min_length=1, max_length=1024)
    question: str = Field(min_length=1, max_length=2000)

    @field_validator("repo_id", "file_path", "question", mode="before")
    @classmethod
    def _strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


class Citation(BaseModel):
    """A line range in the selected file that supports the answer."""

    path: str
    line_start: int = Field(ge=1)
    line_end: int = Field(ge=1)


class ChatResponse(BaseModel):
    """POST /api/chat response body."""

    answer: str
    citations: list[Citation]
    model: str
