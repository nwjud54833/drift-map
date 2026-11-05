#!/usr/bin/env node
/**
 * `driftmap` — diff JSON payloads or OpenAPI 3.0 documents from the
 * command line, wrapping the same contract engine the web workbench uses.
 *
 * Run from a checkout with tsx (the package is not published to npm yet):
 *
 *   npx tsx frontend/bin/driftmap.ts diff baseline.json candidate.json
 *
 * Imports only the pure engine modules (`lib/contract/*`, the workbench's
 * content-sniffing `parseImportArtifact`, and the `ruleIdFor` vocabulary).
 * Nothing here may import Prisma, Auth.js, Dexie, or a Next.js runtime.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import { compareContracts } from "@/lib/contract/compare";
import { inferContract } from "@/lib/contract/infer";
import { MAX_IMPORT_BYTES } from "@/lib/contract/parse";
import type { ChangeSeverity, ContractChange, ContractDirection, ContractNode, DiffSummary, PayloadSample, StoredContract } from "@/lib/contract/types";
import { ruleIdFor } from "@/lib/driftmap/rules";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";

import { createPaint, type ColorRole, type Paint } from "./colors";

export type FailOn = "breaking" | "warning" | "off";
export type OutputFormat = "text" | "json" | "markdown";
export type ColorMode = "auto" | "always" | "never";

export interface CompareOptions {
  baselinePath: string;
  candidatePath: string;
  direction: ContractDirection;
  failOn: FailOn;
  format: OutputFormat;
  outPath: string | null;
  configPath?: string | null;
  quiet: boolean;
  verbose: boolean;
  color: ColorMode;
}

export type ParseResult =
  | { ok: true; options: CompareOptions; help: boolean }
  | { ok: false; message: string };

export const USAGE = `Usage: driftmap diff <baseline> <candidate> [options]

Compare two JSON payloads, arrays of payload samples, or OpenAPI 3.0 documents
(JSON or YAML). The input type is detected from file contents, not extensions.

Options:
  --direction <response|request|event>  Contract direction (default: response)
  --fail-on <breaking|warning|off>      Exit 1 when findings meet this level (default: breaking)
  --format <text|json|markdown>         Output format (default: text)
  --config <path>                       JSON rule overrides: { "rules": { "RULE_*": "severity" } }
  --out <file>                          Write the output to a file instead of stdout
  --quiet                               Print only the verdict line (text format; for scripts)
  --verbose                             Show raw RULE_* IDs and sample counts (text format)
  --color <auto|always|never>           When to colorize (default: auto; colors need a TTY and NO_COLOR unset)
  --help                                Show this help

\`diff\` is the primary command; \`compare\` remains as a backwards-compatible alias.
Installed commands: driftmap, driftmap-cli

Exit codes:
  0  no findings at or above the --fail-on level
  1  findings met the --fail-on level
  2  usage error, unreadable input, or invalid document`;

const DIRECTIONS: readonly ContractDirection[] = ["response", "request", "event"];
const FAIL_LEVELS: readonly FailOn[] = ["breaking", "warning", "off"];
const FORMATS: readonly OutputFormat[] = ["text", "json", "markdown"];
const COLOR_MODES: readonly ColorMode[] = ["auto", "always", "never"];

/**
 * Human labels for the engine's RULE_* vocabulary, one table in one module.
 * The word choices follow the workbench's presentation vocabulary
 * (`lib/driftmap/rules.ts`, the `driftLabelFor` pill language) so the CLI and
 * the UI describe the same change with the same words; the CLI keeps them
 * column-length short. Unknown IDs fall back to the raw ID and log nothing.
 */
