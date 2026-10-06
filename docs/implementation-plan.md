# Implementation Plan — Personal AI Coding Agent (Advanced Edition)

> Status legend: **[implemented]** code exists and runs · **[tested]** automated tests pass ·
> **[blocked]** waiting on credential/infra · **[deferred]** planned, not scheduled.

## Baseline (inspected before any change)

V1 exists and works: FastAPI backend (`app/api`, `app/core`, `app/services`, `app/models`,
`app/utils`, `tests/`), Next.js 15 frontend (`app/`, `components/`, `lib/`, `types/`),
docs (`architecture.md`, `api.md`, `security.md`). Verified V1 assets reused as-is:

- `core/security.py` — GitHub URL validation + safe path resolution (unit-tested)
- `core/errors.py` — `{detail: {code, message}}` error envelope
- `services/git_service.py` — shallow GitPython clone, timeout, cleanup
- `services/repository_scanner.py` + `utils/file_filters.py` — tree scan, secret/junk filtering
- `services/llm_service.py` — file-grounded chat, JSON-validated, citation clamping
- Frontend: `Workspace`, `FileTree`, `CodeViewer`, `ChatPanel`, `RepositoryForm`, `lib/api.ts`

Migration rule: V1 functionality is preserved; V2 features are added as new modules.
V1 file-level chat becomes one capability of the repository chat (Phase 4+).

## Guiding principles

1. Modular monolith (API + worker + restricted runner); no microservices sprawl.
2. Every external-facing action re-validated server-side; client input is untrusted.
3. Bounded everything: files, tokens, tool calls, time, retries, outputs.
4. Explicit approval gates for execution, patching, commits, pushes, PRs.
5. No fabricated results: usage, citations, test logs, PR URLs only from real sources.
6. Each phase leaves the app runnable and checks green.

## Phase plan

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Baseline inspection, planning docs | [implemented] |
| 1 | Foundation: SQLAlchemy/Alembic/Postgres wiring, Redis settings, settings schema (LLM_*), health with db/redis status, frontend shell with TanStack Query, CI | [implemented] |
| 2 | Ingestion v2: jobs (Celery), status lifecycle, ZIP upload, snapshot metadata, explorer upgrades | deferred (next) |
| 3 | Tree-sitter parsing (py/js/ts/tsx), chunks, incremental indexing, BM25+vector hybrid, RRF | deferred |
| 4 | Repository-wide grounded chat, streaming, validated citations, conversations | deferred |
| 5 | Bounded read-only agent (state machine, 8 typed tools, budgets), findings | deferred |
| 6 | Patch generation, diff review, hash-bound approvals, isolated worktree application | deferred |
| 7 | Sandbox runner (Docker adapter, off by default), test generation, bounded repair loop | deferred |
| 8 | Docs generation, GitHub publication (branch/commit/draft PR) | deferred |
| 9 | Evaluation fixtures, security regression suite, UI polish, final docs | deferred |

## Phase 1 detail (this milestone)

- `requirements.txt` pinned: sqlalchemy 2.0.x, alembic 1.x, psycopg 3.x (binary).
- `app/db/` — engine/session factory, `Base` declarative, first tables
  (`repositories`, `snapshots`), SQLite fallback for local dev/tests,
  Postgres when `DATABASE_URL` is set.
- `migrations/` — Alembic env wired to `app.db.base`; initial migration.
- `app/core/config.py` — V2 settings: `LLM_API_KEY/BASE_URL/MODEL`,
  `EMBEDDING_MODEL`, token/context limits, `REDIS_URL`, `DATABASE_URL`,
  `SANDBOX_ENABLED=false` (off until explicitly configured), budgets.
- `GET /health` extended: `{"status", "service", "version", "components": {db, redis, llm}}`.
- Frontend: TanStack Query provider, `features/` scaffolding, API base stays centralized.
- CI: GitHub Actions — backend pytest+ruff, frontend lint+build. No API keys required.
- Docs: architecture, threat-model, acceptance-criteria.

## Verification commands (Phase 1)

```bash
# backend (venv active)
alembic upgrade head
alembic downgrade -1 && alembic upgrade head   # migration reversibility
pytest
ruff check .
# frontend
npm run lint && npm run build
```

## Acceptance at each phase

- app boots and stays runnable; V1 flows still work
- new tests pass; no fabricated results in docs
- security invariants (CLAUDE.md §Security) hold; new attack surface threat-modeled
