# Tester guide

Thank you for trying `driftmap-cli`. One command, about five minutes. If you get
stuck, that is a finding too — see [Reporting a problem](#reporting-a-problem).

## 1. Get two payloads

Pick one endpoint you know well. You need its response from **before** your last
change and from **after** it, saved as two files:

```sh
curl -s https://api.example.com/orders/123 > after.json
```

For the "before" file, use a recorded response from an earlier deploy, a fixture
from your test suite, or a colleague's saved output. If you have no "before"
file, compare a staging response against a production one.

**Remove secrets before you run anything.** Strip tokens, cookies, session IDs,
and personal data — the tool does not need them, and you should not share them:

- Replace values with fake ones: `"token": "REDACTED"`, `"email": "user@example.test"`.
- Or drop those keys entirely with `jq`: `jq 'del(.token, .user.email)' raw.json > before.json`.
- Keep the same keys present in both files, or the tool will report them as
  added or removed.

Both files must be valid JSON under 2 MB. Arrays of responses are accepted if
you want several samples.

## 2. Run it

```sh
npx driftmap-cli@latest compare before.json after.json
```

Useful extras:

- `--fail-on off` — always exit `0`, so the run never fails your shell.
- `--format json` — machine-readable, good if you want to paste the result into
  a ticket.
- `--format markdown` — a report you can drop into a pull request.
- `--verbose` — shows the raw rule identifiers behind each finding.

Exit codes: `0` nothing at or above the threshold, `1` findings met it, `2` a
usage or input error.

## 3. Read the result

Findings are grouped by severity: **breaking**, **warning**, **safe**, **info**.
Breaking means a client that worked against the old response could break against
the new one — a removed field, a changed type, a value that is newly required.

## 4. Decide what to do

- **Fix it** — the change was not intended, so adjust the API.
- **Ignore it** — the change was intended. Note why, so the next person knows.
- **Ask a teammate** — you are unsure whether the consumers can take it. This is
  the most useful outcome to tell us about: what made it hard to judge?

## 5. Reporting a problem

Send us: the exact command you ran, the full output, and whether you can share
the two payloads. If you cannot share them, the output alone is usually enough.

Please do not include private API data, credentials, or customer records in the
report. Replace values with placeholders.

Then fill in [FEEDBACK_FORM.md](FEEDBACK_FORM.md).
