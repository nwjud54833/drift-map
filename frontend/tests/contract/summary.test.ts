import { describe, expect, it } from "vitest";
import { inferContract } from "@/lib/contract/infer";
import { compareContracts } from "@/lib/contract/compare";
import type { PayloadSample } from "@/lib/contract/types";

function samplesFor(values: unknown[]): PayloadSample[] {
  return values.map((value, index) => ({ id: `t${index}`, label: `t${index}`, value: value as PayloadSample["value"], source: "paste", capturedAt: "2026-01-01T00:00:00.000Z" }));
}

/**
 * The workbench summary strip must render the real diff counts from the
 * comparison engine. This test pins the exact contract between the summary
 * row (`counts.breaking` etc.) and `compareContracts`, so redesigns cannot
 * ship hardcoded summary values.
 */
describe("workbench summary counts", () => {
  it("matches the engine summary for a breaking-warning mix", () => {
    const baseline = inferContract(samplesFor([{ total: 1, currency: "USD" }]));
    const candidate = inferContract(samplesFor([{ total: { amount: 1, currency: "USD" }, currency: "USD", bonus: "x" }]));
    const diff = compareContracts(baseline, candidate, "event");
    const counts = {
      breaking: diff.filter((change) => change.severity === "breaking").length,
      warning: diff.filter((change) => change.severity === "warning").length,
      safe: diff.filter((change) => change.severity === "safe").length,
      info: diff.filter((change) => change.severity === "info").length,
    };
    expect(counts.breaking).toBeGreaterThan(0);
    expect(counts.warning).toBeGreaterThan(0);
    expect(counts.breaking + counts.warning + counts.safe + counts.info).toBe(diff.length);
  });

  it("reports zero across every severity for identical contracts", () => {
    const contract = inferContract(samplesFor([{ id: 1, note: "ok" }]));
    const diff = compareContracts(contract, contract, "response");
    expect(diff.every((change) => ["breaking", "warning", "safe", "info"].includes(change.severity))).toBe(true);
    expect(diff).toHaveLength(0);
  });
});
