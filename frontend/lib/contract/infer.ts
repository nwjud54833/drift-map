import type { ContractNode, ExampleValue, InferredContract, JsonKind, JsonObject, JsonValue, PayloadSample, StringFormatEvidence } from "./types";
import { exampleFor, escapePointerSegment, getJsonKind, pointerLabel } from "./normalize";
import { detectStringFormat, summarizeStringFormats } from "./formats";

interface NodeAccumulator {
  pointer: string;
  kinds: Set<JsonKind>;
  present: Set<number>;
  examples: ExampleValue[];
  /** Tokens for each array item in which this node appeared. */
  itemPresence?: Set<string>;
  /** Total items observed for an array node, including empty arrays. */
  itemCount?: number;
  /** Formats detected across every string value at this node. */
  stringFormats?: Set<StringFormatEvidence>;
}

/** The nearest array wildcard ancestor of a pointer, or null for non-array paths. */
function wildcardPointerFor(pointer: string): string | null {
  const segments = pointer.split("/");
  const index = segments.lastIndexOf("*");
  return index > 0 ? segments.slice(0, index + 1).join("/") : null;
}

/** Deterministic example ordering, independent of sample or array encounter order. */
function compareExamples(a: ExampleValue, b: ExampleValue): number {
  return String(a).localeCompare(String(b)) || (typeof a).localeCompare(typeof b);
}
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) { hash ^= input.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function visit(
  value: JsonValue,
  pointer: string,
  sampleIndex: number,
  nodes: Map<string, NodeAccumulator>,
  itemTotals: Map<string, number>,
  itemToken: string | null,
): void {
  if (!pointer) return;
  const node = nodes.get(pointer) ?? { pointer, kinds: new Set<JsonKind>(), present: new Set<number>(), examples: [] };
  node.kinds.add(getJsonKind(value));
  node.present.add(sampleIndex);
  if (typeof value === "string") {
    node.stringFormats ??= new Set<StringFormatEvidence>();
    node.stringFormats.add(detectStringFormat(value) ?? "plain");
  }
  if (itemToken !== null) {
    node.itemPresence ??= new Set<string>();
    node.itemPresence.add(itemToken);
  }
  const example = exampleFor(value);
  if (!node.examples.some((existing) => Object.is(existing, example))) node.examples.push(example);
  nodes.set(pointer, node);
  if (Array.isArray(value)) {
    // Every item is visited; `itemCount` and `itemTotals` make missing fields
    // inside array items observable rather than collapsing them into "present".
    node.itemCount = (node.itemCount ?? 0) + value.length;
    const itemPointer = `${pointer}/*`;
    value.forEach((item, index) => {
      itemTotals.set(itemPointer, (itemTotals.get(itemPointer) ?? 0) + 1);
      const token = `${sampleIndex}|${itemPointer}|${index}|${itemToken ?? ""}`;
      visit(item, itemPointer, sampleIndex, nodes, itemTotals, token);
    });
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) visit(child, `${pointer}/${escapePointerSegment(key)}`, sampleIndex, nodes, itemTotals, itemToken);
  }
}

export function inferContract(samples: PayloadSample[], generatedAt = new Date().toISOString()): InferredContract {
  if (!samples.length) throw new Error("At least one sample is required to infer a contract.");
  const nodes = new Map<string, NodeAccumulator>();
  const itemTotals = new Map<string, number>();
  const rootKinds = new Set<JsonKind>();
  samples.forEach((sample, index) => {
    rootKinds.add(getJsonKind(sample.value));
    for (const [key, child] of Object.entries(sample.value)) visit(child, `/${escapePointerSegment(key)}`, index, nodes, itemTotals, null);
  });
  const contractNodes: ContractNode[] = [...nodes.values()].map((node) => {
    const wildcardPointer = wildcardPointerFor(node.pointer);
    const totalItems = wildcardPointer !== null && itemTotals.has(wildcardPointer)
      ? itemTotals.get(wildcardPointer)!
      : undefined;
    const presentInItems = totalItems === undefined ? undefined : node.itemPresence?.size ?? 0;
    const stringFormat = summarizeStringFormats(node.stringFormats);
    return {
      pointer: node.pointer,
      label: pointerLabel(node.pointer),
      kinds: [...node.kinds].sort(),
      presentInSamples: node.present.size,
      totalSamples: samples.length,
      required: node.present.size === samples.length && (totalItems === undefined || presentInItems === totalItems),
      examples: [...node.examples].sort(compareExamples).slice(0, 3),
      ...(node.kinds.has("array") ? { itemCount: node.itemCount ?? 0 } : {}),
      ...(totalItems === undefined ? {} : { presentInItems, totalItems }),
      ...(stringFormat ? { sampleFormat: stringFormat.format, sampleFormats: stringFormat.formats } : {}),
    };
  }).sort((a, b) => a.pointer.localeCompare(b.pointer));
  const canonical = JSON.stringify({ rootKinds: [...rootKinds].sort(), nodes: contractNodes.map(({ pointer, kinds, required, sampleFormat }) => ({ pointer, kinds, required, sampleFormat })) });
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
