"""Application error types and the consistent JSON error object.

Error shape returned to clients:

    { "detail": { "code": "ERROR_CODE", "message": "Human readable explanation" } }
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base class for all expected application errors."""

    status_code: int = 500
    code: str = "INTERNAL_ERROR"
    message: str = "An unexpected internal error occurred."

    def __init__(self, message: str | None = None) -> None:
        super().__init__(message or self.message)
        if message:
            self.message = message

    def to_detail(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message}


class ValidationError(AppError):
    status_code = 422
    code = "INVALID_REQUEST"
    message = "Invalid request data."


class InvalidUrlError(AppError):
    status_code = 422
    code = "INVALID_REPO_URL"
    message = "Only public https://github.com/owner/repository URLs are supported."


class RepoNotFoundError(AppError):
    status_code = 404
    code = "REPOSITORY_NOT_FOUND"
    message = "Repository not found. It may have been removed or never cloned."


class PathNotFoundError(AppError):
    status_code = 404
    code = "FILE_NOT_FOUND"
    message = "File not found in this repository."


class ForbiddenPathError(AppError):
    status_code = 403
    code = "FORBIDDEN_PATH"
    message = "Access to this path is not allowed."


class UnsupportedFileTypeError(AppError):
    status_code = 415
    code = "UNSUPPORTED_FILE_TYPE"
    message = "This file type cannot be displayed."


class FileTooLargeError(AppError):
    status_code = 413
    code = "FILE_TOO_LARGE"
    message = "File exceeds the maximum supported size."


class FileTooLargeForLLMError(AppError):
    status_code = 413
    code = "FILE_TOO_LARGE_FOR_AI"
    message = "The selected file exceeds the supported AI context size."


class LlmNotConfiguredError(AppError):
    status_code = 503
    code = "LLM_NOT_CONFIGURED"
    message = (
        "LLM is not configured. Set LLM_API_KEY (and optionally "
        "LLM_BASE_URL / LLM_MODEL) in backend/.env. Legacy OPENAI_* names are also supported."
    )


class LlmRateLimitError(AppError):
    status_code = 503
    code = "LLM_RATE_LIMITED"
    message = (
        "The selected AI model is temporarily rate-limited by the provider. "
        "Try again later, choose another model, or configure a provider key."
    )


class LlmUpstreamError(AppError):
    status_code = 502
    code = "LLM_UPSTREAM_ERROR"
    message = "The AI provider returned an error. Please try again."


class CloneFailedError(AppError):
    status_code = 502
    code = "CLONE_FAILED"
    message = "Failed to clone the repository. Check the URL and that the repository is public."


class TimeoutError(AppError):
    status_code = 504
    code = "CLONE_TIMEOUT"
    message = "Cloning timed out. Try again or pick a smaller repository."


def install_error_handlers(app: Any) -> None:
    """Register consistent JSON error responses on the FastAPI app."""

    from fastapi import Request
    from fastapi.exceptions import RequestValidationError
    from fastapi.responses import JSONResponse

    @app.exception_handler(AppError)
    async def _handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.to_detail()})

    @app.exception_handler(RequestValidationError)
    async def _handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        """Normalize request validation failures to the app error shape."""
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(str(loc) for loc in first.get("loc", []) if loc != "body")
        message = str(first.get("msg", "Invalid request data."))
        if field:
            message = f"{field}: {message}"
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": "INVALID_REQUEST",
                    "message": message,
                }
            },
        )

    @app.exception_handler(Exception)
    async def _handle_unexpected(_: Request, exc: Exception) -> JSONResponse:
        # No stack traces or internals to the client; full detail stays in server logs.
        logger.exception("Unhandled error: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content={
                "detail": {
                    "code": "INTERNAL_ERROR",
                    "message": "An unexpected internal error occurred.",
                }
            },
        )
