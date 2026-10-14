import { describe, expect, it } from "vitest";
import { displayFingerprint, ghostPointers, snapshotFingerprint } from "@/lib/workbench/fingerprint";
import { inferContract } from "@/lib/contract/infer";
import type { ContractSnapshot, OpenApiContract, PayloadSample } from "@/lib/contract/types";

function sample(value: PayloadSample["value"], id = "s1"): PayloadSample {
  return { id, label: id, value, source: "paste", capturedAt: "2026-01-01T00:00:00.000Z" };
}

function snapshot(id: string, samples: PayloadSample[]): ContractSnapshot {
  return { id, workspaceId: "w", versionLabel: id, notes: "", sourceFileName: null, samples, contract: inferContract(samples, "test"), createdAt: "2026-01-01T00:00:00.000Z" };
}

const openApiContract: OpenApiContract = {
  kind: "openapi",
  version: "3.0",
  title: "Orders",
  document: {},
  operations: [],
  nodes: [
    { pointer: "/orders", label: "orders", kinds: ["array"], presentInSamples: 0, totalSamples: 0, required: false, examples: [] },
    { pointer: "/orders/*/id", label: "id", kinds: ["string"], presentInSamples: 0, totalSamples: 0, required: false, examples: [] },
  ],
};

describe("displayFingerprint", () => {
  it("returns the engine's fingerprint verbatim for sample-derived contracts", () => {
    const contract = inferContract([sample({ id: "ORD-1" })], "test");
    expect(displayFingerprint(contract)).toBe(contract.fingerprint);
    expect(displayFingerprint(contract)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("derives a distinct, prefixed identity for OpenAPI contracts", () => {
    const value = displayFingerprint(openApiContract);
    expect(value).toMatch(/^oas-[0-9a-f]{8}$/);
  });

  it("is stable across calls and independent of node array identity", () => {
    const clone: OpenApiContract = { ...openApiContract, nodes: openApiContract.nodes.map((node) => ({ ...node })) };
    expect(displayFingerprint(clone)).toBe(displayFingerprint(openApiContract));
  });

  it("changes when the inferred structure changes", () => {
    const changed: OpenApiContract = {
      ...openApiContract,
      nodes: openApiContract.nodes.map((node) => (node.pointer === "/orders/*/id" ? { ...node, kinds: ["number"] } : node)),
    };
    expect(displayFingerprint(changed)).not.toBe(displayFingerprint(openApiContract));
  });

  it("returns null when there is no contract", () => {
    expect(displayFingerprint(null)).toBeNull();
    expect(displayFingerprint(undefined)).toBeNull();
    expect(snapshotFingerprint(null)).toBeNull();
  });

  it("reads the fingerprint through a snapshot, matching a direct inference", () => {
    const payload = [sample({ id: "ORD-1" })];
    const withSamples = snapshot("snap", payload);
    // Derived from the snapshot's stored contract, not re-inferred, so the
    // value is identical to a direct inference over the same samples.
    expect(snapshotFingerprint(withSamples)).toBe(inferContract(payload, "test").fingerprint);
    expect(snapshotFingerprint(withSamples)).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("ghostPointers", () => {
  it("lists paths present on the other side only", () => {
    const baseline = snapshot("base", [sample({ id: "ORD-1", status: "shipped" })]);
    const candidate = snapshot("cand", [sample({ id: "ORD-1", total_cents: 100 })]);
    expect(ghostPointers(candidate, baseline)).toEqual(["/total_cents"]);
    expect(ghostPointers(baseline, candidate)).toEqual(["/status"]);
  });

  it("returns nothing when both sides share every path", () => {
    const baseline = snapshot("base", [sample({ id: "ORD-1" })]);
    const candidate = snapshot("cand", [sample({ id: "ORD-2" })]);
    expect(ghostPointers(candidate, baseline)).toEqual([]);
  });

  it("returns nothing when the other side is missing", () => {
    expect(ghostPointers(null, snapshot("base", [sample({ id: "ORD-1" })]))).toEqual([]);
  });

  it("does not mutate the contracts it reads", () => {
    const baseline = snapshot("base", [sample({ id: "ORD-1", status: "shipped" })]);
    const before = baseline.contract.nodes.map((node) => node.pointer);
    ghostPointers(snapshot("cand", [sample({ id: "ORD-1" })]), baseline);
    expect(baseline.contract.nodes.map((node) => node.pointer)).toEqual(before);
  });
});