export const RULE_LABELS: Readonly<Record<string, string>> = {
  RULE_REQUIRED_FIELD_REMOVED: "Required field removed",
  RULE_NULLABLE_FIELD_REMOVED: "Nullable field removed",
  RULE_OPTIONAL_FIELD_REMOVED: "Optional field removed",
  RULE_OPTIONAL_FIELD_ADDED: "Optional field added",
  RULE_NULLABLE_ADDED: "Nullable field added",
  RULE_NULL_INTRODUCED: "Null introduced",
  RULE_FIELD_BECAME_NULLABLE: "Field became nullable",
  RULE_NULLABILITY_REMOVED: "Nullability removed",
  RULE_WIRE_TYPE_CHANGED: "Type changed",
  RULE_STRING_FORMAT_CHANGED: "String format changed",
  RULE_REQUIREDNESS_NARROWED: "Field became required",
  RULE_REQUIRED_TO_OPTIONAL: "Required became optional",
  RULE_ENUM_VALUE_SET_CHANGED: "Enum changed",
  RULE_CONSTRAINT_TIGHTENED: "Constraint tightened",
  RULE_ENDPOINT_ADDED: "Endpoint added",
  RULE_ENDPOINT_REMOVED: "Endpoint removed",
  RULE_PARAMETER_ADDED: "Parameter added",
  RULE_PARAMETER_REMOVED: "Parameter removed",
  RULE_PARAMETER_CHANGED: "Parameter changed",
  RULE_REQUEST_SCHEMA_CHANGED: "Request schema changed",
  RULE_RESPONSE_SCHEMA_CHANGED: "Response schema changed",
  RULE_RESPONSE_STATUS_ADDED: "Response status added",
  RULE_RESPONSE_STATUS_REMOVED: "Response status removed",
  RULE_ADDITIONAL_PROPERTIES_CHANGED: "addl. properties changed",
  RULE_CONTRACT_FORMAT_CHANGED: "Contract format changed",
};

export function ruleLabel(ruleId: string): string {
  return RULE_LABELS[ruleId] ?? ruleId;
}

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
        config: { type: "string" },
        quiet: { type: "boolean" },
        verbose: { type: "boolean" },
        color: { type: "string" },
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
  if (command !== "diff" && command !== "compare") {
    return { ok: false, message: `Unknown command "${command ?? ""}". Usage: driftmap diff <baseline> <candidate>.` };
  }
  if (!baselinePath || !candidatePath) {
    return { ok: false, message: "Provide exactly two file paths: driftmap diff <baseline> <candidate>." };
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

  const colorInput = typeof parsed.values.color === "string" ? parsed.values.color : "auto";
  const color = oneOf(colorInput, COLOR_MODES, "--color");
  if (typeof color === "object") return { ok: false, message: color.error };

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
      configPath: typeof parsed.values.config === "string" ? parsed.values.config : null,
      quiet: parsed.values.quiet === true,
      verbose: parsed.values.verbose === true,
      color,
    },
  };
}

function emptyOptions(): CompareOptions {
  return { baselinePath: "", candidatePath: "", direction: "response", failOn: "breaking", format: "text", outPath: null, configPath: null, quiet: false, verbose: false, color: "auto" };
}

interface LoadedInput {
  contract: StoredContract;
  /** Null for OpenAPI documents, matching the Markdown report's evidence model. */
  samples: number | null;
  description: string;
}

type LoadResult = LoadedInput | { error: string };

const GLOB_META = /[*?\[]/;
const MAX_GLOB_FILES = 500;
const MAX_GLOB_DIRECTORIES = 10_000;
const MAX_GLOB_BYTES = 20 * 1024 * 1024;
const SKIP_GLOB_DIRECTORIES = new Set([".git", "node_modules", ".next", ".agents"]);

function globToRegExp(pattern: string): RegExp {
  const input = pattern.split(sep).join("/");
  let output = "";
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === "*" && input[index + 1] === "*") {
      index += 1;
      if (input[index + 1] === "/") {
        index += 1;
        output += "(?:.*/)?";
      } else output += ".*";
    } else if (char === "*") output += "[^/]*";
    else if (char === "?") output += "[^/]";
    else if (char === "[") {
      const close = input.indexOf("]", index + 1);
      if (close > index + 1) {
        output += input.slice(index, close + 1);
        index = close;
      } else output += "\\[";
    } else output += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  return new RegExp(`^${output}$`);
}

