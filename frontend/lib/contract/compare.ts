import type { ChangeKind, ContractChange, ContractDirection, ContractNode, InferredContract } from "./types";
import { classifyChange } from "./compatibility";
import { pointerDepth } from "./normalize";
import { collectContractNodes } from "./infer";

const severityRank = { breaking: 0, warning: 1, safe: 2, info: 3 } as const;
function makeChange(pointer: string, kind: ChangeKind, before: ContractNode | null, after: ContractNode | null, direction: ContractDirection): ContractChange {
  const severity = classifyChange(kind, direction, before?.required ?? false, after?.required ?? false);
  const names: Record<ChangeKind, string> = { "field-added": "Field added", "field-removed": "Field removed", "type-changed": "Type changed", "became-required": "Field became required", "became-optional": "Field became optional" };
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
  return { id: `${pointer}:${kind}`, pointer, kind, severity, title: names[kind], explanation, before, after };
}

export function compareContracts(baseline: InferredContract, candidate: InferredContract, direction: ContractDirection): ContractChange[] {
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
