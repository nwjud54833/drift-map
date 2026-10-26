// Smoke tests for the bundled, plain-Node CLI in dist/cli.js.
// These run the entry point with node itself (not tsx) and assert the same
// exit-code contract as the CLI tests in frontend/tests/cli/driftmap.test.ts:
//   exit 1 for breaking changes, 0 with --fail-on off, exit 2 for bad input.
// Run `npm run build` first (the test script does not auto-build).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  const dir = mkdtempSync(join(process.env.TEMP || "/tmp", "driftmap-smoke-"));
  const bad = join(dir, "bad.json");
  writeFileSync(bad, "{not json");
  const r = run(["compare", bad, join(fixtures, "pair1-candidate.json")]);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /^error: /m);
});