/** Expands common shell globs without spawning a shell or interpolating paths. */
function expandInputPaths(input: string): { paths: string[] } | { error: string } {
  if (!GLOB_META.test(input)) return { paths: [resolve(input)] };
  const absolutePattern = resolve(input);
  const normalizedPattern = absolutePattern.split(sep).join("/");
  const firstMeta = normalizedPattern.search(GLOB_META);
  const lastSeparator = normalizedPattern.lastIndexOf("/", firstMeta);
  let root = lastSeparator <= 0 ? sep : normalizedPattern.slice(0, lastSeparator).split("/").join(sep);
  if (/^[A-Za-z]:$/.test(root)) root += sep;
  const matcher = globToRegExp(absolutePattern);
  const paths: string[] = [];
  let visitedDirectories = 0;
  const visit = (directory: string, depth: number) => {
    if (depth > 32 || paths.length > MAX_GLOB_FILES || visitedDirectories >= MAX_GLOB_DIRECTORIES) return;
    visitedDirectories += 1;
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); }
    catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const path = resolve(directory, entry.name);
      if (entry.isFile() && matcher.test(path.split(sep).join("/"))) paths.push(path);
      else if (entry.isDirectory() && !SKIP_GLOB_DIRECTORIES.has(entry.name)) visit(path, depth + 1);
      if (paths.length > MAX_GLOB_FILES) return;
    }
  };
  visit(root, 0);
  paths.sort();
  if (visitedDirectories >= MAX_GLOB_DIRECTORIES) return { error: `The pattern search exceeded ${MAX_GLOB_DIRECTORIES} directories; narrow the glob.` };
  if (paths.length > MAX_GLOB_FILES) return { error: `The pattern matched more than ${MAX_GLOB_FILES} files; narrow the glob.` };
  if (paths.length === 0) return { error: `No files matched the pattern: ${input}` };
  return { paths };
}

/** Reads file(s) under the same per-file 2 MB cap used by the workbench. */
function loadInput(inputPath: string, label: string): LoadResult {
  const expanded = expandInputPaths(inputPath);
  if ("error" in expanded) return { error: expanded.error };
  const sampleValues: PayloadSample[] = [];
  const openApiContracts: Extract<StoredContract, { kind: "openapi" }>[] = [];
  let totalBytes = 0;
  for (const path of expanded.paths) {
    let text: string;
    try {
      const stats = statSync(path);
      if (!stats.isFile()) return { error: `${label} is not a file: ${path}` };
      if (stats.size > MAX_IMPORT_BYTES) {
        return { error: `${label} file ${basename(path)} is ${(stats.size / (1024 * 1024)).toFixed(1)} MB; inputs are capped at 2 MB per file.` };
      }
      totalBytes += stats.size;
      if (totalBytes > MAX_GLOB_BYTES) return { error: `${label} matched files exceed the 20 MB aggregate cap.` };
      text = readFileSync(path, "utf8");
    } catch {
      return { error: `Unable to read ${label}: ${path}` };
    }
    // PowerShell 5.1 writes a UTF-8 BOM by default; strip it before parsing.
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const artifact = parseImportArtifact(text, { source: "file" });
    if (!artifact.ok) return { error: `${label} (${basename(path)}): ${artifact.message}` };
    if (artifact.artifact.format === "openapi") openApiContracts.push(artifact.artifact.contract);
    else sampleValues.push(...artifact.artifact.samples);
  }
  if (openApiContracts.length > 0) {
    if (openApiContracts.length !== 1 || sampleValues.length > 0 || expanded.paths.length !== 1) {
      return { error: `${label} patterns may match multiple JSON sample files, but an OpenAPI document must be provided as one file.` };
    }
    const contract = openApiContracts[0];
    return { contract, samples: null, description: `OpenAPI ${contract.version} · ${contract.operations.length} operations` };
  }
  return {
    contract: inferContract(sampleValues),
    samples: sampleValues.length,
    description: `${sampleValues.length} sample${sampleValues.length === 1 ? "" : "s"}${expanded.paths.length > 1 ? ` from ${expanded.paths.length} files` : ""}`,
  };
}

export interface CompareOutcome {
  exitCode: number;
  output: string;
}

/* ==========================================================================
 * Text presentation
 * ======================================================================== */

/**
 * Colors enable only for --color=always (forced), or for --color=auto when
 * stdout is a TTY and NO_COLOR is unset.
 */
export function resolveColors(mode: ColorMode): boolean {
  if (mode === "never") return false;
  if (mode === "always") return true;
  return process.env.NO_COLOR === undefined && process.stdout.isTTY === true;
}

const SEVERITIES: readonly ChangeSeverity[] = ["breaking", "warning", "safe", "info"];

type SeverityColorRole = Extract<ColorRole, "breaking" | "warning" | "safe" | "info">;

interface SeverityStyle {
  marker: string;
  role: SeverityColorRole;
  word: string;
}

const SEVERITY_STYLES: Readonly<Record<ChangeSeverity, SeverityStyle>> = {
  breaking: { marker: "[!!]", role: "breaking", word: "BREAKING" },
  warning: { marker: "[~ ]", role: "warning", word: "WARNING" },
  safe: { marker: "[ok]", role: "safe", word: "SAFE" },
  info: { marker: "[i ]", role: "info", word: "INFO" },
};

