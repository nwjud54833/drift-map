import { describe, expect, it } from "vitest";
import { compareContracts } from "@/lib/contract/compare";
import { inferContract } from "@/lib/contract/infer";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { EXAMPLE_DIFF_PRESETS } from "@/lib/workbench/example-presets";

function comparePreset(id: (typeof EXAMPLE_DIFF_PRESETS)[number]["id"]) {
  const preset = EXAMPLE_DIFF_PRESETS.find((item) => item.id === id)!;
  const baseline = parseImportArtifact(preset.baseline, { yaml: preset.yaml, source: "fixture" });
  const candidate = parseImportArtifact(preset.candidate, { yaml: preset.yaml, source: "fixture" });
  expect(baseline.ok).toBe(true);
  expect(candidate.ok).toBe(true);
  if (!baseline.ok || !candidate.ok) throw new Error("Preset fixture must parse");
  return compareContracts(
    baseline.artifact.format === "openapi" ? baseline.artifact.contract : inferContract(baseline.artifact.samples),
    candidate.artifact.format === "openapi" ? candidate.artifact.contract : inferContract(candidate.artifact.samples),
    preset.direction,
  );
}

describe("Workbench example diff presets", () => {
  it("classifies the payment webhook total object conversion and removed currency as breaking", () => {
    const changes = comparePreset("payment-webhook");
    expect(changes.filter((change) => change.severity === "breaking").map((change) => change.pointer)).toEqual(expect.arrayContaining([
      "/data/currency", "/data/total",
    ]));
  });

  it("shows nullable delivery date as a warning and optional tracking metadata as safe", () => {
    const changes = comparePreset("order-fulfillment");
    expect(changes.find((change) => change.pointer === "/delivery_date")?.severity).toBe("warning");
    expect(changes.find((change) => change.pointer === "/tracking_metadata")?.severity).toBe("safe");
  });

  it("parses and classifies both sides of the OpenAPI 3.0 YAML spec upgrade", () => {
    const changes = comparePreset("openapi-upgrade");
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.some((change) => change.pointer.includes("status"))).toBe(true);
  });
});
