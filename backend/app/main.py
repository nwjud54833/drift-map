"""FastAPI application entrypoint.

Run with: uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_chat, routes_health, routes_repositories
from app.core.config import APP_VERSION, SERVICE_NAME, get_settings
from app.core.errors import install_error_handlers
from app.core.logging_config import configure_logging

configure_logging()
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    """Build the FastAPI app with CORS, error handlers, and routes."""
    settings = get_settings()

    app = FastAPI(
        title=SERVICE_NAME,
        version=APP_VERSION,
        description="Read-only GitHub repository explorer with file-grounded AI chat.",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # CORS: only the configured local dev origins (frontend) by default.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

    install_error_handlers(app)

    app.include_router(routes_health.router)
    app.include_router(routes_repositories.router)
    app.include_router(routes_chat.router)

    logger.info(
        "%s v%s ready (LLM configured: %s)", SERVICE_NAME, APP_VERSION, settings.llm_configured
    )
    return app


app = create_app()
