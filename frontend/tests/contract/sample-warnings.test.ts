import { describe, expect, it } from "vitest";
import type { ContractSnapshot, OpenApiContract, PayloadSample, Workspace } from "@/lib/contract/types";
import { inferContract } from "@/lib/contract/infer";
import { buildDiff } from "@/lib/contract/compare";
import { buildMarkdownReport, buildWorkspaceExport } from "@/lib/contract/export";
import {
  SAMPLE_COUNT_DISPARITY_FACTOR,
  sampleWarningsForCounts,
  sampleWarningsForSnapshots,
} from "@/lib/contract/sample-warnings";

function sample(index: number): PayloadSample {
  return {
    id: `s${index}`,
    label: `s${index}`,
    source: "paste",
    capturedAt: "2026-01-01T00:00:00.000Z",
    value: { id: index },
  };
}

function snapshot(id: string, count: number): ContractSnapshot {
  const samples = Array.from({ length: count }, (_, index) => sample(index));
  return {
    id,
    workspaceId: "ws",
    versionLabel: id,
    notes: "",
    sourceFileName: null,
    samples,
    contract: inferContract(samples, "fixed"),
    createdAt: "fixed",
  };
}

function openApiSnapshot(id: string): ContractSnapshot {
  const contract: OpenApiContract = { kind: "openapi", version: "3.0", title: "Example", document: {}, operations: [], nodes: [] };
  return {
    id,
    workspaceId: "ws",
    versionLabel: id,
    notes: "",
    sourceFileName: null,
    samples: [],
    contract,
    createdAt: "fixed",
  };
}

const workspace: Workspace = {
  id: "ws",
  name: "Thin evidence",
  direction: "response",
  baselineSnapshotId: "baseline",
  candidateSnapshotId: "candidate",
  createdAt: "fixed",
  updatedAt: "fixed",
};

describe("sample-count warnings", () => {
  it("defines significance as a fourfold difference", () => {
    expect(SAMPLE_COUNT_DISPARITY_FACTOR).toBe(4);
  });

  it("warns when either side has one sample", () => {
    const warnings = sampleWarningsForCounts(1, 3);
    expect(warnings.map((warning) => warning.code)).toEqual(["single-sample"]);
    expect(warnings[0].message).toContain("Requiredness is based on the samples provided and may not reflect the real API.");
  });

  it("warns when the sample counts differ by the configured factor", () => {
    for (const [baseline, candidate] of [[1, 10], [4, 1], [2, 8], [8, 2]]) {
      expect(sampleWarningsForCounts(baseline, candidate).some((warning) => warning.code === "sample-count-disparity")).toBe(true);
    }
    expect(sampleWarningsForCounts(3, 10).some((warning) => warning.code === "sample-count-disparity")).toBe(false);
    expect(sampleWarningsForCounts(2, 7).some((warning) => warning.code === "sample-count-disparity")).toBe(false);
  });

  it("reports both single-sample and disparity when both apply", () => {
    const warnings = sampleWarningsForCounts(1, 10);
    expect(warnings.map((warning) => warning.code)).toEqual(["single-sample", "sample-count-disparity"]);
    expect(warnings.every((warning) => warning.baselineSamples === 1 && warning.candidateSamples === 10)).toBe(true);
  });

  it("does not warn for balanced samples or samples with no payload evidence", () => {
    expect(sampleWarningsForCounts(5, 5)).toEqual([]);
    expect(sampleWarningsForCounts(0, 10)).toEqual([]);
    expect(sampleWarningsForCounts(10, 0)).toEqual([]);
  });

  it("ignores OpenAPI snapshots because they carry no payload samples", () => {
    expect(sampleWarningsForSnapshots(openApiSnapshot("baseline"), snapshot("candidate", 1))).toEqual([]);
    expect(sampleWarningsForSnapshots(snapshot("baseline", 10), openApiSnapshot("candidate"))).toEqual([]);
  });
});

describe("sample warnings in exports", () => {
  it("adds a machine-readable flag and a visible notice to Markdown", () => {
    const baseline = snapshot("baseline", 1);
    const candidate = snapshot("candidate", 10);
    const report = buildMarkdownReport(workspace, baseline, candidate, buildDiff("baseline", "candidate", "response", []));
    expect(report).toContain("sampleWarnings:");
    expect(report).toContain("single-sample");
    expect(report).toContain("sample-count-disparity");
    expect(report).toContain("## Sample warnings");
    expect(report).toContain("Requiredness is based on the samples provided");
  });

  it("keeps an empty sampleWarnings array in Markdown when evidence is sufficient", () => {
    const baseline = snapshot("baseline", 5);
    const candidate = snapshot("candidate", 5);
    const report = buildMarkdownReport(workspace, baseline, candidate, buildDiff("baseline", "candidate", "response", []));
    expect(report).toContain("sampleWarnings: []");
    expect(report).not.toContain("## Sample warnings");
  });

  it("adds sampleWarnings to the workspace JSON export", () => {
    const exported = JSON.parse(buildWorkspaceExport(workspace, snapshot("baseline", 1), snapshot("candidate", 10))) as {
      sampleWarnings: Array<{ code: string }>;
    };
    expect(exported.sampleWarnings.map((warning) => warning.code)).toEqual(["single-sample", "sample-count-disparity"]);
  });
});
