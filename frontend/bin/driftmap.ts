#!/usr/bin/env node
/**
 * `driftmap` — compare two JSON payloads or OpenAPI 3.0 documents from the
 * command line, wrapping the same contract engine the web workbench uses.
 *
 * Run from a checkout with tsx (the package is not published to npm yet):
 *
 *   npx tsx frontend/bin/driftmap.ts compare baseline.json candidate.json
 *
 * Imports only the pure engine modules (`lib/contract/*`, the workbench's
 * content-sniffing `parseImportArtifact`, and the `ruleIdFor` vocabulary).
 * Nothing here may import Prisma, Auth.js, Dexie, or a Next.js runtime.
 */

import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { buildMarkdownReportFromDiff } from "@/lib/contract/export";
import { inferContract } from "@/lib/contract/infer";
import { MAX_IMPORT_BYTES } from "@/lib/contract/parse";
import type { ContractChange, ContractDirection, ContractNode, DiffSummary, StoredContract } from "@/lib/contract/types";
import { ruleIdFor } from "@/lib/driftmap/rules";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";

export type FailOn = "breaking" | "warning" | "off";
export type OutputFormat = "text" | "json" | "markdown";

export interface CompareOptions {
  baselinePath: string;
  candidatePath: string;
  direction: ContractDirection;
  failOn: FailOn;
  format: OutputFormat;
  outPath: string | null;
}

export type ParseResult =
  | { ok: true; options: CompareOptions; help: boolean }
  | { ok: false; message: string };

export const USAGE = `Usage: driftmap compare <baseline> <candidate> [options]

Compare two JSON payloads, arrays of payload samples, or OpenAPI 3.0 documents
(JSON or YAML). The input type is detected from file contents, not extensions.

Options:
  --direction <response|request|event>  Contract direction (default: response)
  --fail-on <breaking|warning|off>      Exit 1 when findings meet this level (default: breaking)
  --format <text|json|markdown>         Output format (default: text)
  --out <file>                          Write the output to a file instead of stdout
  --help                                Show this help

Exit codes:
  0  no findings at or above the --fail-on level
  1  findings met the --fail-on level
  2  usage error, unreadable input, or invalid document`;

const DIRECTIONS: readonly ContractDirection[] = ["response", "request", "event"];
const FAIL_LEVELS: readonly FailOn[] = ["breaking", "warning", "off"];
const FORMATS: readonly OutputFormat[] = ["text", "json", "markdown"];

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): T | { error: string } {
  const match = allowed.find((candidate) => candidate === value);
  return match !== undefined ? match : { error: `${label} must be one of ${allowed.join(", ")} (got "${value}").` };
}

export function parseCliArguments(argv: string[]): ParseResult {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        direction: { type: "string" },
        "fail-on": { type: "string" },
        format: { type: "string" },
        out: { type: "string" },
        help: { type: "boolean" },
      },
    });
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Unable to parse arguments." };
  }

  if (parsed.values.help) {
    return { ok: true, options: emptyOptions(), help: true };
  }

  const [command, baselinePath, candidatePath, ...extra] = parsed.positionals;
  if (command !== "compare") {
    return { ok: false, message: `Unknown command "${command ?? ""}". Usage: driftmap compare <baseline> <candidate>.` };
  }
  if (!baselinePath || !candidatePath) {
    return { ok: false, message: "Provide exactly two file paths: driftmap compare <baseline> <candidate>." };
  }
  if (extra.length > 0) {
    return { ok: false, message: `Unexpected extra argument "${extra[0]}". Provide exactly two file paths.` };
  }

  const directionInput = typeof parsed.values.direction === "string" ? parsed.values.direction : "response";
  const direction = oneOf(directionInput, DIRECTIONS, "--direction");
  if (typeof direction === "object") return { ok: false, message: direction.error };

  const failOnInput = typeof parsed.values["fail-on"] === "string" ? parsed.values["fail-on"] : "breaking";
  const failOn = oneOf(failOnInput, FAIL_LEVELS, "--fail-on");
  if (typeof failOn === "object") return { ok: false, message: failOn.error };

  const formatInput = typeof parsed.values.format === "string" ? parsed.values.format : "text";
  const format = oneOf(formatInput, FORMATS, "--format");
  if (typeof format === "object") return { ok: false, message: format.error };

  return {
    ok: true,
    help: false,
    options: {
      baselinePath,
      candidatePath,
      direction,
      failOn,
      format,
      outPath: typeof parsed.values.out === "string" ? parsed.values.out : null,
    },
  };
}

function emptyOptions(): CompareOptions {
  return { baselinePath: "", candidatePath: "", direction: "response", failOn: "breaking", format: "text", outPath: null };
}

interface LoadedInput {
  contract: StoredContract;
  /** Null for OpenAPI documents, matching the Markdown report's evidence model. */
  samples: number | null;
  description: string;
}

type LoadResult = LoadedInput | { error: string };

