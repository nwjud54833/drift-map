# Security Model

## 1. No execution of cloned code

- Cloning uses GitPython's API against the host `git` binary only. No shell is involved,
  no `shell=True`, no command strings built from user input.
- Clones are `--depth 1 --single-branch`; `GIT_TERMINAL_PROMPT=0` and `GIT_ASKPASS=echo`
  prevent credential prompts from hanging requests.
- After cloning, the repository's `.git` directory is removed: hooks and git metadata
  are never present, let alone executed.
- Nothing in the codebase runs installs, builds, scripts, tests, or any executable from
  cloned repositories. There is no code path that would.

## 2. URL validation (`app/core/security.py`)

- Parsed with `urllib.parse.urlsplit`; scheme must be exactly `https`; host exactly
  `github.com` (IP literals, subdomains, and `github.com.evil.com` fail this check).
- Credentials, non-default ports, query strings, and fragments are rejected.
- Path must be exactly `owner/repository` after normalization (trailing slash and
  `.git` suffix tolerated; interior duplicate slashes rejected); reserved GitHub page
  paths (e.g. `/settings`) are rejected.
- The canonical clone URL is rebuilt from validated parts only.
- Remote execution surface: the validated URL is passed to GitPython; `allow_unsafe_protocols`
  stays `false` (default), so `ext::` style transports are refused by GitPython itself.

## 3. Path traversal controls

- `repo_id` must match the UUID grammar before it is ever used in a path.
- `resolve_safe_file_path` rejects: backslashes, colons (drive letters / NTFS streams),
  leading `/` or `~`, null bytes, and any `.`/`..` component — even ones that would
  resolve inside the repository.
- The resolved path must remain inside `workspace/<repo_id>/repo`; symlinked components
  pointing outside are blocked, and directory symlinks are skipped during scanning.
- The file service re-verifies containment after resolution and only ever returns
  repository-relative paths to clients.

## 4. File filters (`app/utils/file_filters.py`)

- Ignored directories: `.git`, `node_modules`, `.venv`, `venv`, `__pycache__`, `dist`,
  `build`, `.next`, `coverage`, `.pytest_cache`, `.mypy_cache`, `vendor`, `target`,
  `.idea`, `.vscode`.
- Ignored files: `.env`, `.env.*`, `*.env`, key material (`id_rsa`, `id_ed25519`,
  `*.pem`, `*.key`, `*.p12`, `*.pfx`, ...), credential stores.
- Binary extensions and null-byte/control-character sniffing exclude binary content.
- Lockfiles are visible in the tree but **never** sent to the LLM.
- Limits: 1 MB per file, 2,000 files, depth 12. Skips are reported as non-sensitive
  warning counts (never paths or contents).

## 5. LLM prompt-injection mitigation

- The selected file is embedded in a clearly delimited block (`=== BEGIN/END UNTRUSTED
  FILE DATA ===`) with line numbers, explicitly labeled as data, not instructions.
- The system prompt instructs the model to ignore embedded commands and never reveal
  hidden prompts, keys, or environment values.
- The model has **no tools** and no network/filesystem/git access; its entire capability
  is returning text.
- Output must be JSON (`response_format=json_object`, with a safe retry without it);
  it is parsed and Pydantic-validated. Citations are clamped to `[1, line_count]`;
  unusable output falls back to a whole-file citation rather than an error or a fake.
- Model output is used **only** as chat text — never as input to execution, writes,
  or further requests.
- Bounded context: questions capped at 2,000 characters; file context at 50,000.

## 6. Secret handling

- `OPENAI_API_KEY` is read only from the backend environment (`.env`, git-ignored);
  it is never exposed to the frontend, never logged, and never included in API
  responses.
- `.env` / `.env.local` are git-ignored; only `.example` files are committed.
- Logging uses standard levels with a best-effort redaction filter for key-shaped
  strings; call sites never log prompts, file contents, or secrets.
- Clone failures are logged by exception **type only** (no URLs, no stderr contents).

## 7. Known residual risks

- **Prompt injection is reduced, not eliminated.** A determined injection can still
  influence the *content* of an answer (e.g. persuasive text in the file). Impact is
  capped by design: the model cannot execute, write, or reach the network, and answers
  are confined to one file.
- The scanner trusts file **names** for filtering; an obscure encoding trick could
  hide a secret-named file from the tree, though such files also cannot be opened
  through the API because serving applies the same filters.
- LLM citations are clamped to valid ranges but the *content* they summarize may be
  inaccurate; treat answers as unverified commentary, not ground truth.
- The local workspace has no encryption or quota; anyone with local disk access can
  read cloned repositories (this is a single-user local tool by design).
- Dependency supply chain: no lockfile for Python (`requirements.txt` uses ranges);
  pin exact versions for stronger reproducibility.
