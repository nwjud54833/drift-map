"""SQLAlchemy declarative base, mixins, and Phase 1 tables."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Integer, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def utcnow() -> datetime:
    """Timezone-naive UTC now (stored uniformly; SQLite/Postgres compatible)."""
    return datetime.utcnow()


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


class TimestampMixin:
    """created_at/updated_at handled by the database for consistency."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class RepositoryRow(Base, TimestampMixin):
    """A repository ingested into the system (Phase 2 populates the workflow)."""

    __tablename__ = "repositories"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)  # uuid4 hex-dash
    canonical_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    owner: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    default_branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    ingestion_status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    index_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)


class SnapshotRow(Base, TimestampMixin):
    """An immutable snapshot of a repository at a commit (index pinning target)."""

    __tablename__ = "snapshots"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    repository_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    commit_sha: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    branch: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    eligible_file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