/** Reads one input file, enforcing the same 2 MB cap the web client enforces. */
function loadInput(path: string, label: string): LoadResult {
  let text: string;
  try {
    const stats = statSync(path);
    if (!stats.isFile()) return { error: `${label} is not a file: ${path}` };
    if (stats.size > MAX_IMPORT_BYTES) {
      return { error: `${label} is ${(stats.size / 1024 / 1024).toFixed(1)} MB; inputs are capped at 2 MB.` };
    }
    text = readFileSync(path, "utf8");
  } catch {
    return { error: `Unable to read ${label}: ${path}` };
  }
  // Content-based routing, identical to pasting the same text into the workbench.
  const artifact = parseImportArtifact(text, { source: "file" });
  if (!artifact.ok) return { error: `${label}: ${artifact.message}` };
  const value = artifact.artifact;
  if (value.format === "openapi") {
    return {
      contract: value.contract,
      samples: null,
      description: `OpenAPI ${value.contract.version} · ${value.contract.operations.length} operations`,
    };
  }
  return {
    contract: inferContract(value.samples),
    samples: value.samples.length,
    description: `${value.samples.length} sample${value.samples.length === 1 ? "" : "s"}`,
  };
}

export interface CompareOutcome {
  exitCode: number;
  output: string;
}

function summarize(changes: readonly ContractChange[]): DiffSummary {
  const summary: DiffSummary = { breaking: 0, warning: 0, safe: 0, info: 0, total: changes.length };
  for (const change of changes) summary[change.severity] += 1;
  return summary;
}

function thresholdMet(failOn: FailOn, summary: DiffSummary): boolean {
  if (failOn === "breaking") return summary.breaking > 0;
  if (failOn === "warning") return summary.breaking > 0 || summary.warning > 0;
  return false;
}

function nodeType(node: ContractNode | null, side: "baseline" | "candidate"): string {
  if (!node) return side === "baseline" ? "absent" : "missing";
  return node.kinds.join(" | ") || "unknown";
}

function ruleOf(change: ContractChange, direction: ContractDirection): string {
  return ruleIdFor(change.kind, direction, change.before, change.after);
}

function textOutput(options: CompareOptions, baseline: LoadedInput, candidate: LoadedInput, changes: readonly ContractChange[], summary: DiffSummary): string {
  const lines = [
    "DriftMap contract comparison",
    `  baseline:  ${options.baselinePath} · ${baseline.description}`,
    `  candidate: ${options.candidatePath} · ${candidate.description}`,
    `  direction: ${options.direction}`,
    `  summary:   ${summary.breaking} breaking · ${summary.warning} warning · ${summary.safe} safe · ${summary.info} info`,
  ];
  if (changes.length === 0) {
    lines.push("", "No contract drift detected between the two inputs.");
    return lines.join("\n");
  }
  for (const severity of ["breaking", "warning", "safe", "info"] as const) {
    const group = changes.filter((change) => change.severity === severity);
    if (group.length === 0) continue;
    lines.push("", `${severity.toUpperCase()} (${group.length})`);
    for (const change of group) {
      lines.push(`  ${change.pointer} · ${ruleOf(change, options.direction)}`);
      lines.push(`    ${nodeType(change.before, "baseline")} → ${nodeType(change.after, "candidate")}`);
    }
  }
  return lines.join("\n");
}

function jsonOutput(changes: readonly ContractChange[], summary: DiffSummary, direction: ContractDirection): string {
  return JSON.stringify({
    summary: { breaking: summary.breaking, warning: summary.warning, safe: summary.safe, info: summary.info },
    changes: changes.map((change) => ({
      pointer: change.pointer,
      kind: change.kind,
      severity: change.severity,
      rule: ruleOf(change, direction),
      before: nodeType(change.before, "baseline"),
      after: nodeType(change.after, "candidate"),
    })),
  }, null, 2);
}

function markdownOutput(options: CompareOptions, baseline: LoadedInput, candidate: LoadedInput, changes: readonly ContractChange[]): string {
  return buildMarkdownReportFromDiff({
    workspaceName: "DriftMap CLI comparison",
    baselineLabel: options.baselinePath,
    candidateLabel: options.candidatePath,
    direction: options.direction,
    baselineSamples: baseline.samples,
    candidateSamples: candidate.samples,
    diff: buildDiff(options.baselinePath, options.candidatePath, options.direction, [...changes]),
  });
}

export function runCompare(options: CompareOptions): CompareOutcome {
  const baseline = loadInput(options.baselinePath, "baseline");
  if ("error" in baseline) return { exitCode: 2, output: baseline.error };
  const candidate = loadInput(options.candidatePath, "candidate");
  if ("error" in candidate) return { exitCode: 2, output: candidate.error };

  let changes: ContractChange[];
  try {
    changes = compareContracts(baseline.contract, candidate.contract, options.direction);
  } catch (error) {
    return { exitCode: 2, output: error instanceof Error ? error.message : "Unable to compare the two documents." };
  }
  const summary = summarize(changes);
  const output = options.format === "json"
    ? jsonOutput(changes, summary, options.direction)
    : options.format === "markdown"
      ? markdownOutput(options, baseline, candidate, changes)
      : textOutput(options, baseline, candidate, changes, summary);
  return { exitCode: thresholdMet(options.failOn, summary) ? 1 : 0, output };
}

function main(): number {
  const parsed = parseCliArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${parsed.message}\n\n${USAGE}\n`);
    return 2;
  }
  if (parsed.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const outcome = runCompare(parsed.options);
  if (parsed.options.outPath) {
    try {
      writeFileSync(parsed.options.outPath, `${outcome.output}\n`);
    } catch {
      process.stderr.write(`Unable to write the --out file: ${parsed.options.outPath}\n`);
      return 2;
    }
  } else {
    process.stdout.write(`${outcome.output}\n`);
  }
  return outcome.exitCode;
}

const invokedDirectly = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invokedDirectly) {
  process.exitCode = main();
}
