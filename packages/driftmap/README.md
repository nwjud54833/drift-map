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
  - uses: nwjud54833/drift-map@v2.5.10
    with:
      baseline-path: contracts/openapi-base.yaml
      candidate-path: contracts/openapi.yaml
      fail-on: breaking
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

For local development in this repository, the workflow example is [`.github/workflows/contract-review.yml`](../../.github/workflows/contract-review.yml). The action expects a `pull_request` event and a token with permission to write issue comments.

See a [live breaking-change PR with the posted DriftMap report](https://github.com/nwjud54833/drift-map/pull/12).

### Hosted workspace baseline

The CLI and Action can fetch a selected workspace baseline over HTTPS. From the signed-in Workbench, select a cloud workspace with a baseline and choose **Use in CI / GitHub Action** to issue a 90-day read URL and separate promotion token. Store the URL as `DRIFTMAP_BASELINE_URL` and the promotion token as `DRIFTMAP_PROMOTE_TOKEN` in GitHub Actions secrets. Read tokens only read the workspace's selected baseline. Promotion tokens only promote that workspace and are accepted only by `POST /api/v1/workspaces/<workspace-id>/baseline`.

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nwjud54833/drift-map@v2.5.10
    with:
      baseline-path: ${{ secrets.DRIFTMAP_BASELINE_URL }}
      candidate-path: contracts/openapi.yaml
      promote-on-push: true
      promote-token: ${{ secrets.DRIFTMAP_PROMOTE_TOKEN }}
      webhook-url: ${{ secrets.DRIFTMAP_WEBHOOK_URL }}
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

Trigger the workflow on `pull_request` and `push` to `main`. The Action compares on both events and promotes only after a successful `main` push when `promote-on-push: true`. Set `webhook-url` to an HTTPS Slack/Discord-compatible incoming webhook for best-effort breaking-drift and promotion notices; DriftMap rejects private or local destinations. The standalone CLI supports `--webhook-url` for comparisons and `driftmap promote <baseline-url> <candidate-file> --webhook-url <url>`. Hosted reads accept HTTPS URLs only, reject redirects, and are limited to 2 MB. URL tokens are redacted from report output and sent to the API as authorization headers.

## Exit codes

- `0` — no findings at or above the threshold (pass)
- `1` — findings at or above the threshold (fail)
- `2` — usage or input error (missing file, unparseable JSON, unsupported OpenAPI 3.1, oversize input)

## Repository

Documentation and source: <https://github.com/nwjud54833/drift-map>. Reporting issues: <https://github.com/nwjud54833/drift-map/issues>