const MAX_LINE_WIDTH = 80;
const GUTTER = 2;
const ROW_INDENT = 4;

function truncateFromLeft(text: string, width: number): string {
  if (text.length <= width) return text;
  if (width <= 1) return "\u2026".slice(0, Math.max(0, width));
  return `\u2026${text.slice(-(width - 1))}`;
}

function nodeType(node: ContractNode | null, side: "baseline" | "candidate"): string {
  if (!node) return side === "baseline" ? "absent" : "missing";
  return node.kinds.join(" | ") || "unknown";
}

function ruleOf(change: ContractChange, direction: ContractDirection): string {
  return ruleIdFor(change.kind, direction, change.before, change.after);
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

export function verdictLine(exitCode: number): string {
  return `RESULT: ${exitCode === 1 ? "FAIL" : "PASS"} (exit ${exitCode})`;
}

interface GroupRows extends SeverityStyle {
  severity: ChangeSeverity;
  rows: { pointer: string; label: string; before: string; after: string; rule: string }[];
}

function groupRows(changes: readonly ContractChange[], options: CompareOptions): GroupRows[] {
  const groups: GroupRows[] = [];
  for (const severity of SEVERITIES) {
    const group = changes.filter((change) => change.severity === severity);
    if (group.length === 0) continue;
    const rows = [...group]
      .sort((a, b) => a.pointer.localeCompare(b.pointer))
      .map((change) => ({
        pointer: change.pointer,
        label: ruleLabel(ruleOf(change, options.direction)),
        before: nodeType(change.before, "baseline"),
        after: nodeType(change.after, "candidate"),
        rule: ruleOf(change, options.direction),
      }));
    groups.push({ ...SEVERITY_STYLES[severity], severity, rows });
  }
  return groups;
}

function typeColorRole(text: string, side: "before" | "after", severity: ChangeSeverity): ColorRole | null {
  if (text === "missing" && side === "after" && severity === "breaking") return "breaking";
  if (text === "absent" || text === "missing") return "dim";
  return null;
}

function renderGroup(group: GroupRows, paint: Paint, verbose: boolean): string[] {
  const lines: string[] = [];
  lines.push(`  ${paint(group.role, group.marker)} ${paint(group.role, group.word)} (${group.rows.length})`);

  let pointerCol = "POINTER".length;
  let changeCol = "CHANGE".length;
  let beforeCol = "BEFORE".length;
  let afterCol = "AFTER".length;
  let ruleCol = verbose ? "RULE".length : 0;
  for (const row of group.rows) {
    pointerCol = Math.max(pointerCol, row.pointer.length);
    changeCol = Math.max(changeCol, row.label.length);
    beforeCol = Math.max(beforeCol, row.before.length);
    afterCol = Math.max(afterCol, row.after.length);
    if (verbose) ruleCol = Math.max(ruleCol, row.rule.length);
  }

  // The change label and the types are never truncated. The pointer and (when
  // verbose) the RULE_* column share the remaining width: the pointer keeps up
  // to half the slack, the RULE column takes the rest, and both truncate from
  // the left when shorter than their maximum.
  const shared = Math.max(2, MAX_LINE_WIDTH - (ROW_INDENT + changeCol + beforeCol + afterCol + GUTTER * (3 + (verbose ? 1 : 0))));
  const ruleMax = ruleCol;
  const pointerMax = pointerCol;
  if (verbose) {
    const pointerShare = Math.max(1, Math.floor(shared / 2));
    pointerCol = Math.min(pointerMax, pointerShare);
    ruleCol = Math.min(ruleMax, Math.max(1, shared - pointerCol));
    pointerCol = Math.min(pointerMax, Math.max(1, shared - ruleCol));
  } else {
    pointerCol = Math.min(pointerMax, Math.max(1, shared));
  }

  const header = verbose
    ? `${"POINTER".padEnd(pointerCol)}${" ".repeat(GUTTER)}${"CHANGE".padEnd(changeCol)}${" ".repeat(GUTTER)}${"RULE".padEnd(ruleCol)}${" ".repeat(GUTTER)}${"BEFORE".padEnd(beforeCol)}${" ".repeat(GUTTER)}AFTER`
    : `${"POINTER".padEnd(pointerCol)}${" ".repeat(GUTTER)}${"CHANGE".padEnd(changeCol)}${" ".repeat(GUTTER)}${"BEFORE".padEnd(beforeCol)}${" ".repeat(GUTTER)}AFTER`;
  lines.push(`${" ".repeat(ROW_INDENT)}${paint("dim", header)}`);

  for (const row of group.rows) {
    const pointer = paint("pointer", truncateFromLeft(row.pointer, pointerCol).padEnd(pointerCol));
    const cells = [row.label.padEnd(changeCol)];
    if (verbose) {
      cells.push(truncateFromLeft(row.rule, ruleCol).padEnd(ruleCol));
    }
    const beforeRole = typeColorRole(row.before, "before", group.severity);
    const before = row.before.padEnd(beforeCol);
    cells.push(beforeRole ? paint(beforeRole, before) : before);
    const afterRole = typeColorRole(row.after, "after", group.severity);
    cells.push(afterRole ? paint(afterRole, row.after) : row.after);
    lines.push(`${" ".repeat(ROW_INDENT)}${pointer}${" ".repeat(GUTTER)}${cells.join(" ".repeat(GUTTER))}`);
  }
  return lines;
}

function countLine(summary: DiffSummary, paint: Paint): string {
  const items: string[] = [];
  const pairs: { count: number; word: string; role: SeverityColorRole }[] = [
    { count: summary.breaking, word: "breaking", role: "breaking" },
    { count: summary.warning, word: "warning", role: "warning" },
    { count: summary.safe, word: "safe", role: "safe" },
    { count: summary.info, word: "info", role: "info" },
  ];
  for (const { count, word, role } of pairs) {
    items.push(paint(role, `${count} ${word}`));
  }
  return items.join("   ");
}

interface TextReport {
  options: CompareOptions;
  baseline: LoadedInput;
  candidate: LoadedInput;
  summary: DiffSummary;
  exitCode: number;
  changes: ContractChange[];
}

function renderText(report: TextReport, useColor: boolean): string {
  const { options, baseline, candidate, summary } = report;
  if (options.quiet) {
    // Scripts consume this; keep it plain even with --color=always.
    return verdictLine(report.exitCode);
  }
  const paint = createPaint(useColor);
  const files = truncateFromLeft(basename(options.baselinePath), 40) + " \u2192 " + truncateFromLeft(basename(options.candidatePath), 40);
  const lines = [
    paint("dim", `driftmap diff  ${files}`),
    paint("dim", `${options.direction} · fail on ${options.failOn}`),
  ];
  if (options.verbose) {
    lines.push(`  baseline samples: ${baseline.samples ?? "none (OpenAPI)"} · candidate samples: ${candidate.samples ?? "none (OpenAPI)"}`);
  }
  const verdictRole: ColorRole = report.exitCode === 1 ? "verdictFail" : "verdictPass";
  lines.push(`  ${countLine(summary, paint)}        ${paint(verdictRole, verdictLine(report.exitCode))}`);

  for (const group of groupRows(report.changes, options)) {
    lines.push("", ...renderGroup(group, paint, options.verbose));
  }
  return lines.join("\n");
}

/**
 * Same style for every failure: "error: <what happened>" and "hint: <what to
 * do>" on the next line. The engine's own wording is preserved verbatim.
 */
export function errorBlock(message: string): string {
  return `error: ${message}\nhint: ${hintFor(message)}`;
}

function hintFor(message: string): string {
  if (message.includes("Unable to read") || message.includes("is not a file")) return "check that the path exists and is readable.";
  if (message.includes("capped at 2 MB")) return "trim the payload or export fewer samples under the shared 2 MB cap.";
  if (message.includes("is not supported yet") || message.includes("Swagger") || message.includes("AsyncAPI")) return "convert the document to OpenAPI 3.0, or compare against an earlier version.";
  if (message.includes("Unable to parse JSON") || message.includes("valid JSON")) return "fix the file's JSON syntax, or import a supported OpenAPI 3.0 document.";
  if (message.includes("Provide exactly two") || message.includes("Unknown command") || message.includes("must be one of") || message.includes("Unexpected extra") || message.startsWith("Option ") || message.includes("flag") && message.includes("does not take")) return "run with --help for the flag reference.";
  return "check the two input files and try again; --help lists the flags.";
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

function markdownCell(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").replace(/`/g, "\\`");
}

function markdownOutput(
  options: CompareOptions,
  baseline: LoadedInput,
  candidate: LoadedInput,
  changes: ContractChange[],
  summary: DiffSummary,
  exitCode: number,
): string {
  const rows = changes.map((change) => {
    const before = nodeType(change.before, "baseline");
    const after = nodeType(change.after, "candidate");
    return `| ${change.severity.toUpperCase()} | \`${markdownCell(change.pointer)}\` | ${markdownCell(ruleLabel(ruleOf(change, options.direction)))} | ${markdownCell(before)} | ${markdownCell(after)} | ${markdownCell(change.explanation)} |`;
  });
  if (rows.length === 0) rows.push("| — | — | No structural changes | — | — | No structural drift detected. |" );
  const result = exitCode === 1 ? "FAIL" : "PASS";
  return [
    "<!-- driftmap-contract-review -->",
    "## DriftMap contract review",
    "",
    `**${result}** · fail on \`${options.failOn}\` · ${options.direction} contract`,
    "",
    `Baseline: \`${markdownCell(options.baselinePath)}\` (${markdownCell(baseline.description)})  `,
    `Candidate: \`${markdownCell(options.candidatePath)}\` (${markdownCell(candidate.description)})`,
    "",
    `**${summary.breaking} breaking** · ${summary.warning} warning · ${summary.safe} safe · ${summary.info} info`,
    "",
    "| Severity | Path | Change | Baseline | Candidate | Explanation |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    "> Sample inference is evidence, not proof of the producer's formal schema.",
  ].join("\n");
}

