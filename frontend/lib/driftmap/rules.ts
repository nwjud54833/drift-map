import type { ChangeKind, ChangeSeverity, ContractDirection, JsonKind } from "@/lib/contract/types";

/**
 * Presentation vocabulary for the Obsidian v2.5 "Spatial" surface.
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
export function ruleIdFor(kind: ChangeKind, direction: ContractDirection): string {
  switch (kind) {
    case "field-removed":
    case "property-removed":
      return "RULE_REQUIRED_FIELD_REMOVED";
    case "field-added":
    case "property-added":
      return "RULE_OPTIONAL_FIELD_ADDED";
    case "type-changed":
    case "format-changed":
      return "RULE_WIRE_TYPE_CHANGED";
    case "nullability-changed":
      return "RULE_FIELD_BECAME_NULLABLE";
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
export function driftLabelFor(kind: ChangeKind, severity: ChangeSeverity, direction: ContractDirection, becameOptional = false): string {
  if (kind === "type-changed") return "Breaking · type narrowed";
  if (kind === "field-removed" || kind === "property-removed") {
    return becameOptional || severity === "safe" ? "Warning · opt removed" : "Breaking · removed";
  }
  if (kind === "field-added" || kind === "property-added") {
    if (severity === "safe") return "Safe · added optional";
    if (severity === "warning") return "Warning · added required";
    return "Breaking · required added";
  }
  if (kind === "became-required" || kind === "requiredness-changed") return "Breaking · became required";
  if (kind === "became-optional") return direction === "request" ? "Safe · became optional" : "Info · req → opt";
  if (kind === "nullability-changed") return "Warning · nullable";
  if (kind === "enum-changed") return "Warning · enum narrowed";
  if (kind === "format-changed") return "Warning · format changed";
  if (kind === "constraint-changed") return "Warning · constraint changed";
  if (severity === "breaking") return "Breaking · incompatible";
  if (severity === "warning") return "Warning · review";
  if (severity === "safe") return "Safe · compatible";
  return "Info · unchanged";
}

/** `string | null · required` — the reference build's two-part evidence summary. */
export function contractSummary(kinds: readonly JsonKind[], required: boolean, hasEvidence: boolean): string {
  const type = kinds.length > 0 ? kinds.join(" | ") : "unknown";
  if (!hasEvidence) return `${type} · OpenAPI declaration`;
  return `${type} · ${required ? "required" : "optional"}`;
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
