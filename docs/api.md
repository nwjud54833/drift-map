# API Reference

Base URL: `http://localhost:8000`. All requests and responses are JSON.

## Error Format

Every error (except validation details below) uses this consistent shape:

```json
{
  "detail": {
    "code": "ERROR_CODE",
    "message": "Human readable explanation"
  }
}
```

Common codes: `INVALID_REQUEST` (422), `INVALID_REPO_URL` (422), `REPOSITORY_NOT_FOUND`
(404), `FILE_NOT_FOUND` (404), `FORBIDDEN_PATH` (403), `UNSUPPORTED_FILE_TYPE` (415),
`FILE_TOO_LARGE` (413), `FILE_TOO_LARGE_FOR_AI` (413), `LLM_NOT_CONFIGURED` (503),
`LLM_UPSTREAM_ERROR` (502), `CLONE_FAILED` (502), `CLONE_TIMEOUT` (504),
`INTERNAL_ERROR` (500).

---

## GET /health

```bash
curl http://localhost:8000/health
```

```json
{ "status": "ok", "service": "personal-ai-coding-agent-api", "version": "0.1.0" }
```

---

## POST /api/repositories/clone

Validate, shallow-clone, and scan a public GitHub repository.

**Request**

```json
{
  "repo_url": "https://github.com/octocat/Hello-World",
  "branch": null
}
```

- `repo_url` (string, required): only `https://github.com/<owner>/<repo>` accepted
  (trailing slash and `.git` suffix tolerated).
- `branch` (string, optional): branch or tag name.

**Success - 201**

```json
{
  "repo_id": "ec5fa428-df6e-4297-8b1e-b9fceb4c447e",
  "repo_name": "Hello-World",
  "repo_url": "https://github.com/octocat/Hello-World",
  "default_branch": "master",
  "total_files": 1,
  "detected_languages": { "Unknown": 1 },
  "file_tree": [
    {
      "name": "README",
      "path": "README",
      "type": "file",
      "extension": "",
      "language": "Unknown",
      "size_bytes": 13
    }
  ],
  "warnings": []
}
```

Tree nodes: directories are `{name, path, type: "directory", children: [...]}`; files are
`{name, path, type: "file", extension, language, size_bytes}`. Directories sort before
files, alphabetical case-insensitive.

**Errors** - 422 `INVALID_REPO_URL`, 502 `CLONE_FAILED`, 504 `CLONE_TIMEOUT`.

Rejected URL examples: `git@github.com:owner/repo.git`, `http://github.com/...`,
`https://gitlab.com/...`, `https://github.com/owner/repo?x=1`, `https://github.com/owner`.

---

## GET /api/repositories/{repo_id}/tree

```bash
curl http://localhost:8000/api/repositories/<repo_id>/tree
```

Returns the same shape as clone (minus `default_branch` guaranteeing freshness of the
re-scan), re-scanning the workspace from disk.

**Errors** - 404 `REPOSITORY_NOT_FOUND` (unknown id or missing workspace).

---

## GET /api/repositories/{repo_id}/file?path=relative/path

```bash
curl "http://localhost:8000/api/repositories/<repo_id>/file?path=README"
```

**Success - 200**

```json
{
  "repo_id": "ec5fa428-df6e-4297-8b1e-b9fceb4c447e",
  "path": "README",
  "language": "Unknown",
  "content": "Hello World!\n",
  "line_count": 1,
  "size_bytes": 13
}
```

**Errors** - 404 `FILE_NOT_FOUND`, 403 `FORBIDDEN_PATH` (traversal, ignored/secret
files, lockfiles-as-AI-context), 415 `UNSUPPORTED_FILE_TYPE` (binary), 413
`FILE_TOO_LARGE` (> 1 MB).

---

## POST /api/chat

Ask a question grounded strictly in one file.

**Request**

```json
{
  "repo_id": "ec5fa428-df6e-4297-8b1e-b9fceb4c447e",
  "file_path": "README",
  "question": "What does this file contain?"
}
```

- `question` max 2,000 characters; `file_path` must pass the same eligibility rules as
  the file endpoint (plus lockfile exclusion and a 50,000-character AI context cap).

**Success - 200**

```json
{
  "answer": "This file contains a single line greeting...",
  "citations": [
    { "path": "README", "line_start": 1, "line_end": 1 }
  ],
  "model": "gpt-4o-mini"
}
```

Citations are clamped to the file's real line count. If the model returns unusable
output, a whole-file citation (`1..line_count`) is used as a safe fallback.

**Errors** - 503 `LLM_NOT_CONFIGURED`, 502 `LLM_UPSTREAM_ERROR`, 413
`FILE_TOO_LARGE_FOR_AI`, 403 `FORBIDDEN_PATH`, 404 `FILE_NOT_FOUND` /
`REPOSITORY_NOT_FOUND`, 422 `INVALID_REQUEST` (e.g. question too long).
