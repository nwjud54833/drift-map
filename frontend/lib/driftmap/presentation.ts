import type {
  ChangeSeverity,
  ContractChange,
  ContractDiff,
  ContractDirection,
  ContractNode,
  ContractSnapshot,
  InferredContract,
  JsonKind,
  JsonObject,
  JsonValue,
  PayloadSample,
} from "@/lib/contract/types";
import { inferContract } from "@/lib/contract/infer";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { compatibilityRule } from "@/lib/contract/compatibility";
import { getDemoSamples } from "@/lib/db/contract-atlas-db";
import { displayFingerprint } from "@/lib/workbench/fingerprint";
import { ABSENT_SUMMARY, MISSING_SUMMARY, contractSummary, driftLabelFor, ruleIdFor } from "./rules";
import { presenceSeries, type SparklineDirection } from "./sparkline";

/* ==========================================================================
 * Finding view model
 *
 * Everything the redesigned landing page and workbench render about a finding
 * flows through `Finding`: pointers, kinds, requiredness, sample evidence and
 * explanations are the engine's real output, relabelled into the Obsidian
 * reference build's vocabulary. No severity is recomputed here.
 * ======================================================================== */

export interface Finding {
  /** Engine change id — stable, so it doubles as the React key. */
  id: string;
  pointer: string;
  severity: ChangeSeverity;
  kind: ContractChange["kind"];
  title: string;
  ruleId: string;
  driftLabel: string;
  /** Type labels for the two sides of the type-shift cell. */
  fromType: string;
  toType: string;
  baseSummary: string;
  candSummary: string;
  /** JSON-encoded observed example, or `null` when the engine recorded none. */
  baseSample: string | null;
  candSample: string | null;
  baseKinds: JsonKind[];
  candKinds: JsonKind[];
  presentCount: number;
  totalSamples: number;
  /** Item-level evidence for fields inside arrays; null for ordinary fields. */
  presentInItems: number | null;
  totalItems: number | null;
  /** Which unit `presentCount` / `totalSamples` describe. */
  evidenceUnit: "items" | "samples";
  /** False when the sides come from OpenAPI declarations with no sample evidence. */
  hasSampleEvidence: boolean;
  sparkPoints: number[];
  explanation: string;
  /** The compatibility rule's own plain-language justification. */
  ruleExplanation: string;
  change: ContractChange;
}

export interface FindingContext {
  direction: ContractDirection;
  /** Version label of the candidate revision, shown in the split AST slice. */
  candidateVersion: string;
  /** Live-traffic revision: overrides presence telemetry per change id. */
  revisedPresence?: ReadonlyMap<string, { presentCount: number; totalSamples: number }>;
}

function exampleFor(node: ContractNode | null): string | null {
  if (!node || node.examples.length === 0) return null;
  try {
    return JSON.stringify(node.examples[0]);
  } catch {
    return null;
  }
}

function sparkDirection(change: ContractChange): SparklineDirection {
  if (!change.after) return "falling";
  if (!change.before) return "rising";
  return "flat";
}

