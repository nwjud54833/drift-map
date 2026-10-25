import { describe, expect, it } from "vitest";
import { buildWorkspaceExport } from "@/lib/contract/export";
import { inferContract } from "@/lib/contract/infer";
import type { ContractSnapshot, PayloadSample, Workspace } from "@/lib/contract/types";

const capturedAt = "2026-10-01T00:00:00.000Z";
const samples: PayloadSample[] = [
  { id: "s1", label: "b1", value: { email: "taylor@example.com", tier: "gold" }, source: "fixture", capturedAt },
];
const workspace: Workspace = {
  id: "w1", name: "Orders", direction: "response",
  baselineSnapshotId: "snap-1", candidateSnapshotId: "snap-2",
  createdAt: capturedAt, updatedAt: capturedAt,
};
const baseline: ContractSnapshot = {
  id: "snap-1", workspaceId: "w1", versionLabel: "v1", notes: "", sourceFileName: null,
  samples, contract: inferContract(samples, capturedAt), createdAt: capturedAt,
};
const openApiSnapshot: ContractSnapshot = {
  id: "snap-3", workspaceId: "w1", versionLabel: "spec", notes: "", sourceFileName: null,
  samples: [],
  contract: {
    kind: "openapi", version: "3.0", title: "Orders API",
    document: { openapi: "3.0.3", "x-internal": "keep-out" }, operations: [], nodes: [],
  },
  createdAt: capturedAt,
};

describe("workspace export redaction", () => {
  it("keeps sample values and observed examples by default (local fidelity)", () => {
    const exported = JSON.parse(buildWorkspaceExport(workspace, baseline, null));
    expect(exported.sampleValuesRedacted).toBeUndefined();
    expect(exported.baseline.samples[0].value).toEqual({ email: "taylor@example.com", tier: "gold" });
    expect(exported.baseline.contract.nodes.some((node: { examples: unknown[] }) => node.examples.length > 0)).toBe(true);
  });

  it("strips sample values and observed examples when redaction is requested", () => {
    const exported = JSON.parse(buildWorkspaceExport(workspace, baseline, null, { redactSamples: true }));
    expect(exported.sampleValuesRedacted).toBe(true);
    expect(exported.baseline.samples[0].value).toBeUndefined();
    expect(exported.baseline.samples[0].label).toBe("b1");
    expect(exported.baseline.contract.nodes.every((node: { examples: unknown[] }) => node.examples.length === 0)).toBe(true);
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toContain("taylor@example.com");
  });

  it("omits OpenAPI document bodies from redacted exports", () => {
    const exported = JSON.parse(buildWorkspaceExport(workspace, openApiSnapshot, null, { redactSamples: true }));
    expect(exported.baseline.contract.document).toEqual({ redacted: true, note: "The OpenAPI document was omitted from this redacted export." });
    expect(JSON.stringify(exported)).not.toContain("keep-out");
    // Unredacted exports keep the document verbatim.
    const plain = JSON.parse(buildWorkspaceExport(workspace, openApiSnapshot, null));
    expect(plain.baseline.contract.document).toEqual({ openapi: "3.0.3", "x-internal": "keep-out" });
  });
});