type RuleOverrides = Partial<Record<string, ChangeSeverity>>;
type RuleOverridesResult = { ok: true; rules: RuleOverrides } | { ok: false; error: string };

function loadRuleOverrides(configPath: string | null | undefined): RuleOverridesResult {
  if (!configPath) return { ok: true, rules: {} };
  let value: unknown;
  try { value = JSON.parse(readFileSync(resolve(configPath), "utf8")); }
  catch { return { ok: false, error: `Unable to read or parse JSON config: ${configPath}` }; }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, error: "Config must be a JSON object with a rules object." };
  const config = value as Record<string, unknown>;
  if (Object.keys(config).some((key) => key !== "rules")) return { ok: false, error: "Config supports only the top-level \"rules\" property." };
  if (config.rules === undefined) return { ok: true, rules: {} };
  if (typeof config.rules !== "object" || config.rules === null || Array.isArray(config.rules)) return { ok: false, error: "Config \"rules\" must be an object mapping RULE_* IDs to severities." };
  const overrides: RuleOverrides = {};
  for (const [rule, severity] of Object.entries(config.rules as Record<string, unknown>)) {
    if (!Object.hasOwn(RULE_LABELS, rule)) return { ok: false, error: `Unknown compatibility rule in config: ${rule}` };
    if (typeof severity !== "string" || !(SEVERITIES as readonly string[]).includes(severity)) {
      return { ok: false, error: `Config severity for ${rule} must be breaking, warning, safe, or info.` };
    }
    overrides[rule] = severity as ChangeSeverity;
  }
  return { ok: true, rules: overrides };
}

