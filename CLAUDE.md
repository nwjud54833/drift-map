# CLAUDE.md

## What this project is

**Personal AI Coding Agent (Advanced Edition)** — a local-first, repository-aware coding
assistant: ingest a repository, browse code safely, answer repository-wide questions with
validated citations, investigate bugs, propose reviewable patches, run approved tests in a
restricted sandbox, and optionally publish to GitHub. V1 (single-file read-only chat) is
preserved as a subset. See docs/implementation-plan.md for phase status and
docs/acceptance-criteria.md for per-phase gates.

## Commands

Backend (from `backend/`):
```bash
python -m venv .venv
source .venv/bin/activate            # macOS/Linux
.venv\Scripts\Activate.ps1           # Windows PowerShell
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
pytest
ruff check .
ruff format --check .

# Database (Phase 1+)
alembic upgrade head                  # apply migrations
alembic downgrade base                # reverse all (dev only)
alembic revision --autogenerate -m "..."
```

Optional infra (from repo root): `docker compose up -d` (Postgres :5432, Redis :6379).
Without it: SQLite (backend/local.db) and Redis "disabled" in /health.

Frontend (from `frontend/`):
```bash
npm install
npm run dev       # http://localhost:3000
npm run lint
npm run build
```

## File architecture

- `backend/app/api/` — thin route modules (health, repositories, chat)
- `backend/app/core/` — settings, error types/handlers, URL & filesystem security
- `backend/app/db/` — SQLAlchemy engine/session, ORM base + tables (migrations in `backend/migrations/`)
- `backend/app/models/` — Pydantic request/response models
- `backend/app/services/` — git cloning, scanning, file reading, LLM chat, health checks
- `backend/app/utils/` — language detection, file filtering rules
- `backend/tests/` — pytest suite (no network; temp dirs/fixtures)
- `frontend/lib/useHealth.ts`, `frontend/components/StatusBar.tsx` — TanStack Query health wiring
- `docker-compose.yml` — optional Postgres/Redis for local dev
- `.github/workflows/ci.yml` — backend pytest+ruff, frontend lint+build (no secrets)
- `frontend/app/` — Next.js App Router pages + global styles
- `frontend/components/` — Header, RepositoryForm, FileTree, CodeViewer, ChatPanel
- `frontend/lib/` — typed API client, helpers
- `frontend/types/` — shared TypeScript types
- `docs/` — architecture, api, security

## Code conventions

- Python 3.11+, full type hints, Pydantic v2 models at the boundary, thin routes / fat services.
- Responses and errors are JSON only; error shape is `{ "detail": { "code", "message" } }`.
- Frontend: TypeScript strict, function components, Tailwind, centralized `lib/api.ts` client,
  TanStack Query for server state.
- Never log API keys, full prompts, or file contents.
- Settings: V2 names (`LLM_*`); V1 `OPENAI_*` names remain as fallback aliases.
- Migrations: every ORM schema change ships with an Alembic migration (upgrade + downgrade
  verified locally before commit).

## Security invariants (non-negotiable)

1. Cloned repository code is NEVER executed (no installs, builds, scripts, hooks).
2. Every filesystem path is resolved with `pathlib` and verified to stay inside
   `backend/workspace/<uuid>/repo` before use. Block traversal, absolute/drive paths,
   null bytes, and symlink escapes. Repo IDs are validated as UUIDs first.
3. Only `https://github.com/<owner>/<repo>` URLs are accepted (no ports, credentials,
   query, fragment; SSH/other schemes/hosts rejected). GitPython API only — never shell.
4. Secrets (`.env`, key files) and known junk/vendor dirs are filtered from scan,
   tree, file serving, and LLM context.
5. LLM gets only the selected file as labeled untrusted data; model output is JSON-schema
   validated and citations are clamped to real line counts. Model output never drives
   code execution or writes.
6. `LLM_API_KEY`/`OPENAI_API_KEY` live only in backend env. Never sent to or read by the frontend.
7. Sandbox execution (`SANDBOX_ENABLED`) is OFF by default and requires explicit per-run
   approval once enabled. No host fallback execution, ever.

## Security invariants (non-negotiable)

1. Cloned repository code is NEVER executed (no installs, builds, scripts, hooks).
2. Every filesystem path is resolved with `pathlib` and verified to stay inside
   `backend/workspace/<uuid>/repo` before use. Block traversal, absolute/drive paths,
   null bytes, and symlink escapes. Repo IDs are validated as UUIDs first.
3. Only `https://github.com/<owner>/<repo>` URLs are accepted (no ports, credentials,
   query, fragment; SSH/other schemes/hosts rejected). GitPython API only — never shell.
4. Secrets (`.env`, key files) and known junk/vendor dirs are filtered from scan,
   tree, file serving, and LLM context.
5. LLM gets only the selected file as labeled untrusted data; model output is JSON-schema
   validated and citations are clamped to real line counts. Model output never drives
   code execution or writes.
6. `OPENAI_API_KEY` lives only in backend env. Never sent to or read by the frontend.

## Strict V1 scope (do not build)

Repository-wide RAG/embeddings/vector DBs, Tree-sitter, autonomous agents, patch generation,
repo file modification, test generation/execution, shell execution from model output, Docker
sandbox, git commits/PRs, OAuth/auth, database persistence, background queues.

## Definition of done

Backend boots and `/health` returns ok with component status (db/redis/llm); a public GitHub URL
clones and scans without executing anything; files browse and open safely; configured LLM answers
file-grounded with valid citations; unconfigured LLM yields a clean error; frontend works locally;
backend pytest, ruff check/format, frontend lint and build all pass; migrations apply and reverse
cleanly; README/docs match the implementation. Phase status lives in
docs/implementation-plan.md; per-phase gates in docs/acceptance-criteria.md.
