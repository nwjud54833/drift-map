# Acceptance Criteria — Advanced Edition

Each criterion is verified by an automated test or an explicit manual procedure.
No criterion is marked done without evidence (test run or recorded observation).

## A. Platform foundation (Phase 1)

- **A1** `GET /health` returns 200 with `status=ok`, service name, version, and a
  `components` object reporting `db` and `redis` as one of `ok|degraded|disabled`.
  The endpoint must not raise when either component is unreachable.
- **A2** Alembic migrations apply cleanly on a fresh database
  (`alembic upgrade head`) and reverse (`alembic downgrade base`), with
  `repositories` and `snapshots` tables created.
- **A3** The backend runs with SQLite (no external services) and with PostgreSQL
  when `DATABASE_URL` is provided.
- **A4** Settings expose V2 keys (`LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`,
  `EMBEDDING_MODEL`, `REDIS_URL`, `DATABASE_URL`, `SANDBOX_ENABLED=false`,
  token/output budgets) without breaking V1 env names (`OPENAI_API_KEY` remains
  supported as an alias until Phase 4).
- **A5** V1 behavior is preserved: existing pytest suite passes unchanged.
- **A6** Frontend builds and lints with the TanStack Query provider mounted; the V1
  workspace UI still functions against the V1 endpoints.
- **A7** CI workflow runs backend pytest+ruff and frontend lint+build with no secrets.

## B. Ingestion (Phase 2, planned)

- Public GitHub URL validation identical to V1 rules; ZIP upload with Zip Slip /
  archive-bomb / symlink / encrypted-entry rejection; per-upload size & count caps.
- Status lifecycle `queued → cloning → scanning → parsing → embedding → ready`
  incl. `failed`/`cancelled`; durable job rows; cancellation honored between steps.
- Scanner reports skipped/limit warnings; never claims a complete index when files
  were skipped.

## C. Parsing & retrieval (Phase 3, planned)

- Chunking at symbol boundaries for py/js/ts/tsx with deterministic IDs and valid
  line mapping; incremental reindex by content hash; stale chunks deleted.
- Hybrid retrieval (lexical + vector + RRF) scoped to one repository snapshot; no
  cross-repository leakage (security test).
- Every retrieval response exposes cited file paths + line ranges that exist.

## D. Chat (Phase 4, planned)

- Repository-grounded answers cite existing files/lines; invalid citations are
  clamped or dropped server-side; insufficient evidence produces an explicit
  "cannot determine" answer naming the missing context.
- Streaming over SSE with heartbeat and resume; conversations persisted and
  deletable; external-provider acknowledgement before first use.

## E. Agent, patches, sandbox, publication (Phases 5–8, planned)

- Agent state machine with hard budgets (≤12 tool calls default, ≤2 revisions,
  wall-clock and token caps); budget_exceeded is a terminal state.
- Tools are typed, Pydantic-validated, server-authorized, snapshot-scoped, logged.
- Patches: unified diffs + metadata; applicability verified before "apply" shows;
  approvals bound to (patch ID, content hash, base commit, operation); any content
  change invalidates approval.
- Application only to isolated worktrees; original clone never modified.
- Sandbox: execution disabled by default; each run requires explicit approval bound
  to snapshot + profile + command args + network policy + budget; no host fallback.
- Publication: draft PR default; never auto-merge; never push default/protected
  branches; no fabricated test claims (tests listed only if actually executed).

## F. Security regressions (continuous)

Automated tests exist and pass for: URL validation, path traversal, symlink escape,
secret filtering, cross-repository isolation, prompt-injection robustness of the
response parser (README/comment payloads never alter control flow), archive limits
(Phase 2), stale approval replay (Phase 6), runner option rejection (Phase 7).

## G. Honesty requirements

- Any untested integration is labeled **unverified** in docs.
- No fabricated tool results, citations, test logs, usage numbers, or PR URLs.
- Known limitations are stated in README and docs/security.md updates.
