// Smoke tests for the bundled, plain-Node CLI in dist/cli.js.
// These run the entry point with node itself (not tsx) and assert the same
// exit-code contract as the CLI tests in frontend/tests/cli/driftmap.test.ts:
//   exit 1 for breaking changes, 0 with --fail-on off, exit 2 for bad input.
// Run `npm run build` first (the test script does not auto-build).
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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

test("both executable names ship and point at the bundled CLI", () => {
  const manifest = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
  assert.deepEqual(manifest.bin, {
    driftmap: "dist/cli.js",
    "driftmap-cli": "dist/cli.js",
  });
  // Both names must resolve to the file that is actually published.
  for (const target of Object.values(manifest.bin)) {
    assert.equal(existsSync(join(here, "..", target)), true, `${target} is missing`);
  }
});

test("pair1 fixture pair is breaking (exit 1)", () => {
  const r = run(["compare", join(fixtures, "pair1-baseline.json"), join(fixtures, "pair1-candidate.json")]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /^ {2}FAIL\b/m);
});

test("--color=always emits ANSI roles and --color=never emits none", () => {
  const args = ["compare", join(fixtures, "pair1-baseline.json"), join(fixtures, "pair1-candidate.json")];
  const colored = run(args, "always");
  assert.equal(colored.status, 1);
  assert.match(colored.stdout, /\u001b\[91mBreaking \(1\)/);
  assert.match(colored.stdout, /\u001b\[1;91mFAIL/);
  const plain = run(args, "never");
  assert.doesNotMatch(plain.stdout, /\u001b\[/);
});

test("--fail-on off turns a breaking pair into exit 0", () => {
  const r = run(["compare", "--fail-on", "off", join(fixtures, "pair1-baseline.json"), join(fixtures, "pair1-candidate.json")]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^ {2}PASS\b/m);
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

test("the shipped bundle prints its manifest version and stays within 80 columns", () => {
  const manifest = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
  const stripAnsi = (line) => line.replace(/\u001b\[[0-9;]*m/g, "");
  for (const side of ["pair1", "pair2"]) {
    for (const color of ["never", "always"]) {
      const r = run(["compare", join(fixtures, side + "-baseline.json"), join(fixtures, side + "-candidate.json"), "--fail-on", "off"], color);
      const lines = r.stdout.replace(/\n$/, "").split("\n");
      assert.equal(stripAnsi(lines[0]), `  driftmap ${manifest.version} \u00b7 compare`);
      for (const line of lines) {
        assert.ok(stripAnsi(line).length <= 80, `line over 80 columns: ${JSON.stringify(line)}`);
      }
    }
  }
});
