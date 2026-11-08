import { describe, expect, it } from "vitest";
import type { ContractSnapshot, Workspace } from "@/lib/contract/types";
import { inferContract } from "@/lib/contract/infer";
import { buildReviewPayload, decodeReviewState, encodeReviewState, parseReviewPayload } from "@/lib/workbench/review-link";

const workspace: Workspace = {
  id: "local-orders", name: "Orders API", direction: "response",
  baselineSnapshotId: "base", candidateSnapshotId: "candidate",
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
};

function snapshot(id: string, value: { orderId: string; total?: number }): ContractSnapshot {
  const samples = [{ id: `${id}-sample`, label: id, value, source: "paste" as const, capturedAt: "2026-01-01T00:00:00.000Z" }];
  return { id, workspaceId: workspace.id, versionLabel: id, notes: "", sourceFileName: null, samples, contract: inferContract(samples), createdAt: samples[0].capturedAt };
}

describe("read-only review links", () => {
  it("compresses a local review state into URL-safe data and restores the comparison inputs", async () => {
    const payload = buildReviewPayload(workspace, snapshot("v1", { orderId: "o-1", total: 42 }), snapshot("v2", { orderId: "o-1" }));
    const encoded = await encodeReviewState(payload);
    expect(encoded).toMatch(/^z\.[A-Za-z0-9_-]+$/);
    const preview = await decodeReviewState(encoded);
    expect(preview?.workspace.name).toBe("Orders API");
    expect(preview?.baseline.samples[0]?.value).toEqual({ orderId: "o-1", total: 42 });
    expect(preview?.candidate.samples[0]?.value).toEqual({ orderId: "o-1" });
  });

  it("rejects malformed or unsupported review payloads", () => {
    expect(parseReviewPayload({ version: 2 })).toBeNull();
    expect(parseReviewPayload({ version: 1, workspace: { id: "x", name: "x", direction: "response" }, baseline: {}, candidate: {} })).toBeNull();
  });
});
