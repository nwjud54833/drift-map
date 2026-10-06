# Architecture — Advanced Edition

Extends the V1 architecture (see git history for the original single-snapshot design).

## Component map

```
Browser (Next.js :3000, TanStack Query)
  |  JSON + SSE
  v
FastAPI API (:8000)  ── owns trust boundaries, validation, approvals
  |                         |
  v                         v
Service layer            Celery worker (Redis broker)
  |  git / scanner / parser / retrieval / llm / patches    ingestion & indexing jobs
  v
PostgreSQL (metadata, runs, patches, approvals)   Chroma (vectors)   workspace/ (clones)
  |
  v
Runner service (separate process/container; the only component that may touch Docker)
  └─ executes APPROVED test jobs in locked-down containers. Disabled by default.
```

## Layers (backend)

| Package | Responsibility |
| --- | --- |
| `app/api/` | Thin routes: parse/validate/delegate. No business logic. |
| `app/core/` | Settings, errors, security (URL + path), logging with redaction. |
| `app/db/` | SQLAlchemy engine, `Base`, models; Alembic migrations in `migrations/`. |
| `app/models/` (pydantic) | Request/response schemas at the boundary. |
| `app/services/` | Git, scanning, file reading, LLM chat (V1, preserved). |
| `app/ingestion/`, `app/parsing/`, `app/retrieval/`, `app/agents/`, `app/patches/`, `app/sandbox/`, `app/github/`, `app/jobs/`, `app/events/` | Added per phase, each behind a small interface so adapters can be mocked in tests. |

## Trust boundaries

1. **Browser → API**: untrusted. CORS restricted; every ID/path/URL re-validated.
2. **Repository content**: untrusted data, never executed. Filtered before tree/LLM.
3. **LLM provider**: receives labeled context only; output is schema-validated and
   clamped; never drives execution.
4. **Runner ↔ Docker**: only the runner may create containers; the web backend cannot
   submit arbitrary Docker options. Sandbox disabled until explicitly configured.

## Data flow (Phase 1)

- `GET /health` checks Postgres (`SELECT 1` via SQLAlchemy) and Redis (`PING`) and
  reports component status; never crashes when either is absent.
- Repositories/snapshots rows are created by later phases; the schema is established now.

## Concurrency model (planned)

- Ingestion/indexing: idempotent Celery tasks with durable status rows; cancellation flags.
- Runs on one snapshot: serialized per snapshot via DB state; stale-state errors.
- Reindex during chat: chat pins to an explicit snapshot/index version.

## SSE events (planned)

Per-run monotonic event IDs, heartbeat, bounded retention, `Last-Event-ID` resume.