export function toFinding(change: ContractChange, context: FindingContext): Finding {
  const node = change.after ?? change.before;
  const revised = context.revisedPresence?.get(change.id);
  const presentInItems = node?.presentInItems ?? null;
  const totalItems = node?.totalItems ?? null;
  const presentCount = revised?.presentCount ?? presentInItems ?? node?.presentInSamples ?? 0;
  const totalSamples = revised?.totalSamples ?? totalItems ?? node?.totalSamples ?? 0;
  const evidenceUnit = presentInItems !== null && totalItems !== null ? "items" : "samples";
  const becameOptional = change.kind === "became-optional" && !change.after;

  return {
    id: change.id,
    pointer: change.pointer,
    severity: change.severity,
    kind: change.kind,
    title: change.title,
    ruleId: ruleIdFor(change.kind, context.direction),
    driftLabel: driftLabelFor(change.kind, change.severity, context.direction, becameOptional),
    fromType: change.before ? change.before.kinds.join(" | ") || "unknown" : "absent",
    toType: change.after ? change.after.kinds.join(" | ") || "unknown" : "missing",
    baseSummary: change.before
      ? contractSummary(change.before.kinds, change.before.required, change.before.totalSamples > 0)
      : ABSENT_SUMMARY,
    candSummary: change.after
      ? contractSummary(change.after.kinds, change.after.required, change.after.totalSamples > 0)
      : MISSING_SUMMARY,
    baseSample: exampleFor(change.before),
    candSample: exampleFor(change.after),
    baseKinds: change.before?.kinds ?? [],
    candKinds: change.after?.kinds ?? [],
    presentCount,
    totalSamples,
    presentInItems,
    totalItems,
    evidenceUnit,
    hasSampleEvidence: totalSamples > 0,
    sparkPoints: presenceSeries(presentCount, totalSamples || 1, sparkDirection(change)),
    explanation: change.explanation,
    ruleExplanation: compatibilityRule(change.kind, context.direction, change.before?.required ?? false),
    change,
  };
}

export function toFindings(changes: readonly ContractChange[], context: FindingContext): Finding[] {
  return changes.map((change) => toFinding(change, context));
}

export function presencePercent(finding: Pick<Finding, "presentCount" | "totalSamples">): number {
  return Math.min(100, Math.round((finding.presentCount / Math.max(finding.totalSamples, 1)) * 100));
}

/* ==========================================================================
 * Progressive revision timeline
 *
 * Starting from the real baseline samples, the engine's own change list is
 * applied in three cumulative steps — additive edits, then nullability and
 * requiredness shifts, then removals, retypes and newly required fields — and
 * every intermediate contract is re-inferred with `inferContract`. Each
 * revision is therefore a genuine contract, and each revision's finding list is
 * a real `compareContracts` result against the baseline.
 * ======================================================================== */

export interface TimelineRevision {
  index: number;
  version: string;
  fingerprint: string;
  summary: string;
  /** Findings visible at this revision, cumulatively applied. */
  applied: readonly ContractChange[];
  /** The step this revision introduces relative to the previous one. */
  delta: readonly ContractChange[];
  /** Real comparison of this revision's contract against the baseline. */
  changes: readonly ContractChange[];
  diff: ContractDiff;
  dotClass: string;
  /** Highest severity present at this revision, or `info` when clean. */
  tone: ChangeSeverity;
  baselineSamples: readonly PayloadSample[];
  candidateSamples: readonly PayloadSample[];
  baselineContract: InferredContract;
  candidateContract: InferredContract;
}

export const SEVERITY_STEPS: readonly ChangeSeverity[] = ["safe", "warning", "breaking"];

const STEP_SUMMARY: Record<ChangeSeverity, string> = {
  safe: "additive, backwards-compatible edits",
  warning: "fields that became optional or nullable",
  breaking: "fields removed, retyped, or newly required",
  info: "no structural change",
};

function toneFor(counts: { breaking: number; warning: number; safe: number }): ChangeSeverity {
  if (counts.breaking > 0) return "breaking";
  if (counts.warning > 0) return "warning";
  if (counts.safe > 0) return "safe";
  return "info";
}

function dotClassFor(tone: ChangeSeverity): string {
  if (tone === "breaking") return "bg-rose-400";
  if (tone === "warning") return "bg-amber-400";
  if (tone === "safe") return "bg-emerald-400";
  return "bg-sky-400";
}

function summarizeStep(step: ChangeSeverity, count: number): string {
  if (count === 0) return "no further drift";
  return `${count} ${count === 1 ? "change" : "changes"} · ${STEP_SUMMARY[step]}`;
}

/**
 * `v1.0.0`, `v1.1.0`, `v2.0-rc1` — mirrors the reference version ladder.
 *
 * The last stop is always the candidate payload itself, so it takes the `-rc1`
 * label. That is a property of position, not of how many stops survived the
 * dedupe: a pair with no breaking changes still ends on the candidate.
 */
