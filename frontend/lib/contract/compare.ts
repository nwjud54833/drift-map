import type { ChangeKind, ContractChange, ContractDirection, ContractNode, JsonKind, JsonValue, OpenApiContract, StoredContract } from "./types";
import { classifyChange } from "./compatibility";
import { getJsonKind, pointerDepth, pointerLabel } from "./normalize";
import { collectContractNodes } from "./infer";
import { compareOpenApiContracts } from "./openapi";

const severityRank = { breaking: 0, warning: 1, safe: 2, info: 3 } as const;
function makeChange(pointer: string, kind: ChangeKind, before: ContractNode | null, after: ContractNode | null, direction: ContractDirection): ContractChange {
  const severity = classifyChange(kind, direction, before?.required ?? false, after?.required ?? false);
  const names: Partial<Record<ChangeKind, string>> = { "field-added": "Field added", "field-removed": "Field removed", "type-changed": "Type changed", "became-required": "Field became required", "became-optional": "Field became optional" };
  const left = before ? before.kinds.join(" | ") : "missing";
  const right = after ? after.kinds.join(" | ") : "missing";
  const explanation = kind === "field-removed"
    ? `The field existed in the baseline contract but is absent from all candidate samples. For ${direction} compatibility this is classified as ${severity}.`
    : kind === "field-added"
      ? `The field appears in candidate samples (${after?.presentInSamples ?? 0}/${after?.totalSamples ?? 0}). Sample inference considers it ${after?.required ? "required" : "optional"}. For ${direction} compatibility this is classified as ${severity}.`
      : kind === "type-changed"
        ? `The inferred JSON kind changed from ${left} to ${right}. Any kind-set difference is conservatively classified as breaking.`
        : kind === "became-required"
          ? "The field is present in every candidate sample and appears required. Sample inference is evidence, not proof of the producer's formal schema."
          : "The field is missing from one or more candidate samples and appears optional. Sample inference is evidence, not proof of the producer's formal schema.";
  return { id: `${pointer}:${kind}`, pointer, kind, severity, title: names[kind] ?? "Contract changed", explanation, before, after };
}

function isOpenApiContract(contract: StoredContract): contract is OpenApiContract {
  return "kind" in contract && contract.kind === "openapi";
}

function nodeFromSchema(pointer: string, value: JsonValue | null): ContractNode | null {
  if (value === null) return null;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    const example = Array.isArray(value) ? "[array]" : value as string | number | boolean | null;
    return { pointer, label: pointerLabel(pointer), kinds: [getJsonKind(value)], presentInSamples: 0, totalSamples: 0, required: false, examples: [example] };
  }
  const schema = value as Record<string, JsonValue>;
  const declaredType = schema.type;
  const typeMap: Record<string, JsonKind> = { string: "string", number: "number", integer: "number", boolean: "boolean", object: "object", array: "array", null: "null" };
  const rawTypes = Array.isArray(declaredType) ? declaredType : [declaredType];
  const kinds = rawTypes.flatMap((item) => typeof item === "string" && typeMap[item] ? [typeMap[item]] : []);
  if (schema.nullable === true && !kinds.includes("null")) kinds.push("null");
  const actualKinds: JsonKind[] = [...new Set<JsonKind>(kinds.length ? kinds : ["object"])].sort();
  const examples = schema.example === null || ["string", "number", "boolean"].includes(typeof schema.example)
    ? [schema.example as string | number | boolean | null]
    : [];
  return { pointer, label: pointerLabel(pointer), kinds: actualKinds, presentInSamples: 0, totalSamples: 0, required: false, examples };
}

export function compareContracts(baseline: StoredContract, candidate: StoredContract, direction: ContractDirection): ContractChange[] {
  if (isOpenApiContract(baseline) && isOpenApiContract(candidate)) {
    return compareOpenApiContracts(baseline, candidate).map((change) => ({
      ...change,
      before: nodeFromSchema(change.pointer, change.before),
      after: nodeFromSchema(change.pointer, change.after),
    }));
  }
  if (isOpenApiContract(baseline) !== isOpenApiContract(candidate)) {
    return [{
      id: "contract-format-changed", pointer: "/", kind: "contract-format-changed", severity: "warning",
      title: "Contract format changed", explanation: "One snapshot contains inferred payload samples and the other contains an OpenAPI document. The formats are not directly comparable.",
      before: null, after: null,
    }];
  }
  if (isOpenApiContract(baseline) || isOpenApiContract(candidate)) return [];
  const beforeNodes = collectContractNodes(baseline);
  const afterNodes = collectContractNodes(candidate);
  const changes: ContractChange[] = [];
  for (const pointer of new Set([...beforeNodes.keys(), ...afterNodes.keys()])) {
    const before = beforeNodes.get(pointer) ?? null;
    const after = afterNodes.get(pointer) ?? null;
    if (before && after) {
      if (before.kinds.join("|") !== after.kinds.join("|")) changes.push(makeChange(pointer, "type-changed", before, after, direction));
      else if (!before.required && after.required) changes.push(makeChange(pointer, "became-required", before, after, direction));
      else if (before.required && !after.required) changes.push(makeChange(pointer, "became-optional", before, after, direction));
    } else changes.push(makeChange(pointer, before ? "field-removed" : "field-added", before, after, direction));
  }
  const changedTypes = new Set(changes.filter((change) => change.kind === "type-changed").map((change) => change.pointer));
  return changes.filter((change) => ![...changedTypes].some((parent) => parent !== change.pointer && change.pointer.startsWith(`${parent}/`)))
    .sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || pointerDepth(a.pointer) - pointerDepth(b.pointer) || a.pointer.localeCompare(b.pointer));
}

export function buildDiff(baselineSnapshotId: string, candidateSnapshotId: string, direction: ContractDirection, changes: ContractChange[], generatedAt = new Date().toISOString()) {
  const summary = { breaking: 0, warning: 0, safe: 0, info: 0, total: changes.length };
  changes.forEach((change) => { summary[change.severity] += 1; });
  return { baselineSnapshotId, candidateSnapshotId, direction, generatedAt, summary, changes };
}

export interface UnchangedNode {
  pointer: string;
  label: string;
  kinds: JsonKind[];
  required: boolean;
}

/** Paths that exist on both sides with identical inferred kinds and requiredness. */
export function collectUnchangedNodes(baseline: StoredContract, candidate: StoredContract): UnchangedNode[] {
  if (isOpenApiContract(baseline) !== isOpenApiContract(candidate)) return [];
  if (isOpenApiContract(baseline) || isOpenApiContract(candidate)) return [];
  const beforeNodes = collectContractNodes(baseline);
  const afterNodes = collectContractNodes(candidate);
  const unchanged: UnchangedNode[] = [];
  for (const [pointer, node] of beforeNodes) {
    const other = afterNodes.get(pointer);
    if (other && node.kinds.join("|") === other.kinds.join("|") && node.required === other.required) {
      unchanged.push({ pointer, label: node.label, kinds: node.kinds, required: node.required });
    }
  }
  return unchanged.sort((a, b) => pointerDepth(a.pointer) - pointerDepth(b.pointer) || a.pointer.localeCompare(b.pointer));
}
