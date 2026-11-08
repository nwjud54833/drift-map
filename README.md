# DriftMap

Contract Atlas is a local-first Next.js application for comparing real JSON payload samples, inferring a structural contract, and classifying semantic drift as breaking, warning, safe, or info. It also includes authenticated API routes for optional cloud-backed workspaces, snapshots, payload samples, and persisted diffs.

[![View live DriftMap PR example](https://img.shields.io/badge/GitHub-View%20Live%20PR%20Example-8250df?logo=github)](https://github.com/nwjud54833/drift-map/pull/12)

The signed-in Workbench CI panel can generate a workspace-scoped, badge-only
README status badge and show the revision, path count, and last CI promotion.

### Add the DriftMap contract badge

Copy the ready-to-use Markdown from **Use in CI / GitHub Action** in the
Workbench. The badge token is read-only and exposes only the path-count badge.
The generated line has this form (replace both placeholders with the values
from the Workbench):

```markdown
![DriftMap contract status](https://driftmap.in/api/v1/workspaces/WORKSPACE_ID/badge?token=BADGE_ONLY_TOKEN)
```

The Workbench workflow template uses the pinned v2.5.6 Action:

```yaml
- uses: nwjud54833/drift-map@v2.5.6
```

## Routes

- `/` — DriftMap-inspired product overview and interactive explanation
- `/workbench` — functional local-first Contract Atlas workbench
- `/contract-atlas` — legacy redirect to `/workbench`

## Development

Requirements: Node.js 20+ (Next.js supports Node 18.18+; Node 20 LTS or newer is recommended) and npm.

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:3000>.

For authenticated cloud persistence, create `frontend/.env.local` from
`frontend/.env.example` and configure `DATABASE_URL`, `AUTH_SECRET`,
`AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` locally. Next.js loads `.env.local`
for development. Prisma schema operations use `DATABASE_URL`; the Prisma
validation script also loads `.env.local`. Keep this file out of version
control.

Database integration tests require a separate `TEST_DATABASE_URL` for a
dedicated, empty, non-production PostgreSQL database. The setup script deploys
the checked-in migrations to the `driftmap_test` schema, and the test suite
clears its test tables. Never use a production database for integration tests.

## Quality checks

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The production deployment uses standard Next.js/Vercel behavior; there is no
checked-in `vercel.json`. Vercel builds deploy pending Prisma migrations before
publishing, using `DATABASE_URL_UNPOOLED` when configured or deriving the direct
Neon hostname from `DATABASE_URL`. This release adds only the
`EarlyAccessRequest` table; local builds skip migrations. Configure Vercel environment variables separately
from local `.env.local`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and
`AUTH_GOOGLE_SECRET`. Set production and preview values to their intended
environments. `AUTH_TRUST_HOST` is enabled automatically on Vercel by the auth
configuration, but can be set explicitly. Do not configure `TEST_DATABASE_URL`
in Vercel. The Vercel build script applies migrations before Prisma Client
generation and `next build`; local builds skip migrations.

## Command line

A small local wrapper around the contract engine is available from this checkout
(`driftmap` compares two files without opening the workbench):

```bash
npx tsx frontend/bin/driftmap.ts compare <baseline> <candidate> [options]
npx tsx frontend/bin/driftmap.ts diff --baseline <file-or-url> --candidate <file> [options]
```

Each input is a file path holding a JSON payload, a JSON array of payload
samples, or an OpenAPI 3.0 document (JSON or YAML). The input type is detected
from the file contents, not the extension.

### Flags

| Flag | Values | Default |
| --- | --- | --- |
| `--direction` | `response`, `request`, `event` | `response` |
| `--fail-on` | `breaking`, `warning`, `off` | `breaking` |
| `--format` | `text`, `json`, `markdown` | `text` |
| `--out <file>` | file path | print to stdout |
| `--webhook-url <url>` | HTTPS Slack/Discord/JSON webhook | disabled |

`--format json` emits a stable shape: `{ summary: { breaking, warning, safe, info }, changes: [{ pointer, kind, severity, rule, before, after }] }`.

### Exit codes

| Code | Meaning |
| --- | --- |
| `0` | No findings at or above the `--fail-on` level |
| `1` | Findings met the `--fail-on` level |
| `2` | Usage error, unreadable file, invalid JSON, or unsupported spec version |

Inputs are capped at 2 MB per file. `--fail-on off` always exits `0` unless the
arguments or the files themselves are unusable.

For a hosted baseline, pass its HTTPS workspace endpoint to `--baseline` and
store the signed URL from the Workbench's **Use in CI / GitHub Action** panel in
`DRIFTMAP_BASELINE_URL`. To promote on a passing push to `main`, use the
separate `DRIFTMAP_PROMOTE_TOKEN` secret and run `driftmap promote <url>
<candidate-file>`. Add `--webhook-url <url>` (or `DRIFTMAP_WEBHOOK_URL`) for
best-effort breaking-drift and promotion notifications. Webhooks are HTTPS-only,
block local/private destinations, and cannot change the CI result. Tokens are
workspace scoped and expire after 90 days.

The CLI is not yet published to npm; run it with `npx tsx` from a checkout of
this repository.

### Example: pre-deploy check in a shell script

```bash
#!/usr/bin/env bash
set -euo pipefail

# The spec you promised last deploy vs. the spec candidate you are about to ship.
npx tsx frontend/bin/driftmap.ts compare   specs/orders-api@1.0.0.json   specs/orders-api@1.1.0.json   --direction response   --fail-on breaking   --format text

echo "No breaking contract drift; safe to deploy."
```

The script fails (exit `1`) before deploy when the candidate has breaking
drift.

## Privacy

In local mode, JSON payloads and workspaces are stored in browser IndexedDB and
comparisons run locally. When cloud persistence is selected, authenticated
workspace, snapshot, sample, and diff operations use the configured server and
PostgreSQL database. The project does not require an API key for these user
flows. The Early Access form stores the normalized email and optional GitHub
organization/repository count in PostgreSQL; those values are not returned by
the API.

## Architecture

```text
Next.js App Router
  ├─ React workbench + contract engine → Dexie IndexedDB (local mode)
  └─ Auth.js + API routes → shared Prisma Client → PostgreSQL (cloud mode)
```

The domain engine covers JSON parsing, normalized JSON-pointer paths, array wildcard normalization, type inference, requiredness evidence, stable contract fingerprints, semantic comparison, compatibility classification, and Markdown/workspace exports.

## Known limitations

- Sample inference is evidence, not formal schema validation.
- Field renames appear as removal plus addition; fuzzy rename detection is not implemented.
- Payload samples are JSON; API specifications support OpenAPI 3.0 JSON and YAML.
- OpenAPI 3.1 and Swagger 2.0 are not supported. External `$ref` URLs are rejected.
- Imports are capped at 2 MB; schema comparison is deterministic heuristic guidance, not a guarantee that deployed servers conform to their specifications.
- Local IndexedDB data is not automatically synchronized with cloud workspaces.
- Multi-user collaboration is not implemented. Pull request gating is available
  through the composite GitHub Action in `action.yml`; see
  `packages/driftmap/README.md` for its setup requirements.
- Team Cloud Baseline features are in early access planning; the free Action
  currently compares the baseline and candidate files supplied to the workflow.

## License

MIT — see [LICENSE](LICENSE).
