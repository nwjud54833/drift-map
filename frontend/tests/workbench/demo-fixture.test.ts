import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/order-shipped.fixture.json";
import { inferContract } from "@/lib/contract/infer";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import type { PayloadSample } from "@/lib/contract/types";

function samples(values: readonly unknown[], tag: string): PayloadSample[] {
  return values.map((value, index) => ({
    id: `${tag}_${index}`,
    label: `sample ${index + 1}`,
    value: value as PayloadSample["value"],
    source: "fixture",
    capturedAt: "2026-01-01T00:00:00.000Z",
  }));
}

/**
 * The "Load sample payloads" onboarding path is described in the UI. These tests
 * hold that copy to the engine's actual output, so the wording cannot silently
 * drift away from what the sample pair really demonstrates.
 *
 * Measured behaviour of the bundled fixture (see the assertions below):
 *   direction "event"    / "response" → 6 breaking, 10 warning, 0 safe
 *   direction "request"               → 15 breaking, 0 warning, 1 safe
 *
 * There is therefore no direction in which this pair shows all three of
 * breaking, warning and safe at once, which is why the UI copy does not claim it.
 */
describe("bundled sample payload pair", () => {
  const baseline = inferContract(samples(fixture.baseline, "b"), "test");
  const candidate = inferContract(samples(fixture.candidate, "c"), "test");
  const changes = compareContracts(baseline, candidate, "event");
  const diff = buildDiff("b", "c", "event", changes);

  it("infers a contract with normalised array wildcard paths", () => {
    expect(baseline.nodes.length).toBeGreaterThan(10);
    expect(baseline.nodes.some((node) => node.pointer === "/data/items/*/sku")).toBe(true);
    expect(baseline.fingerprint).toMatch(/^[0-9a-f]{8}$/);
  });

  it("classifies the removed customer email as breaking", () => {
    const removed = changes.find((change) => change.pointer === "/data/customer/email");
    expect(removed?.kind).toBe("field-removed");
    expect(removed?.severity).toBe("breaking");
  });

  it("classifies the added required schema_version as a warning for event payloads", () => {
    const added = changes.find((change) => change.pointer === "/schema_version");
    expect(added?.kind).toBe("field-added");
    expect(added?.severity).toBe("warning");
  });

  it("shows breaking removals and warnings for the default event direction", () => {
    expect(diff.summary.breaking).toBe(6);
    expect(diff.summary.warning).toBe(10);
    expect(diff.summary.safe).toBe(0);
    expect(diff.summary.total).toBe(16);
    // A nested restructure is surfaced, not flattened away.
    expect(changes.some((change) => change.pointer === "/data/total/amount")).toBe(true);
    expect(changes.some((change) => change.pointer === "/data/items/*/unit_price/currency")).toBe(true);
  });

  it("shows a safe finding only for the request direction", () => {
    const requestDiff = buildDiff("b", "c", "request", compareContracts(baseline, candidate, "request"));
    expect(requestDiff.summary.safe).toBe(1);
    expect(requestDiff.summary.warning).toBe(0);
    const safe = compareContracts(baseline, candidate, "request").find((change) => change.severity === "safe");
    expect(safe?.pointer).toBe("/data/discount_cents");
  });

  it("is deterministic: the same inputs produce the same fingerprint and diff", () => {
    const again = inferContract(samples(fixture.baseline, "b"), "test");
    expect(again.fingerprint).toBe(baseline.fingerprint);
    expect(buildDiff("b", "c", "event", compareContracts(again, candidate, "event")).summary).toEqual(diff.summary);
  });
});
