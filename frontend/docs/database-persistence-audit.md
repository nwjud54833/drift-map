# DriftMap release security and persistence audit

Audit refreshed: 2026-10-13

## Scope and deployment metadata

This audit covers the current working tree, Prisma schema and migration history,
Auth.js setup, workspace/snapshot/diff APIs, OpenAPI import and comparison,
request-body limits, response security headers, Content Security Policy,
Vercel Production metadata, and dependency advisories. It does not query
customer records, change database contents, apply migrations, or read any saved
credential value.

The Vercel project is `drift-map`. Its Environment Variables page showed
`DATABASE_URL` as a Production secret with a recent update timestamp. The four
required Production entries (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`,
and `AUTH_GOOGLE_SECRET`) were present. Values were not retrieved. This verifies
the variable update metadata, but does not independently compare the hidden
Production URI byte-for-byte with a Neon endpoint.

Neon Console identifies project `nameless-feather-27420217` and branch
`driftmap-test`; that branch is derived from `production`. Its compute was
suspended during this refresh, so no new database connection or SQL query was
made. A prior read-only check on this target observed database `neondb`, schema
`public`, PostgreSQL 18.6, all five checked-in migrations recorded as applied,
and zero workspaces, snapshots, payload samples, diffs, and changes at that
time. That earlier database evidence was not refreshed in this pass. The local
`.env.local` connection is not used as a deployment-health signal.

## Persistence and ownership

- Auth.js uses the Prisma adapter and database sessions. Protected API routes
  enforce server-side session checks and scope workspaces through `userId`.
- Snapshot operations check the owning workspace; snapshot deletion disconnects
  workspace pointers before removal. Diff writes validate workspace ownership
  and both snapshot memberships, then persist the diff and change rows in a
  transaction. Diff list/detail reads are scoped through the workspace owner.
- Migration `20261008203000_auth` adds required `Workspace.userId` without an
  ownership backfill. The repository cannot infer owners for any pre-existing
  workspace on another database. Do not assign owners without a trusted mapping
  and recovery decision. This migration must not be applied to a populated
  database whose ownership is unknown.
- The three later migrations enforce same-workspace diff snapshot membership,
  same-workspace baseline/candidate pointers, and OpenAPI `ChangeKind` values.
  All five migration directories and `schema.prisma` must ship together.
- The latest prior PostgreSQL integration report was 15/15 passing against the
  separate `driftmap-integration-test` project. It was not rerun in this pass:
  `TEST_DATABASE_URL` was not configured in the current process. The hermetic
  suite excludes the database integration cases.

## Request, import, and browser protections

- API JSON bodies are streamed and capped at 4 MiB, including requests without
  `Content-Length`.
- OpenAPI 3.0 JSON/YAML import is capped at 2 MiB and limits operations,
  reference expansion, and recursion. External `$ref` URLs are rejected and
  are never fetched.
- API error responses use generic messages instead of exposing database
  exceptions; session lookup failures are handled as JSON errors.
- `frontend/middleware.ts` creates a fresh per-request CSP nonce and limits
  scripts to the app origin plus that nonce. It blocks objects, restricts
  base/form/frame behavior, and allows inline styles required by the current UI.
- `next.config.ts` applies `nosniff`, `DENY`, strict-origin referrer policy,
  Permissions-Policy, and production HSTS.
- Vercel Firewall showed the `DriftMap API rate limit` rule active with a 429
  action. The production deployment has not yet been verified for these source
  changes; the rule and response headers must be checked again after deploy.

## Dependency audit

`npm audit --json` currently exits 1 with 8 high, 0 moderate, and 0 critical
findings. `npm audit --omit=dev --json` exits 1 with 3 high findings. No
compatible, tested fix is offered by the lockfile audit; its automated
suggestions downgrade `eslint-config-next` to 14.2.35 and Prisma to 6.12.0,
which are not appropriate fixes for this release.

| Dependency path | Exposure and mitigation |
| --- | --- |
| `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` 3.0.3 | High advisory GHSA-vfj7-8cjw-p6xm affects deeply nested brace patterns. This is development lint tooling; the production server trace does not contain the vulnerable package, and request data is not passed to brace expansion. No patched `braces` release is reported by the current audit. |
| `@prisma/client` peer → `prisma` 6.19.3 → `@prisma/config` → `deepmerge-ts` 7.1.5 | High advisory GHSA-ggr8-5vv4-36mx concerns recursive JavaScript object graphs. The Prisma CLI/config packages and `deepmerge-ts` are absent from the production server output trace; the app's API accepts JSON, which cannot encode cyclic object graphs, and request handlers do not invoke Prisma config merging. The patched `deepmerge-ts` 8.x release is outside the parent's declared compatibility; no override was applied. Keep Prisma CLI/config inputs trusted and upgrade when Prisma provides a compatible fix. |

The production build output trace contained no `prisma` CLI, `@prisma/config`,
or `deepmerge-ts` paths. These advisories remain open; this is a scoped runtime
exposure assessment, not a claim that the dependencies are fixed.

## Verification refreshed 2026-10-13

| Check | Result | Exit |
| --- | --- | ---: |
| Hermetic tests (`npm test -- --reporter=dot`) | 78 passed in 10 files | 0 |
| TypeScript (`npm run typecheck`) | Passed | 0 |
| ESLint (`npm run lint`) | Passed | 0 |
| Prisma validation (`npm run prisma:validate`, dummy URL) | Passed | 0 |
| Production build (`npm run build`, dummy URL) | Passed | 0 |
| `git diff --check` | Passed; Git emitted line-ending normalization warnings | 0 |
| `npm audit --json` | 8 high, 0 critical; see above | 1 |
| `npm audit --omit=dev --json` | 3 high, 0 critical; Prisma dependency path | 1 |
| Vercel Production variable metadata | All four required entries present; `DATABASE_URL` updated recently, value not read | N/A |
| Neon read-only refresh | Not run; approved branch compute was suspended | N/A |
| PostgreSQL integration suite | Not run in this pass; separate test URL absent from process | N/A |
| Live browser sign-in/workspace/import workflow | Not yet tested on this release | N/A |

## Release notes

Include the Prisma schema and all five migrations, server/API/auth/persistence
code, OpenAPI importer and comparison engine, Workbench and UI, required SVG
logos, package manifests and lockfile, fixtures, hermetic/integration tests and
harness, `.env.example`, README, OpenAPI compatibility documentation, and this
refreshed audit. Exclude `.env.local`, `.agents/`, `skills-lock.json`, and
`qa-workbench-settled.png`.

No schema or database contents were changed during this audit. Release staging,
commit, push, and deployment are tracked separately from this database review.