export function runCompare(options: CompareOptions): CompareOutcome {
  const ruleOverrides = loadRuleOverrides(options.configPath);
  if (!ruleOverrides.ok) return { exitCode: 2, output: errorBlock(ruleOverrides.error) };
  const baseline = loadInput(options.baselinePath, "baseline");
  if ("error" in baseline) return { exitCode: 2, output: errorBlock(baseline.error) };
  const candidate = loadInput(options.candidatePath, "candidate");
  if ("error" in candidate) return { exitCode: 2, output: errorBlock(candidate.error) };

  let changes: ContractChange[];
  try {
    changes = compareContracts(baseline.contract, candidate.contract, options.direction).map((change) => {
      const override = ruleOverrides.rules[ruleOf(change, options.direction)];
      return override ? { ...change, severity: override } : change;
    });
  } catch (error) {
    return { exitCode: 2, output: errorBlock(error instanceof Error ? error.message : "Unable to compare the two documents.") };
  }
  const summary = summarize(changes);
  const exitCode = thresholdMet(options.failOn, summary) ? 1 : 0;

  let output: string;
  if (options.format === "json") {
    output = jsonOutput(changes, summary, options.direction);
  } else if (options.format === "markdown") {
    output = markdownOutput(options, baseline, candidate, changes, summary, exitCode);
  } else {
    output = renderText({ options, baseline, candidate, summary, exitCode, changes }, resolveColors(options.color));
  }
  return { exitCode, output };
}

function main(): number {
  const parsed = parseCliArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${errorBlock(parsed.message)}\n\n${USAGE}\n`);
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
      process.stderr.write(`${errorBlock(`Unable to write the --out file: ${parsed.options.outPath}`)}\n`);
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
