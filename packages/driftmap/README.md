# driftmap-cli

Command-line tool that detects API drift by comparing two JSON payloads (or OpenAPI 3.0 documents) inferred against each other as contracts. It is the CLI's presentation of the DriftMap engine; the full documentation lives in the repo: <https://github.com/nwjud54833/drift-map>.

> The name `driftmap` on npm belongs to an unrelated project. Install and run `driftmap-cli`.

## Install

Requires Node.js 20 or newer.

```sh
npx driftmap-cli diff baseline.json candidate.json
```

or add it to a project:

```sh
npm install --save-dev driftmap-cli
```

## Quick start

```sh
npx driftmap-cli diff order_v1.json order_v2.json
npx driftmap-cli diff --fail-on warning openapi-a.json samples.json
npx driftmap-cli diff --format json order_v1.json order_v2.json > diff.json
npx driftmap-cli diff 'samples/v1/**/*.json' 'samples/v2/**/*.json'
```

Detect breaking changes between two payload snapshots or OpenAPI 3.0 (JSON or YAML) specs. Compare result as text, JSON, or Markdown.

## Flags

- `--direction` `request|response|event` — which side the payloads describe
- `--fail-on` `breaking|warning|off` — threshold for the exit code (default `breaking`)
- `--format` `text|json|markdown` — output format (default `text`)
- `--config` — optional JSON file mapping `RULE_*` IDs to `breaking|warning|safe|info`
- `--out` — write the report to a file instead of stdout
- `--quiet` — print only the verdict line (for scripts)
- `--verbose` — include raw `RULE_*` identifiers and sample counts
- `--color` `auto|always|never` — ANSI colors; `auto` enables them only on a TTY. `--quiet` stays plain even under `--color=always`.

JSON sample inputs can be passed as glob patterns (`*`, `**`, `?`, and character classes). All matched sample files are combined before contract inference. OpenAPI files must be passed individually.

`compare` remains a backwards-compatible alias for `diff`.

## GitHub Action

The repository root includes a composite Action that builds this CLI, posts or updates one sticky PR comment, and returns the comparison's gate status. Grant the workflow `pull-requests: write` permission:

```yaml
permissions:
  contents: read
  pull-requests: write

steps:
  - uses: actions/checkout@v4
  - uses: nwjud54833/drift-map@v2.5.2
    with:
      baseline-path: contracts/openapi-base.yaml
      candidate-path: contracts/openapi.yaml
      fail-on: breaking
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

For local development in this repository, the workflow example is [`.github/workflows/contract-review.yml`](../../.github/workflows/contract-review.yml). The action expects a `pull_request` event and a token with permission to write issue comments.

See a [live breaking-change PR with the posted DriftMap report](https://github.com/nwjud54833/drift-map/pull/12).

### Hosted workspace baseline

The CLI and Action can fetch a selected workspace baseline over HTTPS. The workspace owner signs in and requests a 90-day read token with `POST /api/v1/workspaces/<workspace-id>/baseline/token`; store that token as the Actions secret `DRIFTMAP_BASELINE_TOKEN`. Tokens are scoped to one workspace and can only read its currently selected baseline. The baseline endpoint requires either the owner session or this bearer token.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nwjud54833/drift-map@v2.5.2
    with:
      baseline-path: https://driftmap.in/api/v1/workspaces/00000000-0000-4000-8000-000000000001/baseline
      candidate-path: contracts/openapi.yaml
      baseline-token: ${{ secrets.DRIFTMAP_BASELINE_TOKEN }}
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

For the CLI, set `DRIFTMAP_BASELINE_TOKEN` in the environment and pass the same endpoint to `--baseline`. Hosted reads accept HTTPS URLs only, reject redirects, and are limited to 2 MB.

## Exit codes

- `0` — no findings at or above the threshold (pass)
- `1` — findings at or above the threshold (fail)
- `2` — usage or input error (missing file, unparseable JSON, unsupported OpenAPI 3.1, oversize input)

## Repository

Documentation and source: <https://github.com/nwjud54833/drift-map>. Reporting issues: <https://github.com/nwjud54833/drift-map/issues>
