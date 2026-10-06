# Contract Atlas

A **local-first visual workbench** that turns real JSON payload samples into an inferred
contract and highlights semantic API, webhook, and structured-output drift as
**breaking / warning / safe / info** — instead of a noisy line-by-line text diff.

```
REAL JSON SAMPLES → INFERRED CONTRACT → SEMANTIC COMPARISON → COMPATIBILITY ANALYSIS → ACTIONABLE DRIFT
```

## Overview

An upstream API, webhook, or structured output changed. You have a few old payload
samples and a few new ones, but no formal schema. Contract Atlas answers:

> "What structurally changed, and what is likely to break?"

Paste or import two payload versions; the deterministic engine infers normalized paths,
kinds, and requiredness from every sample, compares the two inferred contracts, and
classifies every change with direction-aware compatibility rules.

## Features

- **Local-first** — everything lives in your browser (IndexedDB via Dexie); nothing is uploaded
- **Sample-based contract inference** — normalized JSON-pointer paths (`/data/items/*/sku`),
  kind unions (`string | null`), requiredness from sample presence
- **Semantic drift rail** — field added/removed, type changed, became required/optional
- **Direction-aware compatibility** — response / request / event severity policies
- **JSON import** — paste or `.json` file, single object or array of samples, 2 MB cap, friendly errors
- **Workspaces** — multiple comparisons, rename, swap baseline/candidate, snapshot labels, demo fixture
- **Search & filters** — severity chips, text search, unchanged-path view
- **Exports** — Markdown drift report (no raw payloads) and full workspace JSON backup
- **Keyboard-first** — `Ctrl/⌘ K` command palette, `Ctrl/⌘ O` import, `Ctrl/⌘ E` export, `Esc` closes
- **Deterministic core** — pure TypeScript engine, no LLM, no network, fully unit-tested

## Tech stack

TypeScript (strict) · Next.js App Router · React 19 · Tailwind-free custom CSS design system ·
Zustand (transient UI state) · Dexie (IndexedDB persistence) · Zod (import validation) ·
Lucide icons · Vitest

## Development

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 — the workbench is the root page. On first run a demo
workspace (**Order Webhook Migration**, an `order.shipped` webhook money-object migration)
is seeded locally and immediately shows meaningful drift.

## Quality

From `frontend/`:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest, pure-core suite
npm run build       # production build
```

## Privacy

Contract Atlas processes payloads locally in the browser.
The MVP does not upload imported JSON to a server.

There is no backend, no API routes, no authentication, no telemetry, and no external
network calls anywhere in the application. Imports never leave the tab; exports are
produced with local `Blob` downloads only.

## Architecture

```
UI (React client components)
  ↓
Zustand (transient UI state only)
  ↓
pure contract engine (lib/contract — no React, no Dexie, no browser globals)
  ↓
Dexie adapter (lib/db — IndexedDB persistence, demo seeding)
```

Pure engine modules: `parse`, `normalize` (kinds, pointer escaping), `infer`
(contracts + fingerprints), `compare` (diff + suppression + unchanged), `compatibility`
(central severity policy), `export` (Markdown report + workspace backup).

## Known limitations

- Sample inference is evidence, not formal schema validation — it cannot prove that a
  producer's schema matches the samples
- Field renames appear as removal + addition; there is no fuzzy rename detection
- v1 supports JSON only (no OpenAPI, YAML, XML, CSV, GraphQL)
- Imported payloads are capped at 2 MB
- No cloud sync, no team collaboration, no CI integration

## License

MIT — see [LICENSE](LICENSE).
