import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArguments, resolveColors, runCompare, USAGE } from "@/bin/driftmap";
import type { CompareOptions } from "@/bin/driftmap";
import { ANSI_CODES } from "@/bin/colors";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { buildMarkdownReportFromDiff } from "@/lib/contract/export";
import { inferContract } from "@/lib/contract/infer";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string) => path.join(fixturesDir, name);
const pair1 = { baselinePath: fixture("pair1-baseline.json"), candidatePath: fixture("pair1-candidate.json") };
const pair2 = { baselinePath: fixture("pair2-baseline.json"), candidatePath: fixture("pair2-candidate.json") };
const openapi = { baselinePath: fixture("openapi-baseline.json"), candidatePath: fixture("openapi-candidate.json") };

function options(overrides: Partial<CompareOptions> = {}): CompareOptions {
  return {
    baselinePath: pair1.baselinePath,
    candidatePath: pair1.candidatePath,
    direction: "response",
    failOn: "breaking",
    format: "text",
    outPath: null,
    quiet: false,
    verbose: false,
    color: "never",
    ...overrides,
  };
}

const ANSI_ESCAPE = /\u001b\[/;
const stripAnsi = (line: string) => line.replace(/\u001b\[[0-9;]*m/g, "");

describe("parseCliArguments", () => {
  it("accepts a full valid invocation", () => {
    const parsed = parseCliArguments([
      "compare", "a.json", "b.json",
      "--direction", "request",
      "--fail-on", "warning",
      "--format", "json",
      "--out", "drift.md",
      "--quiet",
      "--verbose",
      "--color", "always",
    ]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options).toEqual({
      baselinePath: "a.json",
      candidatePath: "b.json",
      direction: "request",
      failOn: "warning",
      format: "json",
      outPath: "drift.md",
      quiet: true,
      verbose: true,
      color: "always",
    });
  });

  it("applies the documented defaults", () => {
    const parsed = parseCliArguments(["compare", "a.json", "b.json"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.options.direction).toBe("response");
    expect(parsed.options.failOn).toBe("breaking");
    expect(parsed.options.format).toBe("text");
    expect(parsed.options.outPath).toBeNull();
    expect(parsed.options.quiet).toBe(false);
    expect(parsed.options.verbose).toBe(false);
    expect(parsed.options.color).toBe("auto");
  });

  it("treats --help as a valid no-op invocation", () => {
    const parsed = parseCliArguments(["--help"]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.help).toBe(true);
  });

  it("rejects missing file paths", () => {
    expect(parseCliArguments(["compare", "a.json"]).ok).toBe(false);
    expect(parseCliArguments(["compare"]).ok).toBe(false);
    expect(parseCliArguments([]).ok).toBe(false);
  });

  it("rejects unknown flags with a usage error", () => {
    const parsed = parseCliArguments(["compare", "a.json", "b.json", "--wat"]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message.length).toBeGreaterThan(0);
  });

  it("rejects commands other than compare", () => {
    const parsed = parseCliArguments(["bananas", "a.json", "b.json"]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("Unknown command");
  });

  it("rejects extra positional arguments", () => {
    const parsed = parseCliArguments(["compare", "a.json", "b.json", "c.json"]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("c.json");
  });

  it("rejects invalid enum values with the allowed list", () => {
    const parsed = parseCliArguments(["compare", "a.json", "b.json", "--direction", "upstream"]);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.message).toContain("--direction must be one of");

    const color = parseCliArguments(["compare", "a.json", "b.json", "--color", "rgb"]);
    expect(color.ok).toBe(false);
    if (color.ok) return;
    expect(color.message).toContain("--color must be one of auto, always, never");
  });
});

describe("runCompare exit codes and verdicts", () => {
  it("exits 1 when a breaking finding meets the default threshold", () => {
    const outcome = runCompare(options({ failOn: "breaking" }));
    expect(outcome.exitCode).toBe(1);
  });

  it("exits 0 for a warning-only pair when the threshold is breaking", () => {
    const outcome = runCompare(options({ ...pair2, failOn: "breaking" }));
    expect(outcome.exitCode).toBe(0);
  });

  it("exits 1 for a warning-only pair when the threshold is warning", () => {
    const outcome = runCompare(options({ ...pair2, failOn: "warning" }));
    expect(outcome.exitCode).toBe(1);
  });

  it("always exits 0 with --fail-on off, but still exits 2 on a parse error", () => {
    const clean = runCompare(options({ ...pair2, failOn: "off" }));
    expect(clean.exitCode).toBe(0);

    const broken = runCompare(options({ baselinePath: fixture("invalid.json"), failOn: "off" }));
    expect(broken.exitCode).toBe(2);
  });

  it("exits 1 when an OpenAPI comparison has a breaking schema change", () => {
    const outcome = runCompare(options({ ...openapi }));
    expect(outcome.exitCode).toBe(1);
  });

  for (const [failOn, baselinePaths, candidatePaths] of [
    ["breaking", pair2.baselinePath, pair2.candidatePath],
    ["warning", pair2.baselinePath, pair2.candidatePath],
    ["off", pair2.baselinePath, pair2.candidatePath],
  ] as const) {
    it(`renders a verdict that matches the exit code for --fail-on ${failOn}`, () => {
      const outcome = runCompare(options({ baselinePath: baselinePaths, candidatePath: candidatePaths, failOn }));
      const match = /RESULT: (PASS|FAIL) \(exit (\d)\)$/m.exec(outcome.output);
      expect(match).not.toBeNull();
      const expected = outcome.exitCode === 1 ? "FAIL" : "PASS";
      expect(match![1]).toBe(expected);
      expect(Number(match![2])).toBe(outcome.exitCode);
    });
  }
});

describe("input-type detection", () => {
  it("treats a single JSON object as one payload sample", () => {
    const outcome = runCompare(options({ ...pair1, verbose: true }));
    expect(outcome.output).toContain("baseline samples: 1 · candidate samples: 1");
  });

  it("treats a JSON array as multiple payload samples", () => {
    const outcome = runCompare(options({ ...pair2, verbose: true }));
    expect(outcome.output).toContain("baseline samples: 2 · candidate samples: 2");
  });

  it("routes OpenAPI documents through the OpenAPI parser (no payload samples)", () => {
    const outcome = runCompare(options({ ...openapi, verbose: true }));
    expect(outcome.output).toContain("baseline samples: none (OpenAPI) · candidate samples: none (OpenAPI)");
  });

  it("detects OpenAPI 3.0 YAML by content, not extension", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("openapi-baseline.yaml"),
      candidatePath: fixture("openapi-baseline.json"),
    }));
    expect(outcome.exitCode).toBe(0);
    expect(outcome.output).toContain("RESULT: PASS (exit 0)");
  });

  it("parses BOM-prefixed input (PowerShell 5.1 default)", () => {
    expect(readFileSync(fixture("pair1-baseline-bom.json"), "utf8").startsWith("﻿")).toBe(true);
    const withBom = runCompare(options({ baselinePath: fixture("pair1-baseline-bom.json") }));
    const withoutBom = runCompare(options());
    expect(withBom.exitCode).toBe(1);
    // The header line echoes the file names; everything else must be identical.
    const tail = (output: string) => output.split("\n").slice(1).join("\n");
    expect(tail(withBom.output)).toBe(tail(withoutBom.output));
  });

  it("reports missing files as a clear error", () => {
    const outcome = runCompare(options({ baselinePath: fixture("does-not-exist.json") }));
    expect(outcome.exitCode).toBe(2);
    const [errorLine, hintLine] = outcome.output.split("\n");
    expect(errorLine).toContain("error: Unable to read baseline:");
    expect(hintLine).toContain("hint:");
  });

  it("reports invalid JSON as a clear error, not a stack trace", () => {
    const outcome = runCompare(options({ baselinePath: fixture("invalid.json") }));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.output.startsWith("error: baseline: Unable to parse JSON")).toBe(true);
    expect(outcome.output).toContain("hint: fix the file's JSON syntax");
    expect(outcome.output).not.toContain("\n    at ");
  });

  it("rejects OpenAPI 3.1 documents with a clear error", () => {
    const outcome = runCompare(options({ baselinePath: fixture("openapi-31.json"), candidatePath: fixture("openapi-31.json") }));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.output).toContain("OpenAPI 3.1 is not supported yet");
    expect(outcome.output).toContain("hint: convert the document to OpenAPI 3.0");
  });

  it("enforces the shared 2 MB input cap with a clear error", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "driftmap-cap-"));
    try {
      const oversized = path.join(dir, "oversized.json");
      writeFileSync(oversized, `{"pad":"${"x".repeat(3 * 1024 * 1024)}"}`);
      expect(statSync(oversized).size).toBeGreaterThan(2 * 1024 * 1024);
      const outcome = runCompare(options({ baselinePath: oversized }));
      expect(outcome.exitCode).toBe(2);
      expect(outcome.output).toContain("error: baseline is");
      expect(outcome.output).toContain("hint: trim the payload or export fewer samples");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("text presentation", () => {
  const GOLDEN = [
    "driftmap compare  pair1-baseline.json → pair1-candidate.json",
    "response · fail on breaking",
    "  1 breaking   0 warning   0 safe   0 info        RESULT: FAIL (exit 1)",
    "",
    "  [!!] BREAKING (1)",
    "    POINTER       CHANGE        BEFORE  AFTER",
    "    /customer/id  Type changed  string  number",
  ].join("\n");

  it("matches the golden layout for the pair1 defaults", () => {
    const outcome = runCompare(options({ ...pair1 }));
    expect(outcome.output).toBe(GOLDEN);
  });

  it("omits empty severity groups", () => {
    const outcome = runCompare(options({ ...pair1 }));
    expect(outcome.output).toContain("[!!] BREAKING (1)");
    expect(outcome.output).not.toContain("WARNING");
    expect(outcome.output).not.toContain("SAFE");
    expect(outcome.output).not.toContain("INFO (");
  });

  it("shows the human change label, not the rule ID, by default", () => {
    const outcome = runCompare(options({ ...pair1 }));
    expect(outcome.output).toContain("Type changed");
    expect(outcome.output).not.toContain("RULE_WIRE_TYPE_CHANGED");
  });

  it("renders severity groups in order with pointers sorted inside each group", () => {
    const outcome = runCompare(options({ ...openapi }));
    const breakingIndex = outcome.output.indexOf("[!!] BREAKING (1)");
    const warningIndex = outcome.output.indexOf("[~ ] WARNING (1)");
    expect(breakingIndex).toBeGreaterThan(0);
    expect(warningIndex).toBeGreaterThan(breakingIndex);
    expect(outcome.output).toContain("Response schema changed");
  });

  it("shows the [ok] safe and [i ] info markers when those groups have findings", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "driftmap-safe-"));
    try {
      const baseline = path.join(dir, "baseline.json");
      const candidate = path.join(dir, "candidate.json");
      writeFileSync(baseline, JSON.stringify([{ orderId: "o1", giftWrap: true, items: [{ sku: "A" }] }]));
      writeFileSync(candidate, JSON.stringify([
        { orderId: "o1", note: "hi", giftWrap: true, items: [{ sku: "A" }] },
        { orderId: "o2", items: [{ sku: "A" }] },
      ]));
      const outcome = runCompare(options({ baselinePath: baseline, candidatePath: candidate, failOn: "off" }));
      expect(outcome.output).toContain("[ok] SAFE (1)");
      expect(outcome.output).toContain("[i ] INFO (1)");
      expect(outcome.output).toContain("Optional field added");
      expect(outcome.output).toContain("Required became optional");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("truncates long pointers from the left with … without exceeding 80 columns", () => {
    const outcome = runCompare(options({ ...openapi }));
    for (const line of outcome.output.split("\n")) {
      expect([...stripAnsi(line)].length).toBeLessThanOrEqual(80);
    }
    expect(outcome.output).toContain("…");
  });

  it("--quiet prints exactly one plain verdict line", () => {
    for (const paths of [pair1, pair2]) {
      const outcome = runCompare(options({ ...paths, quiet: true, color: "always" }));
      expect(outcome.output.split("\n").filter((line) => line.length > 0).length).toBe(1);
      expect(outcome.output).toMatch(/^RESULT: (PASS|FAIL) \(exit [012]\)$/);
      expect(ANSI_ESCAPE.test(outcome.output)).toBe(false);
    }
  });

  it("--verbose shows raw RULE_* IDs and sample counts", () => {
    const outcome = runCompare(options({ ...pair1, verbose: true }));
    expect(outcome.output).toContain("RULE_WIRE_TYPE_CHANGED");
    expect(outcome.output).toContain("baseline samples: 1 · candidate samples: 1");
    expect(outcome.output).toContain("Type changed");
  });
});

describe("color handling", () => {
  afterEach(() => {
    delete process.env.NO_COLOR;
  });

  it("keeps the palette on standard foreground, bold, and dim SGR codes", () => {
    expect(ANSI_CODES).toEqual({
      verdictFail: "\u001b[1;91m",
      verdictPass: "\u001b[1;92m",
      breaking: "\u001b[91m",
      warning: "\u001b[93m",
      safe: "\u001b[32m",
      info: "\u001b[96m",
      pointer: "\u001b[1;97m",
      dim: "\u001b[2m",
    });
  });

  it("uses no ANSI codes with --color=never, without a TTY, or with NO_COLOR set", () => {
    expect(process.stdout.isTTY).not.toBe(true);
    expect(ANSI_ESCAPE.test(runCompare(options({ ...pair1, color: "never" })).output)).toBe(false);
    process.env.NO_COLOR = "1";
    expect(ANSI_ESCAPE.test(runCompare(options({ ...pair1, color: "auto" })).output)).toBe(false);
    delete process.env.NO_COLOR;
    // No TTY under the test runner: auto resolves to plain even without NO_COLOR.
    expect(ANSI_ESCAPE.test(runCompare(options({ ...pair1, color: "auto" })).output)).toBe(false);
  });

  it("--color=always emits ANSI codes even when piped", () => {
    const outcome = runCompare(options({ ...pair1, color: "always" }));
    expect(ANSI_ESCAPE.test(outcome.output)).toBe(true);
    process.env.NO_COLOR = "1";
    // An explicit --color=always overrides the environment.
    expect(ANSI_ESCAPE.test(runCompare(options({ ...pair1, color: "always" })).output)).toBe(true);
  });

  it("resolveColors honours the mode matrix", () => {
    process.env.NO_COLOR = "1";
    expect(resolveColors("never")).toBe(false);
    expect(resolveColors("auto")).toBe(false);
    expect(resolveColors("always")).toBe(true);
  });

  it("--color=auto turns color ON for a TTY with NO_COLOR unset", () => {
    // The test runner is never a TTY, so stand in for a real terminal (Windows
    // Terminal, PowerShell, or any VT-capable console) to exercise the
    // positive half of the auto rule.
    const original = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");
    try {
      Object.defineProperty(process.stdout, "isTTY", { value: true, configurable: true });
      delete process.env.NO_COLOR;
      expect(resolveColors("auto")).toBe(true);
      expect(ANSI_ESCAPE.test(runCompare(options({ ...pair1, color: "auto" })).output)).toBe(true);

      // NO_COLOR still wins over an auto-detected TTY.
      process.env.NO_COLOR = "1";
      expect(resolveColors("auto")).toBe(false);
      expect(ANSI_ESCAPE.test(runCompare(options({ ...pair1, color: "auto" })).output)).toBe(false);
    } finally {
      delete process.env.NO_COLOR;
      if (original) Object.defineProperty(process.stdout, "isTTY", original);
      else delete (process.stdout as { isTTY?: boolean }).isTTY;
    }
  });

  it("keeps JSON output free of ANSI codes even with --color=always", () => {
    const outcome = runCompare(options({ ...pair1, format: "json", color: "always" }));
    expect(ANSI_ESCAPE.test(outcome.output)).toBe(false);
  });

  it("keeps Markdown output free of ANSI codes and still valid with --color=always", () => {
    const always = runCompare(options({ ...pair2, format: "markdown", color: "always" }));
    const never = runCompare(options({ ...pair2, format: "markdown", color: "never" }));
    expect(ANSI_ESCAPE.test(always.output)).toBe(false);
    // Color mode never leaks into the report: both modes emit the same bytes.
    expect(always.output).toBe(never.output);
    // Still parseable Markdown: the document heading, its sections, and the
    // per-change definition list the report generator emits.
    expect(always.output).toMatch(/^# Contract Drift Report$/m);
    expect(always.output).toMatch(/^## Summary$/m);
    expect(always.output).toMatch(/^## Changes$/m);
    expect(always.output).toMatch(/^### WARNING · `/m);
    expect(always.output).toMatch(/^- \*\*Change:\*\* /m);
  });

  it("colors each severity marker and heading with its role", () => {
    const breaking = runCompare(options({ ...pair1, color: "always" })).output;
    expect(breaking).toContain(`${ANSI_CODES.breaking}[!!]`);
    expect(breaking).toContain(`${ANSI_CODES.breaking}BREAKING`);

    const warning = runCompare(options({ ...openapi, color: "always" })).output;
    expect(warning).toContain(`${ANSI_CODES.warning}[~ ]`);
    expect(warning).toContain(`${ANSI_CODES.warning}WARNING`);

    const dir = mkdtempSync(path.join(tmpdir(), "driftmap-colors-"));
    try {
      const baseline = path.join(dir, "baseline.json");
      const candidate = path.join(dir, "candidate.json");
      writeFileSync(baseline, JSON.stringify([{ orderId: "o1", giftWrap: true, items: [{ sku: "A" }] }]));
      writeFileSync(candidate, JSON.stringify([
        { orderId: "o1", note: "hi", giftWrap: true, items: [{ sku: "A" }] },
        { orderId: "o2", items: [{ sku: "A" }] },
      ]));
      const rest = runCompare(options({ baselinePath: baseline, candidatePath: candidate, failOn: "off", color: "always" })).output;
      expect(rest).toContain(`${ANSI_CODES.safe}[ok]`);
      expect(rest).toContain(`${ANSI_CODES.safe}SAFE`);
      expect(rest).toContain(`${ANSI_CODES.info}[i ]`);
      expect(rest).toContain(`${ANSI_CODES.info}INFO`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("colors the verdict and summary counts by severity", () => {
    const fail = runCompare(options({ ...pair1, color: "always" })).output;
    expect(fail).toContain(`${ANSI_CODES.verdictFail}RESULT: FAIL (exit 1)`);
    expect(fail).toContain(`${ANSI_CODES.breaking}1 breaking`);

    const pass = runCompare(options({ ...pair2, failOn: "off", color: "always" })).output;
    expect(pass).toContain(`${ANSI_CODES.verdictPass}RESULT: PASS (exit 0)`);
    expect(pass).toContain(`${ANSI_CODES.warning}2 warning`);
  });

  it("colors the pointer column and dims the header rows", () => {
    const outcome = runCompare(options({ ...pair1, color: "always" })).output;
    const lines = outcome.split("\n");
    expect(outcome).toContain(`${ANSI_CODES.pointer}/customer/id`);
    expect(lines[0]).toContain(ANSI_CODES.dim);
    expect(lines[1]).toContain(ANSI_CODES.dim);
    const columnHeader = lines.find((line) => line.includes("POINTER"));
    expect(columnHeader).toBeDefined();
    expect(columnHeader).toContain(ANSI_CODES.dim);
    expect(columnHeader).toContain("CHANGE");
    expect(columnHeader).toContain("BEFORE");
    expect(columnHeader).toContain("AFTER");
  });

  it("dims absent/missing types except a missing AFTER in a breaking group", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "driftmap-type-colors-"));
    try {
      const removedBaseline = path.join(dir, "removed-baseline.json");
      const removedCandidate = path.join(dir, "removed-candidate.json");
      writeFileSync(removedBaseline, JSON.stringify({ id: "1", name: "x", tag: "t" }));
      writeFileSync(removedCandidate, JSON.stringify({ id: "1", tag: "t" }));
      const removed = runCompare(options({ baselinePath: removedBaseline, candidatePath: removedCandidate, color: "always" })).output;
      expect(removed).toContain(`${ANSI_CODES.breaking}missing`);

      const addedBaseline = path.join(dir, "added-baseline.json");
      const addedCandidate = path.join(dir, "added-candidate.json");
      writeFileSync(addedBaseline, JSON.stringify({ id: "1" }));
      writeFileSync(addedCandidate, JSON.stringify({ id: "1", note: "x" }));
      const added = runCompare(options({ baselinePath: addedBaseline, candidatePath: addedCandidate, color: "always" })).output;
      expect(added).toContain(`${ANSI_CODES.dim}absent`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps every visible line within 80 columns with color on and off", () => {
    const plain = runCompare(options({ ...openapi, color: "never" })).output;
    const colored = runCompare(options({ ...openapi, color: "always" })).output;
    expect(stripAnsi(colored)).toBe(plain);
    for (const output of [plain, colored]) {
      for (const line of output.split("\n")) {
        expect([...stripAnsi(line)].length).toBeLessThanOrEqual(80);
      }
    }
    const coloredLines = colored.split("\n");
    expect(coloredLines.some((line) => line.length > stripAnsi(line).length)).toBe(true);
  });
});

describe("output formats", () => {
  it("renders the documented stable JSON shape exactly", () => {
    const outcome = runCompare(options({ format: "json" }));
    expect(JSON.parse(outcome.output)).toEqual({
      summary: { breaking: 1, warning: 0, safe: 0, info: 0 },
      changes: [
        {
          pointer: "/customer/id",
          kind: "type-changed",
          severity: "breaking",
          rule: "RULE_WIRE_TYPE_CHANGED",
          before: "string",
          after: "number",
        },
      ],
    });
  });

  it("renders Markdown identical to the pure report generator fed through the same engine pipeline", () => {
    const input = { baseline: fixture("pair2-baseline.json"), candidate: fixture("pair2-candidate.json") };
    const outcome = runCompare(options({ baselinePath: input.baseline, candidatePath: input.candidate, format: "markdown" }));

    const baselineArtifact = parseImportArtifact(readFileSync(input.baseline, "utf8"), { source: "file" });
    const candidateArtifact = parseImportArtifact(readFileSync(input.candidate, "utf8"), { source: "file" });
    expect(baselineArtifact.ok && candidateArtifact.ok).toBe(true);
    if (!baselineArtifact.ok || !candidateArtifact.ok) return;
    const baselineValue = baselineArtifact.artifact;
    const candidateValue = candidateArtifact.artifact;
    if (baselineValue.format !== "samples" || candidateValue.format !== "samples") return;
    const changes = compareContracts(inferContract(baselineValue.samples), inferContract(candidateValue.samples), "response");
    const expected = buildMarkdownReportFromDiff({
      workspaceName: "DriftMap CLI comparison",
      baselineLabel: input.baseline,
      candidateLabel: input.candidate,
      direction: "response",
      baselineSamples: baselineValue.samples.length,
      candidateSamples: candidateValue.samples.length,
      diff: buildDiff(input.baseline, input.candidate, "response", changes),
    });
    expect(outcome.output).toBe(expected);
  });

  it("documents the usage text with the new flags", () => {
    expect(USAGE).toContain("driftmap-cli compare <baseline> <candidate>");
    expect(USAGE).toContain("Installed commands: driftmap-cli, driftmap");
    expect(USAGE).toContain("--fail-on <breaking|warning|off>");
    expect(USAGE).toContain("--quiet");
    expect(USAGE).toContain("--verbose");
    expect(USAGE).toContain("--color <auto|always|never>");
    expect(USAGE).toContain("Exit codes:");
  });
});
