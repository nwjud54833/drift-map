# DriftMap

Contract Atlas is a local-first Next.js application for comparing real JSON payload samples, inferring a structural contract, and classifying semantic drift as breaking, warning, safe, or info. It also includes authenticated API routes for optional cloud-backed workspaces, snapshots, payload samples, and persisted diffs.

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
checked-in `vercel.json`. Configure Vercel environment variables separately
from local `.env.local`: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and
`AUTH_GOOGLE_SECRET`. Set production and preview values to their intended
environments. `AUTH_TRUST_HOST` is enabled automatically on Vercel by the auth
configuration, but can be set explicitly. Do not configure `TEST_DATABASE_URL`
in Vercel. The build runs Prisma Client generation and `next build`; it does
not apply database migrations.

## Privacy

In local mode, JSON payloads and workspaces are stored in browser IndexedDB and
comparisons run locally. When cloud persistence is selected, authenticated
workspace, snapshot, sample, and diff operations use the configured server and
PostgreSQL database. The project does not require an API key for these user
flows.

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
- Collaboration and CI integration are not implemented.

## License

MIT — see [LICENSE](LICENSE).
