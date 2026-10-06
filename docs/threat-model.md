# Threat Model — Advanced Edition

Method: STRIDE-lite per trust boundary. Status per item: **mitigated** /
**partially mitigated** / **open (planned phase)**.

## Assets

- Host filesystem & secrets (`OPENAI_API_KEY`/`LLM_API_KEY`, GitHub tokens)
- Backend process, Postgres, Redis, Docker daemon (via runner only)
- Cloned repository data (untrusted), conversation data, approval audit trail

## Boundary 1: Browser → API

| Threat | Control | Status |
| --- | --- | --- |
| Cross-origin abuse | Strict CORS allow-list, no credentials | mitigated |
| Invalid IDs/paths | UUID validation, pathlib resolution inside sandbox | mitigated |
| Oversized requests | Field length limits (Pydantic); body limits planned (Phase 2) | partially mitigated |
| Public exposure | Local-first: bind loopback; no auth by design. Remote access requires an auth boundary (out of scope for local dev) | documented |

## Boundary 2: Ingested repository (untrusted code/data)

| Threat | Control | Status |
| --- | --- | --- |
| Code execution on clone/scan | Nothing executed; `.git` removed; pathlib-only scanning | mitigated |
| Path traversal / symlink escape | `resolve_safe_file_path` blocks `..`, absolute, drive, null, symlinks | mitigated (tested) |
| Secret exfiltration via LLM | Secret-like files filtered from scan/tree/context; log redaction | mitigated |
| Malicious ZIP (Zip Slip, bombs, symlinks) | Planned Phase 2: entry validation, size/ratio/count caps, reject encrypted | open (Phase 2) |
| Dependency-install execution (sandbox prep) | Separate approved step; disclosed; recorded provenance | open (Phase 7) |

## Boundary 3: LLM provider

| Threat | Control | Status |
| --- | --- | --- |
| Prompt injection via repo content | Data labeled/delimited as untrusted; least-privilege tools; server-side permission checks; approval gates. Prompt wording alone is **not** a guarantee | mitigated (defense-in-depth) |
| Fabricated citations | Server-side validation of citations against indexed snapshot | mitigated (Phase 4 onward) |
| Secret leakage in prompts | No secret-bearing context is ever assembled | mitigated |
| Model output as execution | Output is text/JSON only; never a shell command or file write | mitigated |
| Usage/cost fabrication | Usage reported only when provider returns it; estimates labeled | mitigated by design |

## Boundary 4: Sandbox / runner

| Threat | Control | Status |
| --- | --- | --- |
| Arbitrary container options from web backend | Runner is a separate service with a narrow validated job API; no Docker socket in the web backend | planned (Phase 7) |
| Container escape / hostile code | read-only rootfs, non-root, cap-drop-all, no-new-privileges, network off, tmpfs, CPU/RAM/pids/time caps | planned (Phase 7) |
| Host secret exposure to containers | No env passthrough, no mounts of home/ssh/docker.sock | planned (Phase 7) |
| Fallback to host execution | Never; if Docker is unavailable, execution is refused | policy |

> Docker isolation is risk reduction, **not** a guarantee against hostile code.
> Untrusted multi-user execution requires dedicated workers and further hardening.

## Boundary 5: Git/GitHub publication

| Threat | Control | Status |
| --- | --- | --- |
| Push to protected/default branch | Hard rule: forbidden; draft PRs only; explicit approval per operation | planned (Phase 8) |
| Token leakage | Tokens never in remotes/logs; fine-grained PAT guidance; masked status in UI | planned (Phase 8) |
| Approval replay after content change | Approvals bound to patch hash + base commit; hash change invalidates | planned (Phase 6) |

## Prompt-injection defense summary

Instructions and data are separated and labeled; retrieved chunks are treated as data;
tools are least-privilege and server-authorized; every consequential action requires
explicit human approval; citations are validated. No single control is sufficient;
the combination is the defense. Prompt wording alone cannot guarantee protection.
