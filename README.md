# Personal AI Coding Agent

A local-first, repository-aware coding assistant. V1 (shipped): clones a **public GitHub
repository**, lets you browse its files safely, and answers questions about a **selected
file** using an OpenAI-compatible LLM — with line-range citations validated against the
real file.

Advanced Edition (in progress, phase by phase — see
[docs/implementation-plan.md](docs/implementation-plan.md)): repository-wide grounded Q&A,
bounded read-only agent, reviewable patches with hash-bound approvals, sandboxed test
runs (off by default), and optional GitHub PR publication. Phase 1 (platform foundation:
SQLAlchemy/Alembic persistence, Postgres/Redis-ready infrastructure, component health,
TanStack Query frontend shell, CI) is implemented and tested.

> **Security first:** cloned repositories are treated as untrusted data. Nothing from a
> cloned repository is ever executed.

## Screenshot

*(Screenshots not yet captured — placeholder section.)*

When running, the app shows a dark three-pane workspace: file explorer (left), code
viewer with line numbers (center), and an AI chat panel (right).

## V1 Features

- Paste a public `https://github.com/owner/repository` URL (optional branch/tag).
- Shallow, read-only clone into an isolated workspace (`backend/workspace/<uuid>/repo`).
- Repository metadata: default branch, total files, detected languages, project signals.
- Navigable file tree (directories before files, keyboard accessible).
- Source viewer with line numbers, language/size/line-count metadata, monospace layout.
- File-grounded AI chat: answers restricted to the selected file, with citations like
  `main.py:10-42` clamped to real line counts.
- Clean structured errors (`{"detail": {"code", "message"}}`) and explicit
  "LLM not configured" behavior instead of crashes.

## Explicit V1 Non-Features

- No repository-wide RAG, embeddings, or vector databases
- No Tree-sitter / symbol extraction
- No autonomous agents, patch generation, or repo modification
- No test generation or test execution
- No shell command execution from model output
- No Docker sandbox
- No git commits / pull requests
- No GitHub OAuth, private repos, or user authentication
- No database persistence (filesystem workspaces only)
- No background queues

## Architecture Overview

```
Browser (Next.js :3000)
    |  fetch (JSON only)
    v
FastAPI backend (:8000)
    |  validation / security layer (URL, UUID, path checks)
    v
Service layer (git / scanner / file / llm)
    |                 |                |
    v                 v                v
GitPython clone   pathlib scan    OpenAI-compatible API
(workspace/)      (workspace/)    (configured via .env)
```

Details: [docs/architecture.md](docs/architecture.md) | API: [docs/api.md](docs/api.md) |
Security: [docs/security.md](docs/security.md)

## Security Model (summary)

- Cloned code is **never executed**; the cloned `.git` directory is removed after cloning.
- Only `https://github.com/<owner>/<repo>` URLs are accepted (SSH, other hosts, ports,
  credentials, query strings, and fragments are rejected). GitPython API only — no shell.
- Every file request is resolved with `pathlib` and verified to stay inside
  `workspace/<uuid>/repo`. Traversal, absolute paths, drive letters, null bytes, and
  symlink escapes are blocked.
- Secret-like files (`.env*`, keys, certs, credentials) and junk/vendor directories are
  filtered from scanning, the tree, file serving, and AI context.
- The LLM receives only the selected file as clearly labeled **untrusted data**; output
  is JSON-validated and citations clamped. Model output never triggers code execution.
- `OPENAI_API_KEY` lives only in the backend environment and is never sent to the browser.

Full model: [docs/security.md](docs/security.md).

## Prerequisites

- Python 3.11+ (tested with 3.12)
- Node.js 20+ and npm (tested with Node 24)
- Git (used via GitPython for cloning)

## Environment Variable Setup

**Backend** — copy `backend/.env.example` to `backend/.env` and edit:

```
LLM_API_KEY=               # required for AI chat (OPENAI_API_KEY still works)
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
DATABASE_URL=              # empty = local SQLite; or Postgres (see docker-compose.yml)
REDIS_URL=                 # empty = Redis disabled; or redis://localhost:6379/0
```

Optional backing services: `docker compose up -d` (Postgres :5432, Redis :6379).
Apply database migrations once: `alembic upgrade head` (from `backend/`, venv active).

Without `OPENAI_API_KEY` the app still runs — browsing works, and `/api/chat` returns a
clean `LLM_NOT_CONFIGURED` error. Any OpenAI-compatible endpoint (OpenRouter, LM Studio,
Ollama, etc.) works via `OPENAI_BASE_URL`.

**Frontend** — copy `frontend/.env.local.example` to `frontend/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

Never commit `.env` / `.env.local` — both are git-ignored.

## Setup — Windows PowerShell

```powershell
# Backend
cd E:\personal-ai-coding-agent\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then edit .env with your API key

uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd E:\personal-ai-coding-agent\frontend
npm install
copy .env.local.example .env.local   # defaults are fine for local dev
npm run dev
```

Open http://localhost:3000

## Setup — macOS / Linux

```bash
# Backend
cd personal-ai-coding-agent/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then edit .env with your API key

uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd personal-ai-coding-agent/frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000

## API Endpoint Overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + version + component status (db/redis/llm) |
| POST | `/api/repositories/clone` | Validate + clone + scan a public repo |
| GET | `/api/repositories/{repo_id}/tree` | File tree, languages, warnings |
| GET | `/api/repositories/{repo_id}/file?path=` | One allowed text file |
| POST | `/api/chat` | File-grounded AI answer with citations |

Full request/response examples: [docs/api.md](docs/api.md).

### Example: clone a public repository with curl

```bash
curl -X POST http://localhost:8000/api/repositories/clone \
  -H "Content-Type: application/json" \
  -d '{"repo_url": "https://github.com/octocat/Hello-World"}'
```

Successful response (truncated):

```json
{
  "repo_id": "ec5fa428-...",
  "repo_name": "Hello-World",
  "repo_url": "https://github.com/octocat/Hello-World",
  "default_branch": "master",
  "total_files": 1,
  "detected_languages": {"Unknown": 1},
  "file_tree": [{"name": "README", "path": "README", "type": "file", "extension": "", "language": "Unknown", "size_bytes": 13}],
  "warnings": []
}
```

### Example: ask about a file

```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"repo_id": "<repo_id-from-above>", "file_path": "README", "question": "What does this file contain?"}'
```

## Testing / Lint Commands

Backend database (from `backend/`, venv active):

```bash
alembic upgrade head       # apply migrations
alembic downgrade base     # reverse all (dev only)
```

Backend (from `backend/`, venv active):

```bash
pytest                    # run the test suite (offline, no network clones)
ruff check .              # lint
ruff format --check .     # formatting check
```

Frontend (from `frontend/`):

```bash
npm run lint              # ESLint
npm run build             # type-check + production build
```

## Troubleshooting

**"LLM is not configured"** — `OPENAI_API_KEY` is missing or empty in `backend/.env`.
Set it (plus optional `OPENAI_BASE_URL` / `OPENAI_MODEL`), then restart the backend.

**CORS errors in the browser console** — the frontend origin must be listed in
`BACKEND_CORS_ORIGINS` in `backend/.env` (default: `http://localhost:3000`). Restart the
backend after changing it.

**Clone error (502)** — the repository must be **public**; private or missing repos fail.
Check your internet connection and that the URL is exactly
`https://github.com/<owner>/<repository>`.

**"Port already in use" (10048 / address in use)**
- Windows: `netstat -ano | findstr :8000` then `taskkill /F /PID <pid>`
- macOS/Linux: `lsof -ti :8000 | xargs kill -9`
Or start on another port (`--port 8001`) and update `NEXT_PUBLIC_API_BASE_URL`.

**AI answers fail with an upstream error** — the provider rejected the request (bad key,
no quota, or unsupported model). Verify the key/model against your provider's dashboard.

## Project Limitations

- V1 reads **one file at a time** for AI context (max 50,000 characters); no
  cross-file reasoning.
- 2,000-file / depth-12 scan limits; larger repositories show truncated trees with a
  warning.
- Files over 1 MB, binary files, lockfiles, and secret-like files are excluded from
  viewing or AI context by design.
- Session state is in-memory only; a page reload requires re-cloning (previous
  workspaces remain on disk until the backend restarts or is cleaned manually).
- Answers depend on the configured model; citations are validated but the model can
  still be wrong about the file's contents.

## V2 Ideas

- Repository-wide RAG with embeddings for cross-file questions
- Tree-sitter symbol extraction (go-to-definition style navigation)
- Bug/risk analysis and proposed diffs (read-only suggestions)
- Sandboxed test execution for cloned projects
- Optional GitHub PR integration with explicit user auth

## License

MIT — see [LICENSE](LICENSE).

## Contract Atlas

Contract Atlas is available from the frontend at `http://localhost:3000/contract-atlas`. It compares imported JSON payload samples through deterministic, sample-based contract inference and directional compatibility rules. Data and inferred contracts are stored locally in the browser using IndexedDB (Dexie); imported payloads are not uploaded. The separate coding-assistant experience at `/` remains unchanged.

Features include local workspaces, baseline/candidate JSON or JSON-array import, response/request/event drift classification, search and severity filters, raw sample inspection, Markdown reports, and workspace JSON backups.

Frontend quality commands (run from `frontend/`):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Contract Atlas uses TypeScript, Next.js, React, Tailwind CSS, Zustand, Dexie, Zod, Lucide, and Vitest.

Known limitations: sample inference is not formal schema validation; field renames are shown as removal plus addition; JSON is the only import format; imported payloads are capped at 2 MB; there is no cloud sync, team collaboration, or OpenAPI integration.
