import type { ChangeKind, ChangeSeverity, ContractDirection } from "./types";

export function classifyChange(kind: ChangeKind, direction: ContractDirection, beforeRequired = false, afterRequired = false): ChangeSeverity {
  if (kind === "type-changed" || kind === "became-required") return "breaking";
  if (kind === "field-removed") return direction === "request" && !beforeRequired ? "safe" : "breaking";
  if (kind === "field-added") return direction === "request" ? (afterRequired ? "breaking" : "safe") : (afterRequired ? "warning" : "safe");
  if (kind === "became-optional") return "info";
  return "safe";
}

export function compatibilityRule(kind: ChangeKind, direction: ContractDirection, required = false): string {
  const label = direction === "event" ? "Event" : direction === "request" ? "Request" : "Response";
  if (kind === "field-removed") return direction === "request" ? `${label} payload: removing a ${required ? "required" : "optional"} field is ${required ? "breaking" : "safe"}.` : `${label} payload: removed fields are treated as breaking.`;
  if (kind === "field-added") return direction === "request" ? `${label} payload: newly required request fields are breaking; optional additions are safe.` : `${label} payload: newly required fields are warnings; optional additions are safe.`;
  if (kind === "type-changed") return `${label} payload: any change in inferred JSON kinds is breaking.`;
  if (kind === "became-required") return `${label} payload: a field that now appears in every sample is treated as breaking.`;
  if (kind === "became-optional") return `${label} payload: a field that is absent from some samples is informational.`;
  if (kind === "contract-format-changed") return "The snapshots use different contract representations, so their contents cannot be compared directly.";
  return `OpenAPI compatibility: ${direction === "request" ? "request" : "response"} changes are classified using declared operations, parameters, and schemas; review the rationale and specification context.`;
}
