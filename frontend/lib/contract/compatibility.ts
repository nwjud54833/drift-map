import type { ChangeKind, ChangeSeverity, ContractDirection } from "./types";

/** The distinct nullability changes the sample engine can report. */
export type NullabilityChange =
  | "null-introduced"
  | "nullable-added"
  | "nullable-added-field"
  | "nullable-removed"
  | "nullable-field-removed";

/**
 * Nullability has its own compatibility policy because it breaks consumers in a
 * different way from a plain type change: strict clients can fail to compile or
 * crash when a field they treated as non-null starts carrying null. This mirrors
 * the existing OpenAPI nullability policy rather than inventing a new scale.
 */
export function classifyNullabilityChange(
  change: NullabilityChange,
  direction: ContractDirection,
  beforeRequired = false,
  afterRequired = false,
): ChangeSeverity {
  if (change === "null-introduced") return "breaking";
  if (change === "nullable-added") return direction === "request" ? "safe" : "warning";
  if (change === "nullable-added-field") return classifyChange("field-added", direction, beforeRequired, afterRequired);
  if (change === "nullable-removed") return direction === "request" ? "breaking" : "safe";
  return classifyChange("field-removed", direction, beforeRequired, afterRequired);
}

export function classifyChange(kind: ChangeKind, direction: ContractDirection, beforeRequired = false, afterRequired = false): ChangeSeverity {
  if (kind === "type-changed" || kind === "became-required") return "breaking";
  if (kind === "field-removed") return direction === "request" && !beforeRequired ? "safe" : "breaking";
  if (kind === "field-added") return direction === "request" ? (afterRequired ? "breaking" : "safe") : (afterRequired ? "warning" : "safe");
  if (kind === "became-optional") return "info";
  return "safe";
}

export function compatibilityRule(kind: ChangeKind, direction: ContractDirection, required = false, beforeKinds: readonly string[] = [], afterKinds: readonly string[] = []): string {
  const label = direction === "event" ? "Event" : direction === "request" ? "Request" : "Response";
  const beforeNullable = beforeKinds.includes("null");
  const afterNullable = afterKinds.includes("null");
  if (kind === "nullability-changed") {
    if (!beforeKinds.length && afterNullable) return `${label} payload: a newly added nullable field still requires consumers to handle null.`;
    if (!beforeNullable && afterNullable) return `${label} payload: a non-null field became nullable; statically typed clients (Swift, Kotlin, Go, TypeScript with strict null checks) can crash or fail to compile.`;
    if (beforeNullable && !afterNullable) return `${label} payload: null was removed; response consumers gain a stronger guarantee, but request callers that still send null can break.`;
    return `${label} payload: nullability changed; consumers must review how they handle null.`;
  }
  if (kind === "field-removed" && beforeNullable) return `${label} payload: the removed field was nullable, so removing it is distinct from making it null.`;
  if (kind === "field-added" && afterNullable) return `${label} payload: the added field is nullable, so consumers must handle null even if it is optional.`;
  if (kind === "field-removed") return direction === "request" ? `${label} payload: removing a ${required ? "required" : "optional"} field is ${required ? "breaking" : "safe"}.` : `${label} payload: removed fields are treated as breaking.`;
  if (kind === "field-added") return direction === "request" ? `${label} payload: newly required request fields are breaking; optional additions are safe.` : `${label} payload: newly required fields are warnings; optional additions are safe.`;
  if (kind === "type-changed") return `${label} payload: any change in inferred JSON kinds is breaking.`;
  if (kind === "became-required") return `${label} payload: a field that now appears in every sample is treated as breaking.`;
  if (kind === "became-optional") return `${label} payload: a field that is absent from some samples is informational.`;
  if (kind === "contract-format-changed") return "The snapshots use different contract representations, so their contents cannot be compared directly.";
  return `OpenAPI compatibility: ${direction === "request" ? "request" : "response"} changes are classified using declared operations, parameters, and schemas; review the rationale and specification context.`;
}
