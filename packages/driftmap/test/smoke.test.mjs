// Smoke tests for the bundled, plain-Node CLI in dist/cli.js.
// These run the entry point with node itself (not tsx) and assert the same
// exit-code contract as the CLI tests in frontend/tests/cli/driftmap.test.ts:
//   exit 1 for breaking changes, 0 with --fail-on off, exit 2 for bad input.
// `npm test` builds the distributable before exercising it with plain Node.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const cli = join(here, "..", "dist", "cli.js");
const fixtures = join(
  here,
  "..",
  "..",
  "..",
  "frontend",
  "tests",
  "cli",
  "fixtures",
);

function run(args, color = "never") {
  // Default to color off so assertions do not depend on ANSI escapes; the
  // environment is never a TTY under node:test.
  return spawnSync(process.execPath, [cli, ...args, "--color", color], {
    encoding: "utf8",
  });
}

test("dist/cli.js keeps the node shebang as its first line", () => {
  const firstLine = readFileSync(cli, "utf8").split("\n")[0];
  assert.equal(firstLine, "#!/usr/bin/env node");
});

test("pair1 fixture pair is breaking (exit 1)", () => {
  const r = run(["compare", join(fixtures, "pair1-baseline.json"), join(fixtures, "pair1-candidate.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /RESULT: FAIL \(exit 1\)/);
});

test("--color=always emits ANSI roles and --color=never emits none", () => {
  const args = ["compare", join(fixtures, "pair1-baseline.json"), join(fixtures, "pair1-candidate.json")];
  const colored = run(args, "always");
  assert.equal(colored.status, 1);
  assert.match(colored.stdout, /\u001b\[91m\[!!\]/);
  assert.match(colored.stdout, /\u001b\[1;91mRESULT: FAIL \(exit 1\)/);
  const plain = run(args, "never");
  assert.doesNotMatch(plain.stdout, /\u001b\[/);
});

test("--fail-on off turns a breaking pair into exit 0", () => {
  const r = run(["compare", "--fail-on", "off", join(fixtures, "pair1-baseline.json"), join(fixtures, "pair1-candidate.json")]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /RESULT: PASS \(exit 0\)/);
});

for (const side of ["pair1", "pair2"]) {
  test(`inferred sample pair ${side} exits 0 when nothing fails`, () => {
    const r = run(["compare", join(fixtures, `${side}-baseline.json`), join(fixtures, `${side}-candidate.json`), "--fail-on", "off"]);
    assert.equal(r.status, 0);
  });
}

test("invalid JSON input is a usage error (exit 2)", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-smoke-"));
  try {
    const bad = join(dir, "bad.json");
    writeFileSync(bad, "{not json");
    const r = run(["diff", bad, join(fixtures, "pair1-candidate.json")]);
    assert.equal(r.status, 2);
    assert.match(r.stdout, /^error: /m);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("removing a required field fails the breaking threshold", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-breaking-"));
  try {
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    writeFileSync(baseline, JSON.stringify({ id: "1", requiredName: "Ada" }));
    writeFileSync(candidate, JSON.stringify({ id: "1" }));
    const r = run(["diff", baseline, candidate, "--fail-on", "breaking"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /BREAKING/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a newly nullable field is warning-only unless the warning threshold is selected", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-nullable-"));
  try {
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    writeFileSync(baseline, JSON.stringify([{ id: "1", quantity: 2 }]));
    writeFileSync(candidate, JSON.stringify([{ id: "1", quantity: 2 }, { id: "2", quantity: null }]));
    const defaultThreshold = run(["diff", baseline, candidate]);
    assert.equal(defaultThreshold.status, 0);
    assert.match(defaultThreshold.stdout, /WARNING/);
    const warningThreshold = run(["diff", baseline, candidate, "--fail-on", "warning"]);
    assert.equal(warningThreshold.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("widening a field type is classified as breaking", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-type-widening-"));
  try {
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    writeFileSync(baseline, JSON.stringify([{ id: "1", quantity: 2 }]));
    writeFileSync(candidate, JSON.stringify([{ id: "1", quantity: 2 }, { id: "2", quantity: "unknown" }]));
    const defaultThreshold = run(["diff", baseline, candidate]);
    assert.equal(defaultThreshold.status, 1);
    assert.match(defaultThreshold.stdout, /BREAKING/);
    const warningThreshold = run(["diff", baseline, candidate, "--fail-on", "warning"]);
    assert.equal(warningThreshold.status, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("adding an optional field is safe and passes the breaking threshold", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-safe-"));
  try {
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    writeFileSync(baseline, JSON.stringify({ id: "1" }));
    writeFileSync(candidate, JSON.stringify([{ id: "1", note: "hello" }, { id: "2" }]));
    const r = run(["diff", baseline, candidate]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /SAFE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("globbed JSON samples are combined and Markdown renders a findings table", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-glob-"));
  try {
    const baselineDir = join(dir, "base");
    const candidate = join(dir, "candidate.json");
    mkdirSync(baselineDir);
    writeFileSync(join(baselineDir, "one.json"), JSON.stringify({ id: "1", name: "Ada" }));
    writeFileSync(join(baselineDir, "two.json"), JSON.stringify({ id: "2", name: "Lin" }));
    writeFileSync(candidate, JSON.stringify({ id: "1" }));
    const r = run(["diff", join(baselineDir, "*.json"), candidate, "--format", "markdown"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /<!-- driftmap-contract-review -->/);
    assert.match(r.stdout, /\| Severity \| Path \| Change \| Baseline \| Candidate \| Explanation \|/);
    assert.match(r.stdout, /\| BREAKING \|/);
    assert.match(r.stdout, /2 samples from 2 files/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Markdown table cells escape HTML and table delimiters from input", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-markdown-"));
  try {
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    writeFileSync(baseline, JSON.stringify({ "<script>|x": "value" }));
    writeFileSync(candidate, JSON.stringify({ id: "1" }));
    const r = run(["diff", baseline, candidate, "--format", "markdown"]);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /&lt;script&gt;\\\|x/);
    assert.doesNotMatch(r.stdout, /<script>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("config can tune a known rule severity", () => {
  const dir = mkdtempSync(join(tmpdir(), "driftmap-config-"));
  try {
    const baseline = join(dir, "baseline.json");
    const candidate = join(dir, "candidate.json");
    const config = join(dir, "driftmap.json");
    writeFileSync(baseline, JSON.stringify({ id: "1", name: "Ada" }));
    writeFileSync(candidate, JSON.stringify({ id: "1" }));
    writeFileSync(config, JSON.stringify({ rules: { RULE_REQUIRED_FIELD_REMOVED: "warning" } }));
    const r = run(["diff", baseline, candidate, "--config", config, "--fail-on", "breaking"]);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /WARNING/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
