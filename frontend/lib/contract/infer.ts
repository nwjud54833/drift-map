import type { ContractNode, ExampleValue, InferredContract, JsonKind, JsonObject, JsonValue, PayloadSample } from "./types";
import { exampleFor, escapePointerSegment, getJsonKind, pointerLabel } from "./normalize";

interface NodeAccumulator { pointer: string; kinds: Set<JsonKind>; present: Set<number>; examples: ExampleValue[] }

/** Deterministic example ordering, independent of sample or array encounter order. */
function compareExamples(a: ExampleValue, b: ExampleValue): number {
  return String(a).localeCompare(String(b)) || (typeof a).localeCompare(typeof b);
}
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function visit(value: JsonValue, pointer: string, sampleIndex: number, nodes: Map<string, NodeAccumulator>): void {
  if (!pointer) return;
  const node = nodes.get(pointer) ?? { pointer, kinds: new Set<JsonKind>(), present: new Set<number>(), examples: [] };
  node.kinds.add(getJsonKind(value));
  node.present.add(sampleIndex);
  const example = exampleFor(value);
  if (!node.examples.some((existing) => Object.is(existing, example))) node.examples.push(example);
  nodes.set(pointer, node);
  if (Array.isArray(value)) {
    for (const item of value) visit(item, `${pointer}/*`, sampleIndex, nodes);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) visit(child, `${pointer}/${escapePointerSegment(key)}`, sampleIndex, nodes);
  }
}

export function inferContract(samples: PayloadSample[], generatedAt = new Date().toISOString()): InferredContract {
  if (!samples.length) throw new Error("At least one sample is required to infer a contract.");
  const nodes = new Map<string, NodeAccumulator>();
  const rootKinds = new Set<JsonKind>();
  samples.forEach((sample, index) => {
    rootKinds.add(getJsonKind(sample.value));
    for (const [key, child] of Object.entries(sample.value)) visit(child, `/${escapePointerSegment(key)}`, index, nodes);
  });
  const contractNodes: ContractNode[] = [...nodes.values()].map((node) => ({
    pointer: node.pointer,
    label: pointerLabel(node.pointer),
    kinds: [...node.kinds].sort(),
    presentInSamples: node.present.size,
    totalSamples: samples.length,
    required: node.present.size === samples.length,
    examples: [...node.examples].sort(compareExamples).slice(0, 3),
  })).sort((a, b) => a.pointer.localeCompare(b.pointer));
  const canonical = JSON.stringify({ rootKinds: [...rootKinds].sort(), nodes: contractNodes.map(({ pointer, kinds, required }) => ({ pointer, kinds, required })) });
  return { rootKinds: [...rootKinds].sort(), nodes: contractNodes, fingerprint: hashString(canonical), generatedAt, inferenceVersion: 1 };
}

export function collectContractNodes(contract: InferredContract): Map<string, ContractNode> {
  return new Map(contract.nodes.map((node) => [node.pointer, node]));
}

export function normalizeJsonValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (value !== null && typeof value === "object") {
    const object = value as JsonObject;
    return Object.fromEntries(Object.keys(object).sort().map((key) => [key, normalizeJsonValue(object[key])])) as JsonObject;
  }
  return value;
}
