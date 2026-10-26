import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArguments, runCompare, USAGE } from "@/bin/driftmap";
import type { CompareOptions } from "@/bin/driftmap";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { buildMarkdownReportFromDiff } from "@/lib/contract/export";
import { inferContract } from "@/lib/contract/infer";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const fixture = (name: string) => path.join(fixturesDir, name);

function options(overrides: Partial<CompareOptions> = {}): CompareOptions {
  return {
    baselinePath: fixture("pair1-baseline.json"),
    candidatePath: fixture("pair1-candidate.json"),
    direction: "response",
    failOn: "breaking",
    format: "text",
    outPath: null,
    ...overrides,
  };
}

describe("parseCliArguments", () => {
  it("accepts a full valid invocation", () => {
    const parsed = parseCliArguments([
      "compare", "a.json", "b.json",
      "--direction", "request",
      "--fail-on", "warning",
      "--format", "json",
      "--out", "drift.md",
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
  });
});

describe("runCompare exit codes", () => {
  it("exits 1 when a breaking finding meets the default threshold", () => {
    const outcome = runCompare(options({ failOn: "breaking" }));
    expect(outcome.exitCode).toBe(1);
  });

  it("exits 0 for a warning-only pair when the threshold is breaking", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("pair2-baseline.json"),
      candidatePath: fixture("pair2-candidate.json"),
      failOn: "breaking",
    }));
    expect(outcome.exitCode).toBe(0);
  });

  it("exits 1 for a warning-only pair when the threshold is warning", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("pair2-baseline.json"),
      candidatePath: fixture("pair2-candidate.json"),
      failOn: "warning",
    }));
    expect(outcome.exitCode).toBe(1);
  });

  it("always exits 0 with --fail-on off, but still exits 2 on a parse error", () => {
    const clean = runCompare(options({
      baselinePath: fixture("pair2-baseline.json"),
      candidatePath: fixture("pair2-candidate.json"),
      failOn: "off",
    }));
    expect(clean.exitCode).toBe(0);

    const broken = runCompare(options({
      baselinePath: fixture("invalid.json"),
      failOn: "off",
    }));
    expect(broken.exitCode).toBe(2);
  });

  it("exits 1 when an OpenAPI comparison has a breaking schema change", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("openapi-baseline.json"),
      candidatePath: fixture("openapi-candidate.json"),
    }));
    expect(outcome.exitCode).toBe(1);
  });
});

describe("input-type detection", () => {
  it("treats a single JSON object as one payload sample", () => {
    const outcome = runCompare(options());
    expect(outcome.output).toContain("pair1-baseline.json · 1 sample");
  });

  it("treats a JSON array as multiple payload samples", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("pair2-baseline.json"),
      candidatePath: fixture("pair2-candidate.json"),
      failOn: "warning",
      format: "text",
    }));
    expect(outcome.output).toContain("pair2-baseline.json · 2 samples");
  });

  it("routes OpenAPI 3.0 JSON documents through the OpenAPI parser", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("openapi-baseline.json"),
      candidatePath: fixture("openapi-candidate.json"),
      format: "text",
    }));
    expect(outcome.output).toContain(baselineDescription(fixture("openapi-baseline.json")));
    expect(outcome.output).toContain("BREAKING (1)");
  });

  it("detects OpenAPI 3.0 YAML by content, not extension", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("openapi-baseline.yaml"),
      candidatePath: fixture("openapi-baseline.json"),
    }));
    expect(outcome.exitCode).toBe(0);
    expect(outcome.output).toContain("No contract drift detected between the two inputs.");
  });

  it("reports invalid JSON as a clear error, not a stack trace", () => {
    const outcome = runCompare(options({ baselinePath: fixture("invalid.json") }));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.output).toContain("Unable to parse JSON");
    expect(outcome.output).not.toContain("\n    at ");
  });

  it("rejects OpenAPI 3.1 documents with a clear error", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("openapi-31.json"),
      candidatePath: fixture("openapi-31.json"),
    }));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.output).toContain("OpenAPI 3.1 is not supported yet");
  });

  it("reports missing files as a clear error", () => {
    const missing = fixture("does-not-exist.json");
    const outcome = runCompare(options({ baselinePath: missing }));
    expect(outcome.exitCode).toBe(2);
    expect(outcome.output).toContain("Unable to read baseline");
    expect(outcome.output).not.toContain("at ");
  });

  it("enforces the shared 2 MB input cap", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "driftmap-cap-"));
    try {
      const oversized = path.join(dir, "oversized.json");
      writeFileSync(oversized, `{"pad":"${"x".repeat(3 * 1024 * 1024)}"}`);
      expect(statSync(oversized).size).toBeGreaterThan(2 * 1024 * 1024);
      const outcome = runCompare(options({ baselinePath: oversized }));
      expect(outcome.exitCode).toBe(2);
      expect(outcome.output).toContain("2 MB");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("output formats", () => {
  it("renders a text summary grouped by severity, with pointers, rules and before/after types", () => {
    const outcome = runCompare(options({
      baselinePath: fixture("pair2-baseline.json"),
      candidatePath: fixture("pair2-candidate.json"),
      failOn: "warning",
      format: "text",
    }));
    expect(outcome.output).toContain("WARNING (2)");
    expect(outcome.output).toContain("/fulfilment · RULE_OPTIONAL_FIELD_ADDED");
    expect(outcome.output).toContain("absent → string");
    expect(outcome.exitCode).toBe(1);
  });

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

  it("documents the usage text", () => {
    expect(USAGE).toContain("driftmap compare <baseline> <candidate>");
    expect(USAGE).toContain("--fail-on <breaking|warning|off>");
    expect(USAGE).toContain("Exit codes:");
  });
});

function baselineDescription(baselinePath: string): string {
  const artifact = parseImportArtifact(readFileSync(baselinePath, "utf8"), { source: "file" });
  if (!artifact.ok) return "";
  const value = artifact.artifact;
  if (value.format !== "openapi") return "";
  return `OpenAPI ${value.contract.version} · ${value.contract.operations.length} operations`;
}
