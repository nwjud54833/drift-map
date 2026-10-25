import type { ChangeKind, ChangeSeverity, ContractDirection, ContractNode, DetectedStringFormat, JsonKind } from "@/lib/contract/types";
import { stringFormatLabel } from "@/lib/contract/formats";

/**
 * Presentation vocabulary for the DriftMap surface.
 *
 * The reference build hard-codes severity labels and rule identifiers per
 * finding. This module derives the equivalent strings from the *real* engine's
 * `ChangeKind` and `ContractDirection`, so the redesigned UI speaks the
 * reference build's language without inventing classification the engine did
 * not produce. No severity, kind or ordering decision is made here — those all
 * come from `lib/contract/compatibility.ts` and `lib/contract/compare.ts`.
 */

const MISSING = "— missing";
const ABSENT = "—";

/**
 * Shown wherever a severity word is presented as a result.
 *
 * `breaking` / `warning` / `safe` / `info` are the engine's heuristic
 * compatibility *classification* of a drift, computed from the samples or
 * OpenAPI document provided. They are not a guarantee that a deployed server
 * behaves that way, so every surface that shows them says so in the same words.
 */
export const CLASSIFICATION_CAVEAT =
  "Breaking, warning, safe and info are DriftMap's classifications of this drift, not a guarantee of runtime safety.";

export function severityPillClass(severity: ChangeSeverity): string {
  if (severity === "breaking") return "pill-breaking";
  if (severity === "warning") return "pill-warning";
  if (severity === "safe") return "pill-safe";
  return "pill-info";
}

export function severityStrokeColor(severity: ChangeSeverity): string {
  if (severity === "breaking") return "#FB7185";
  if (severity === "warning") return "#FBBF24";
  if (severity === "safe") return "#34D399";
  return "#38BDF8";
}

/**
 * Compatibility rule identifier shown in the inspector, in the reference
 * build's `RULE_*` register. The mapping is a pure relabelling of the engine's
 * own `ChangeKind`; the direction only disambiguates the two kinds whose
 * classification genuinely depends on it.
 */
export function ruleIdFor(
  kind: ChangeKind,
  direction: ContractDirection,
  before?: ContractNode | null,
  after?: ContractNode | null,
): string {
  switch (kind) {
    case "field-removed":
    case "property-removed":
      return before?.kinds.includes("null") ? "RULE_NULLABLE_FIELD_REMOVED" : "RULE_REQUIRED_FIELD_REMOVED";
    case "field-added":
    case "property-added":
      return after?.kinds.includes("null") ? "RULE_NULLABLE_ADDED" : "RULE_OPTIONAL_FIELD_ADDED";
    case "type-changed":
      return "RULE_WIRE_TYPE_CHANGED";
    case "format-changed":
      return before?.sampleFormat || after?.sampleFormat ? "RULE_STRING_FORMAT_CHANGED" : "RULE_WIRE_TYPE_CHANGED";
    case "nullability-changed": {
      if (!before && after?.kinds.includes("null")) return "RULE_NULLABLE_ADDED";
      if (before && !before.kinds.includes("null") && after?.kinds.includes("null")) {
        return after.kinds.filter((item) => item !== "null").length === 0
          ? "RULE_NULL_INTRODUCED"
          : "RULE_FIELD_BECAME_NULLABLE";
      }
      if (before?.kinds.includes("null") && after && !after.kinds.includes("null")) return "RULE_NULLABILITY_REMOVED";
      return "RULE_FIELD_BECAME_NULLABLE";
    }
    case "became-required":
    case "requiredness-changed":
      return "RULE_REQUIREDNESS_NARROWED";
    case "became-optional":
      return direction === "request" ? "RULE_OPTIONAL_FIELD_REMOVED" : "RULE_REQUIRED_TO_OPTIONAL";
    case "enum-changed":
      return "RULE_ENUM_VALUE_SET_CHANGED";
    case "constraint-changed":
      return "RULE_CONSTRAINT_TIGHTENED";
    case "endpoint-added":
      return "RULE_ENDPOINT_ADDED";
    case "endpoint-removed":
      return "RULE_ENDPOINT_REMOVED";
    case "parameter-added":
      return "RULE_PARAMETER_ADDED";
    case "parameter-removed":
      return "RULE_PARAMETER_REMOVED";
    case "parameter-changed":
      return "RULE_PARAMETER_CHANGED";
    case "request-schema-changed":
      return "RULE_REQUEST_SCHEMA_CHANGED";
    case "response-schema-changed":
      return "RULE_RESPONSE_SCHEMA_CHANGED";
    case "response-status-added":
      return "RULE_RESPONSE_STATUS_ADDED";
    case "response-status-removed":
      return "RULE_RESPONSE_STATUS_REMOVED";
    case "additional-properties-changed":
      return "RULE_ADDITIONAL_PROPERTIES_CHANGED";
    case "contract-format-changed":
      return "RULE_CONTRACT_FORMAT_CHANGED";
    default:
      return `${direction === "request" ? "REQUEST" : direction === "event" ? "EVENT" : "RESPONSE"}_RULE_APPLIED`;
  }
}

