# DriftMap release and persistence audit

Refreshed: 2026-11-08

## Verified release checks

- Local build, lint, typecheck, 295 frontend tests, and 17 CLI/Action tests passed.
- Locked versions are Next.js 15.5.29, Zod 4.6.6, Prisma 7.10.1, and @prisma/client 7.10.1.
- `npm audit --omit=dev` reported 0 production vulnerabilities. The latest full audit recorded 6 moderate development-tooling findings and no high or critical findings.
- The developer manually completed Google OAuth sign-in on the local production server and saved a workspace. The browser flow was manually verified; aggregate User/Account/Session/Workspace counts were not obtained.

## Hosted GitHub Action verification

PR #11 from `feat/cli-dark-theme` to `test-driftmap-action` triggered [run 42393672438](https://github.com/nwjud54833/drift-map/actions/runs/42393672438) on head `8c2a45356445e54dd7bc574ffd7408c3d331889c`. The run concluded `success`.

- The breaking CLI check asserted exit code 1 and its Markdown report contained a `BREAKING` row for the removed required field.
- The safe CLI step completed successfully with exit code 0, and the log contained the expected `SAFE` row for the optional field addition.
- The final workflow gate asserted the breaking Action outcome was failure and the safe CLI outcome was success; all three assertion steps concluded successfully.
- PR #11 was closed and the remote and local `test-driftmap-action` branches were deleted after capturing the run.

## Database persistence and smoke test

`frontend/scripts/verify-db-auth.ts` is ready for CI or pre-deploy execution against an explicitly selected, empty, non-production database. It verifies disposable user creation, session persistence, workspace create/update/query, and a 1 MiB JSON snapshot round-trip, then deletes the disposable user in `finally`. It requires `TEST_DATABASE_URL` and `DRIFTMAP_TEST_DATABASE_CONFIRMATION=I_VERIFIED_EMPTY_NON_PRODUCTION`.

The live database gate remains **pending**. The configured Neon URL in `frontend/.env.local` uses a pooled hostname. The direct hostname was derived; the shell DNS resolver refused it, so the HTTPS SQL endpoint was reached using public DNS-over-HTTPS and `curl --resolve`. Neon then rejected the configured database credentials with a PostgreSQL password-authentication error for role `neondb_owner`. No aggregate row counts were returned. No `driftmap_audit_test` database was created, migrated, smoke-tested, or dropped in this verification attempt; its presence/removal was not confirmed. Production migrations were not run.

### Production deployment health check

After release commit `472aa7e7729abf88c73faca9f97406666f5a275c` was pushed to `main`, `https://driftmap.in/api/health` returned HTTP 200 with `status: ok`, `db: connected`, `version: 2.5.0`, and the same deployed commit SHA. The production Prisma connection therefore passed a live `SELECT 1` health check. The production Auth.js providers endpoint returned HTTP 200 and listed Google; the session endpoint returned HTTP 200 with an anonymous session. The earlier local Neon credential failure remains relevant to the isolated test-database smoke gate, which is still pending.

## Persistence and production security notes

- Auth.js uses database sessions; protected workspace routes scope access by user ownership. Snapshot and diff writes validate workspace membership.
- API JSON bodies are capped at 4 MiB. OpenAPI imports are capped at 2 MiB, limit expansion, and reject external `$ref` URLs.
- Middleware applies a per-request CSP nonce. The Next.js configuration sets security headers and production HSTS.
- Production deployment was verified through the health endpoint at commit `472aa7e7729abf88c73faca9f97406666f5a275c`. The endpoint reports only connection status and build metadata; it does not expose credentials or raw database errors.

## Release status

Local checks, manual OAuth/workspace use, hosted BREAKING plus SAFE classification assertions, and live production database connectivity/Auth.js configuration are verified. The dedicated isolated Neon migration/auth/workspace smoke test and independent database row counts remain pending because the configured local test credentials were rejected. Production database connectivity is live and verified; the separate isolated test-database gate is not marked passed.