function resolveVersion(prefix: string, index: number, lastIndex: number): string {
  if (index === 0) return `${prefix}.0.0`;
  if (index === lastIndex) return `v${Number(prefix.slice(1)) + 1}.0-rc1`;
  return `${prefix}.${index}.0`;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

/**
 * Looks up the real payload value at a JSON pointer (with `*` meaning "any array
 * element"), so an intermediate revision can be shaped from the candidate's own
 * structure instead of a generic placeholder.
 */
function lookupByPointer(node: JsonValue | undefined, segments: readonly string[]): JsonValue | undefined {
  const [head, ...rest] = segments;
  if (head === undefined) return node;
  if (node === undefined || node === null) return undefined;

  if (head === "*") {
    if (!Array.isArray(node) || node.length === 0) return undefined;
    for (const item of node) {
      const found = lookupByPointer(item, rest);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (typeof node !== "object" || Array.isArray(node)) return undefined;
  const record = node as JsonObject;
  if (!(head in record)) return undefined;
  return lookupByPointer(record[head], rest);
}

function isPlainObject(value: JsonValue | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function primitiveFor(kind: JsonKind, previous: JsonValue | undefined): JsonValue {
  switch (kind) {
    case "string":
      if (typeof previous === "number" || typeof previous === "boolean") return String(previous);
      return "value";
    case "number": {
      if (typeof previous === "string") {
        const parsed = Number(previous);
        if (Number.isFinite(parsed)) return parsed;
      }
      if (typeof previous === "boolean") return previous ? 1 : 0;
      return 0;
    }
    case "boolean":
      return typeof previous === "boolean" ? previous : false;
    case "null":
      return null;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}

/**
 * Produces a value of the target kind.
 *
 * The engine reports JSON kinds rather than JSON Schema, so a primitive-to-object
 * shift has no faithful representation. Two rules keep the result honest:
 *
 *  1. If the *original* payload already holds an object at this exact pointer
 *     (the `total_cents` → `total` case), that object is reused instead of being
 *     wrapped, so no synthetic key is invented.
 *  2. Otherwise the real value at this pointer in the candidate payload is
 *     copied verbatim. That is what makes the final revision byte-identical to
 *     the candidate the user imported, rather than an approximation of it.
 */
function coerceToKind(kind: JsonKind, previous: JsonValue | undefined, candidateValue: JsonValue | undefined): JsonValue {
  if (kind === "object") {
    if (isPlainObject(previous)) return previous;
    if (isPlainObject(candidateValue)) return structuredClone(candidateValue);
    return {};
  }
  if (kind === "array") {
    if (Array.isArray(candidateValue)) return structuredClone(candidateValue);
    return [];
  }
  // `previous` is deliberately not carried into a primitive: the change says the
  // wire type is now a primitive, so the old structure no longer applies.
  return primitiveFor(kind, undefined);
}

/**
 * Walks a JSON pointer and rewrites the leaf in place. `DELETE` is the sentinel
 * that removes the key, which is how a `field-removed` change is applied.
 * Returns false when the path is absent from this payload.
 */
const DELETE = Symbol("delete");

function walk(
  node: JsonValue,
  segments: readonly string[],
  transform: (leaf: JsonValue | undefined) => JsonValue | typeof DELETE,
): boolean {
  const [head, ...rest] = segments;
  if (head === undefined) return false;

  // A `*` segment addresses every element of the array at this position.
  if (head === "*") {
    if (!Array.isArray(node) || rest.length === 0) return false;
    let touched = false;
    for (const item of node) {
      if (item === null || typeof item !== "object") continue;
      if (walk(item, rest, transform)) touched = true;
    }
    return touched;
  }

  if (node === null || typeof node !== "object" || Array.isArray(node)) return false;
  const record = node as JsonObject;

  if (rest.length === 0) {
    const next = transform(record[head]);
    if (next === DELETE) delete record[head];
    else record[head] = next;
    return true;
  }

  const child = record[head];
  if (child === undefined) return false;
  return walk(child, rest, transform);
}

/**
 * Creates the containers a JSON pointer implies, seeding each new container from
 * the candidate payload's real value at that position. The seed is what stops an
 * intermediate revision from inventing paths the candidate does not contain.
 */
function insert(
  node: JsonValue,
  segments: readonly string[],
  kind: JsonKind,
  candidate: JsonValue | undefined,
): void {
  const [head, ...rest] = segments;
  if (head === undefined) return;

  if (head === "*") {
    if (!Array.isArray(node) || rest.length === 0) return;
    for (const item of node) insert(item, rest, kind, candidate);
    return;
  }

  if (node === null || typeof node !== "object" || Array.isArray(node)) return;
  const record = node as JsonObject;
  if (rest.length === 0) {
    record[head] = coerceToKind(kind, record[head], candidate);
    return;
  }

  const child = record[head];
  if (child === undefined || child === null || typeof child !== "object") {
    record[head] = rest[0] === "*" ? structuredClone(Array.isArray(candidate) ? candidate : []) : {};
  }
  insert(record[head], rest, kind, candidate);
}

/**
 * Applies one engine-detected change to a single sample payload.
 *
 * `candidateValue` is the real value at this change's pointer in the candidate
 * payload, when one exists. Passing it is what guarantees that applying every
 * change reproduces the candidate exactly.
 */
export function applyChangeToValue(value: JsonObject, change: ContractChange, candidateValue?: JsonValue): JsonObject {
  const segments = change.pointer.split("/").filter(Boolean);
  if (segments.length === 0) return value;
  const draft = cloneValue(value);

  // Removed on the candidate side.
  if (!change.after) {
    walk(draft, segments, () => DELETE);
    return draft;
  }

  // Only these kinds rewrite an existing value; a plain addition leaves any
  // value already at the path untouched.
  const rewritesValue = change.kind === "type-changed"
    || change.kind === "format-changed"
    || change.kind === "nullability-changed"
    || !change.before;

  if (!rewritesValue) return draft;

  const kinds = change.after.kinds;
  const kind = kinds[0] ?? "string";
  const touched = walk(draft, segments, (leaf) => {
    if (change.kind === "nullability-changed") return null;
    // A field the candidate *adds* takes the candidate's own value, so the row's
    // evidence reads like the document under review rather than a placeholder.
    if (!change.before && candidateValue !== undefined) return structuredClone(candidateValue);
    return coerceToKind(kind, leaf === undefined ? undefined : leaf, candidateValue);
  });

  // The leaf (or an ancestor) is absent: create the containers the pointer implies.
  if (!touched) insert(draft, segments, kind, candidateValue);
  return draft;
}

function applyChanges(
  samples: readonly PayloadSample[],
  changes: readonly ContractChange[],
  candidateSamples: readonly PayloadSample[] = [],
): PayloadSample[] {
  return samples.map((sample, index) => {
    // Samples are matched positionally; a candidate with fewer samples than the
    // baseline still gets the first sample's shape, which is the best evidence
    // available for the revision being built.
    const candidateRoot = candidateSamples[index]?.value ?? candidateSamples[0]?.value;
    let value = sample.value;
    for (const change of changes) {
      const candidateValue = lookupByPointer(candidateRoot, change.pointer.split("/").filter(Boolean));
      value = applyChangeToValue(value, change, candidateValue);
    }
    return { ...sample, value };
  });
}

export function buildTimeline(
  baselineSamples: readonly PayloadSample[],
  candidateSamples: readonly PayloadSample[],
  direction: ContractDirection,
  versionPrefix = "v1",
): TimelineRevision[] {
  const baseline = baselineSamples.map((sample) => ({ ...sample }));
  const baselineContract = inferContract(baseline);
  const finalContract = inferContract([...candidateSamples]);
  const allChanges = compareContracts(baselineContract, finalContract, direction);

  const revisions: TimelineRevision[] = [];
  const applied: ContractChange[] = [];

  const push = (index: number, samples: PayloadSample[], delta: ContractChange[], step: ChangeSeverity | null) => {
    const candidate = inferContract(samples);
    const changes = compareContracts(baselineContract, candidate, direction);
    const counts = {
      breaking: applied.filter((change) => change.severity === "breaking").length,
      warning: applied.filter((change) => change.severity === "warning").length,
      safe: applied.filter((change) => change.severity === "safe").length,
    };
    const tone = toneFor(counts);
    revisions.push({
      index,
      version: resolveVersion(versionPrefix, index, SEVERITY_STEPS.length),
      fingerprint: displayFingerprint(candidate) ?? "00000000",
      summary: step ? summarizeStep(step, delta.length) : "clean baseline contract",
      applied: [...applied],
      delta,
      changes,
      diff: buildDiff("revision-0", `revision-${index}`, direction, changes),
      dotClass: dotClassFor(tone),
      tone,
      baselineSamples: baseline,
      candidateSamples: samples,
      baselineContract,
      candidateContract: candidate,
    });
  };

  push(0, baseline, [], null);

  SEVERITY_STEPS.forEach((severity, stepIndex) => {
    const stepChanges = allChanges.filter((change) => change.severity === severity);
    // A severity class the payload pair does not exercise contributes nothing, so
    // its step is recorded as empty and dropped below rather than shown as a
    // revision that is byte-identical to the one before it.
    applied.push(...stepChanges);
    push(stepIndex + 1, applyChanges(baseline, applied, candidateSamples), stepChanges, severity);
  });

  return reindexRevisions(revisions, versionPrefix);
}

/**
 * Removes consecutive revisions that infer the same contract and renumbers the
 * survivors.
 *
 * The reference build always shows four stops because its data is authored to
 * fill them. Here the number of stops is a property of the payload pair: a pair
 * with no removable fields produces three stops, one with no drift at all
 * produces a single "clean baseline" stop. Versions are re-derived from the
 * surviving positions so the ladder still reads `v1.0.0 → v1.1.0 → v2.0-rc1`.
 */
function reindexRevisions(revisions: TimelineRevision[], versionPrefix: string): TimelineRevision[] {
  const kept: TimelineRevision[] = [];
  for (const revision of revisions) {
    const previous = kept[kept.length - 1];
    if (previous && previous.candidateContract.fingerprint === revision.candidateContract.fingerprint) continue;
    kept.push(revision);
  }
  return kept.map((revision, index) => ({
    ...revision,
    index,
    version: resolveVersion(versionPrefix, index, kept.length - 1),
  }));
}

/**
 * Builds the landing page's revision ladder.
 *
 * `/` needs a contract pair to demonstrate itself before the visitor has
 * imported anything. Rather than hard-coding a table of findings — which would
 * drift away from the engine — the landing page runs the bundled fixture through
 * the same inference, comparison and timeline code the workbench uses. Reusing
 * `getDemoSamples()` keeps the landing and workbench demos byte-identical.
 */
export function buildDemoTimeline(): TimelineRevision[] {
  const demo = getDemoSamples();
  return buildTimeline(demo.baseline, demo.candidate, "event", "v1");
}

/**
 * Builds a timeline from two stored snapshots. Returns an empty list when
 * either side is an OpenAPI contract or has no payload samples, because there is
 * nothing to progressively mutate — callers fall back to the snapshot list.
 */
export function buildSnapshotTimeline(
  baseline: ContractSnapshot | null,
  candidate: ContractSnapshot | null,
  direction: ContractDirection,
): TimelineRevision[] {
  if (!baseline || !candidate || baseline.samples.length === 0 || candidate.samples.length === 0) return [];
  return buildTimeline(baseline.samples, candidate.samples, direction);
}
