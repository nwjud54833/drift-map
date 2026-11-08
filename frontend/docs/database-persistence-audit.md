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

## Permanent public demo PR

[PR #12](https://github.com/nwjud54833/drift-map/pull/12) is intentionally left open as a public product example. It removes the required `/customer/email` field from an Order API response. Hosted [run 42490396623](https://github.com/nwjud54833/drift-map/actions/runs/42490396623) completed successfully: the Action posted its sticky Markdown findings table, the report classified `/customer/email` as `BREAKING`, and the workflow verified the expected breaking exit code and finding. The README and landing page link to this PR.

## v2.5.2 persistence and CI changes

- Added the `EarlyAccessRequest` table with an additive migration only. Vercel builds now run `prisma migrate deploy` before publishing, using `DATABASE_URL_UNPOOLED` or a direct Neon hostname derived from the pooled URL. Local builds skip migrations, so the rotated local `.env.local` credential is not used for schema writes.
- The waitlist API validates and normalizes submissions, stores only the email and optional GitHub organization/repository count, and applies per-IP and per-email rate limits.
- Hosted baseline reads use existing `Workspace`, `ContractSnapshot`, and `PayloadSample` records. They require the owner session or a 90-day workspace-scoped read token; no contract data is public by workspace ID alone.
- Current verification: 312 frontend tests, 17 CLI/Action tests, lint, typecheck, schema validation, and production build passed.

## v2.5.3 self-serve CI and baseline promotion

- The signed-in cloud Workbench can issue separate 90-day workspace-scoped read and promote tokens and provides a ready-to-copy `v2.5.3` GitHub Action workflow.
- Read tokens work through an Authorization header or the copied URL query parameter; query tokens are stripped before network requests, redacted from CLI output, and protected from referrers.
- `POST /api/v1/workspaces/<id>/baseline` accepts only a promotion-scoped bearer token, validates JSON/OpenAPI candidate documents, and atomically creates a snapshot and selects it as the workspace baseline. The Action performs this only after a passing `push` to `main` with `promote-on-push: true`.
- `GET /api/v1/waitlist` requires an authenticated email listed in `DRIFTMAP_ADMIN_EMAILS` and returns only an aggregate count, never signup PII.
- Local v2.5.3 verification passed: 320 frontend tests, 19 CLI/Action tests, lint, typecheck, Prisma validation, and the production build. The live health endpoint is checked after the push.

## v2.5.4 Marketplace, webhook, and social preview polish

- Added Marketplace branding and an optional SSRF-resistant webhook integration. Webhook delivery is best-effort and does not alter the CI exit status.
- The Workbench export template and README Action examples are pinned to `@v2.5.4`.
- Root metadata and a dynamic OpenGraph image provide an Obsidian high-contrast share card with all four semantic severity classes.
- Local v2.5.4 verification passed: 327 frontend tests, 21 CLI/Action tests, lint, typecheck, Prisma validation, and production build. Production deployment health is checked after push.

## v2.5.5 README badge and promotion audit

- Added a cacheable SVG workspace badge endpoint. Badge tokens are scoped to the badge endpoint and cannot fetch baseline contract data; existing read tokens may also authorize the badge.
- The Workbench CI modal copies README badge Markdown and displays the current revision, inferred path count, last promotion timestamp, commit SHA, and actor when available.
- Promotion audit metadata is stored in the promoted snapshot's existing `notes` field, so this release requires no schema migration.
- Local verification passed: Prisma schema validation, ESLint, TypeScript typecheck, production build, 331 frontend tests, and 21 CLI/Action tests.
- Published as annotated tag `v2.5.5` and [GitHub Release](https://github.com/nwjud54833/drift-map/releases/tag/v2.5.5).
- Production health returned HTTP 200 with `status: ok`, `db: connected`, `version: 2.5.5`, and build SHA `04455ca9d81ec7248023d794c9ea5e82ec79e4ef`.

## v2.5.6 shared reviews and Pro checkout

- The Workbench creates compressed URL-safe review links for local workspaces when they fit the URL size cap. Synced workspaces receive a signed, read-only link scoped to the exact baseline and candidate snapshot IDs; the preview exposes no editing or workspace mutation controls.
- `NEXT_PUBLIC_PRO_CHECKOUT_URL` optionally enables an HTTPS Team CI Cloud checkout link in the landing pricing card and Workbench toolbar. When unset or invalid, the early-access waitlist remains available.
- The root README documents the v2.5.6 Action pin and the signed badge Markdown format. No Prisma schema or migration change was needed.
- Local v2.5.6 verification: Prisma validation, lint, typecheck, production build, 335 frontend tests, and 21 CLI/Action tests. Production health is verified after deployment.

## v2.5.7 cold-visitor presets and PR deep links

- Added three persisted Workbench example diffs: breaking payment webhook drift, warning plus safe order fulfillment drift, and an OpenAPI 3.0 YAML upgrade. They use the normal workspace and diff path, so visitors can immediately inspect or share the result.
- Markdown CLI/Action reports add a compressed read-only Workbench link only when the complete state fits the URL limit. The link contains the baseline and candidate inputs and never includes the hosted-baseline token; oversized inputs omit the link.
- Local v2.5.7 verification passed: Prisma validation, lint, typecheck, production build, 340 frontend tests, and 21 CLI/Action tests. Production deployment health is recorded after release.

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
