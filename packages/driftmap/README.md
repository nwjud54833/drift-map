# driftmap-cli

Command-line tool that detects API drift by comparing two JSON payloads (or OpenAPI 3.0 documents) inferred against each other as contracts. It is the CLI's presentation of the DriftMap engine; the full documentation lives in the repo: <https://github.com/nwjud54833/drift-map>.

> The name `driftmap` on npm belongs to an unrelated project. Install and run `driftmap-cli`.

## Install

Requires Node.js 20 or newer.

```sh
npx driftmap-cli compare baseline.json candidate.json
```

or add it to a project:

```sh
npm install --save-dev driftmap-cli
```

Installing the package also provides a second command, `driftmap`, with the same behavior as `driftmap-cli`. The npm name `driftmap` belongs to an unrelated package, so install `driftmap-cli` exactly.

## Quick start

```sh
npx driftmap-cli compare order_v1.json order_v2.json
npx driftmap-cli compare --fail-on warning openapi-a.json samples.json
npx driftmap-cli compare --format json order_v1.json order_v2.json > diff.json
```

Detect breaking changes between two payload snapshots or OpenAPI 3.0 (JSON or YAML) specs. Compare result as text, JSON, or Markdown.

## Flags

- `--direction` `request|response|event` — which side the payloads describe
- `--fail-on` `breaking|warning|off` — threshold for the exit code (default `breaking`)
- `--format` `text|json|markdown` — output format (default `text`)
- `--out` — write the report to a file instead of stdout
- `--quiet` — print only the verdict line (for scripts)
- `--verbose` — include raw `RULE_*` identifiers and sample counts
- `--color` `auto|always|never` — ANSI colors; `auto` enables them only on a TTY. `--quiet` stays plain even under `--color=always`.

## Exit codes

- `0` — no findings at or above the threshold (pass)
- `1` — findings at or above the threshold (fail)
- `2` — usage or input error (missing file, unparseable JSON, unsupported OpenAPI 3.1, oversize input)

## Repository

Documentation and source: <https://github.com/nwjud54833/drift-map>. Reporting issues: <https://github.com/nwjud54833/drift-map/issues>