/**
 * The reference build's classification pill text, e.g. `Breaking · type narrowed`.
 * Every wording below describes a condition the engine actually reports.
 */
export function driftLabelFor(
  kind: ChangeKind,
  severity: ChangeSeverity,
  direction: ContractDirection,
  becameOptional = false,
  before?: ContractNode | null,
  after?: ContractNode | null,
): string {
  if (kind === "type-changed") return "Breaking · type narrowed";
  if (kind === "field-removed" || kind === "property-removed") {
    if (before?.kinds.includes("null")) return severity === "breaking" ? "Breaking · nullable removed" : "Safe · nullable removed";
    return becameOptional || severity === "safe" ? "Warning · opt removed" : "Breaking · removed";
  }
  if (kind === "field-added" || kind === "property-added") {
    if (after?.kinds.includes("null")) return severity === "safe" ? "Safe · nullable added" : severity === "warning" ? "Warning · nullable added" : "Breaking · nullable added";
    if (severity === "safe") return "Safe · added optional";
    if (severity === "warning") return "Warning · added required";
    return "Breaking · required added";
  }
  if (kind === "became-required" || kind === "requiredness-changed") return "Breaking · became required";
  if (kind === "became-optional") return direction === "request" ? "Safe · became optional" : "Info · req → opt";
  if (kind === "nullability-changed") {
    if (!before && after?.kinds.includes("null")) return severity === "safe" ? "Safe · nullable added" : "Warning · nullable added";
    if (before && !before.kinds.includes("null") && after?.kinds.includes("null")) {
      return after.kinds.filter((item) => item !== "null").length === 0
        ? "Breaking · null introduced"
        : "Warning · became nullable";
    }
    if (before?.kinds.includes("null") && after && !after.kinds.includes("null")) {
      return severity === "breaking" ? "Breaking · null removed" : "Safe · null removed";
    }
    return "Warning · nullable";
  }
  if (kind === "enum-changed") return "Warning · enum narrowed";
  if (kind === "format-changed") {
    return before?.sampleFormat || after?.sampleFormat ? "Warning · string format changed" : "Warning · format changed";
  }
  if (kind === "constraint-changed") return "Warning · constraint changed";
  if (severity === "breaking") return "Breaking · incompatible";
  if (severity === "warning") return "Warning · review";
  if (severity === "safe") return "Safe · compatible";
  return "Info · unchanged";
}

/** `string | null · required` — the reference build's two-part evidence summary. */
export function contractSummary(
  kinds: readonly JsonKind[],
  required: boolean,
  hasEvidence: boolean,
  format?: DetectedStringFormat | null,
): string {
  const type = kinds.length > 0 ? kinds.join(" | ") : "unknown";
  const summary = !hasEvidence ? `${type} · OpenAPI declaration` : `${type} · ${required ? "required" : "optional"}`;
  return format && format !== "plain" ? `${summary} · ${stringFormatLabel(format)}` : summary;
}

export function missingSummary(): string {
  return MISSING;
}

export function absentSummary(): string {
  return ABSENT;
}

export { MISSING as MISSING_SUMMARY, ABSENT as ABSENT_SUMMARY };

/** Short uppercase label for the severity pill in the inspector header. */
export function severityCaption(severity: ChangeSeverity): string {
  return severity.toUpperCase();
}
