# Contract Atlas

Contract Atlas is a local-first Next.js application for comparing real JSON payload samples, inferring a structural contract, and classifying semantic drift as breaking, warning, safe, or info.

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

## Quality checks

Run from `frontend/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The production deployment uses standard Next.js/Vercel behavior. No custom server, Docker setup, API routes, database, or authentication is required for this step.

## Privacy

JSON payloads are parsed and compared locally in the browser. Contract Atlas does not upload imported payloads, use telemetry, or require an API key. Workspaces are stored in browser IndexedDB.

## Architecture

```text
Next.js App Router
  ↓
React workbench UI + Zustand transient UI state
  ↓
pure TypeScript contract engine
  ↓
Dexie IndexedDB adapter
```

The domain engine covers JSON parsing, normalized JSON-pointer paths, array wildcard normalization, type inference, requiredness evidence, stable contract fingerprints, semantic comparison, compatibility classification, and Markdown/workspace exports.

## Known limitations

- Sample inference is evidence, not formal schema validation.
- Field renames appear as removal plus addition; fuzzy rename detection is not implemented.
- JSON is the only supported import format.
- Imported payloads are capped at 2 MB.
- There is no cloud sync, collaboration, CI integration, backend, or account system.

## License

MIT — see [LICENSE](LICENSE).
