import { describe, expect, it } from "vitest";
import type { ChangeKind, ContractChange, ContractDirection, ContractNode, JsonKind } from "@/lib/contract/types";
import { inferContract } from "@/lib/contract/infer";
import { compareContracts } from "@/lib/contract/compare";
import { buildTimeline, toFinding, presencePercent, applyChangeToValue } from "@/lib/driftmap/presentation";
import { driftLabelFor, ruleIdFor, severityPillClass, severityStrokeColor } from "@/lib/driftmap/rules";
import { presenceSeries, sparklinePointsAttr } from "@/lib/driftmap/sparkline";
import { astDiffInputFor, buildSplitAstDiffHTML, escapeHtml } from "@/lib/driftmap/ast-diff";

function node(pointer: string, kinds: JsonKind[], required: boolean, present: number, total: number, examples: (string | number | boolean | null)[] = []): ContractNode {
  return { pointer, label: pointer.split("/").pop() ?? pointer, kinds, presentInSamples: present, totalSamples: total, required, examples };
}

function change(
  pointer: string,
  kind: ChangeKind,
  severity: ContractChange["severity"],
  before: ContractNode | null,
  after: ContractNode | null,
): ContractChange {
  return { id: `${pointer}:${kind}`, pointer, kind, severity, title: "Title", explanation: "Explanation", before, after };
}

const demoBaseline = [
  { id: "s1", label: "b1", source: "fixture" as const, capturedAt: "2026-10-07T09:00:00.000Z", value: { order_id: "A", customer: { email: "a@b.co", age: "29" }, items: [{ sku: "A-10", qty: 2 }] } },
  { id: "s2", label: "b2", source: "fixture" as const, capturedAt: "2026-10-07T09:00:00.000Z", value: { order_id: "B", customer: { email: "b@b.co", age: "31" }, items: [{ sku: "B-44", qty: 1 }] } },
];

const demoCandidate = [
  { id: "c1", label: "c1", source: "fixture" as const, capturedAt: "2026-10-07T09:00:00.000Z", value: { order_id: "C", customer: { age: null, nickname: "ada" }, items: [{ sku: 1042, qty: 2 }] } },
];

/** Ordering used to assert the timeline's severity ladder. */
const SEVERITY_RANK = { info: 0, safe: 1, warning: 2, breaking: 3 } as const;

describe("driftmap presentation adapter", () => {
  it("relabels the engine's change kinds without inventing new severities", () => {
    const context = { direction: "response" as ContractDirection, candidateVersion: "v2.0-rc1" };
    const removed = toFinding(
      change("/customer/email", "field-removed", "breaking", node("/customer/email", ["string"], true, 3, 3, ["a@b.co"]), null),
      context,
    );

    expect(removed.severity).toBe("breaking");
    expect(removed.ruleId).toBe("RULE_REQUIRED_FIELD_REMOVED");
    expect(removed.driftLabel).toBe("Breaking · removed");
    expect(removed.fromType).toBe("string");
    expect(removed.toType).toBe("missing");
    expect(removed.baseSummary).toBe("string · required");
    expect(removed.candSummary).toBe("— missing");
    expect(removed.baseSample).toBe('"a@b.co"');
    expect(removed.candSample).toBeNull();
    expect(removed.hasSampleEvidence).toBe(true);
  });

  it("never recomputes severity: it copies the engine's classification verbatim", () => {
    const context = { direction: "request" as ContractDirection, candidateVersion: "candidate" };
    // The engine calls an optional request-field removal `safe`; the adapter must agree.
    const finding = toFinding(
      change("/note", "field-removed", "safe", node("/note", ["string"], false, 1, 3), null),
      context,
    );
    expect(finding.severity).toBe("safe");
    expect(finding.driftLabel).toBe("Warning · opt removed");
  });

  it("marks declaration-only contracts as having no sample evidence", () => {
    const finding = toFinding(
      change("/paths/~1orders/get", "response-schema-changed", "warning", node("/paths/~1orders/get", ["object"], false, 0, 0), node("/paths/~1orders/get", ["object"], false, 0, 0)),
      { direction: "response", candidateVersion: "candidate" },
    );
    expect(finding.hasSampleEvidence).toBe(false);
    expect(finding.totalSamples).toBe(0);
    expect(presencePercent(finding)).toBe(0);
  });

  it("computes the presence readout from the engine's evidence", () => {
    const finding = toFinding(
      change("/a", "became-optional", "info", node("/a", ["string"], true, 3, 3), node("/a", ["string"], false, 1, 3)),
      { direction: "event", candidateVersion: "candidate" },
    );
    expect(finding.presentCount).toBe(1);
    expect(finding.totalSamples).toBe(3);
    expect(presencePercent(finding)).toBe(33);
  });

  it("produces the reference build's pill and stroke vocabulary for every severity", () => {
    expect(severityPillClass("breaking")).toBe("pill-breaking");
    expect(severityPillClass("warning")).toBe("pill-warning");
    expect(severityPillClass("safe")).toBe("pill-safe");
    expect(severityPillClass("info")).toBe("pill-info");
    expect(severityStrokeColor("breaking")).toBe("#FB7185");
    expect(severityStrokeColor("warning")).toBe("#FBBF24");
    expect(severityStrokeColor("safe")).toBe("#34D399");
    expect(severityStrokeColor("info")).toBe("#38BDF8");
  });

  it("maps every engine change kind to a rule identifier", () => {
    expect(ruleIdFor("type-changed", "response")).toBe("RULE_WIRE_TYPE_CHANGED");
    expect(ruleIdFor("nullability-changed", "response")).toBe("RULE_FIELD_BECAME_NULLABLE");
    expect(ruleIdFor("field-added", "response")).toBe("RULE_OPTIONAL_FIELD_ADDED");
    expect(ruleIdFor("contract-format-changed", "response")).toBe("RULE_CONTRACT_FORMAT_CHANGED");
    // Direction matters for `became-optional`: optional request fields are safe.
    expect(ruleIdFor("became-optional", "request")).toBe("RULE_OPTIONAL_FIELD_REMOVED");
    expect(ruleIdFor("became-optional", "response")).toBe("RULE_REQUIRED_TO_OPTIONAL");
  });

  it("maps a sampled string format change to its own rule", () => {
    const iso = { ...node("/when", ["string"], true, 2, 2), sampleFormat: "iso-date" as const };
    const dayFirst = { ...node("/when", ["string"], true, 2, 2), sampleFormat: "day-first-date" as const };
    expect(ruleIdFor("format-changed", "response", iso, dayFirst)).toBe("RULE_STRING_FORMAT_CHANGED");
    expect(ruleIdFor("format-changed", "response")).toBe("RULE_WIRE_TYPE_CHANGED");

    const finding = toFinding(
      change("/when", "format-changed", "warning", iso, dayFirst),
      { direction: "response", candidateVersion: "candidate" },
    );
    expect(finding.ruleId).toBe("RULE_STRING_FORMAT_CHANGED");
    expect(finding.driftLabel).toBe("Warning · string format changed");
    expect(finding.fromFormat).toBe("iso-date");
    expect(finding.toFormat).toBe("day-first-date");
    expect(finding.baseSummary).toContain("ISO date");
    expect(finding.candSummary).toContain("day-first date");
    expect(finding.ruleExplanation).toContain("heuristic");
  });

  it("maps each nullability change to its dedicated rule", () => {
    const nonNull = node("/phone", ["string"], true, 2, 2);
    const nullable = node("/phone", ["null", "string"], true, 2, 2);
    const onlyNull = node("/phone", ["null"], true, 2, 2);
    expect(ruleIdFor("nullability-changed", "response", nonNull, onlyNull)).toBe("RULE_NULL_INTRODUCED");
    expect(ruleIdFor("nullability-changed", "response", nonNull, nullable)).toBe("RULE_FIELD_BECAME_NULLABLE");
    expect(ruleIdFor("nullability-changed", "response", null, nullable)).toBe("RULE_NULLABLE_ADDED");
    expect(ruleIdFor("nullability-changed", "response", nullable, nonNull)).toBe("RULE_NULLABILITY_REMOVED");
    expect(ruleIdFor("field-removed", "response", onlyNull, null)).toBe("RULE_NULLABLE_FIELD_REMOVED");
    expect(ruleIdFor("field-added", "response", null, onlyNull)).toBe("RULE_NULLABLE_ADDED");
  });

  it("labels nullability changes without recomputing severity", () => {
    const nonNull = node("/phone", ["string"], true, 2, 2);
    const nullable = node("/phone", ["null", "string"], true, 2, 2);
    const onlyNull = node("/phone", ["null"], true, 2, 2);
    expect(driftLabelFor("nullability-changed", "breaking", "response", false, nonNull, onlyNull)).toBe("Breaking · null introduced");
    expect(driftLabelFor("nullability-changed", "warning", "response", false, nonNull, nullable)).toBe("Warning · became nullable");
    expect(driftLabelFor("nullability-changed", "warning", "response", false, null, nullable)).toBe("Warning · nullable added");
    expect(driftLabelFor("nullability-changed", "safe", "response", false, nullable, nonNull)).toBe("Safe · null removed");
  });

  it("surfaces the null-introduced rule and strict-client impact in a finding", () => {
    const nonNull = node("/phone", ["string"], true, 2, 2);
    const onlyNull = node("/phone", ["null"], true, 2, 2);
    const finding = toFinding(
      change("/phone", "nullability-changed", "breaking", nonNull, onlyNull),
      { direction: "response", candidateVersion: "candidate" },
    );
    expect(finding.ruleId).toBe("RULE_NULL_INTRODUCED");
    expect(finding.driftLabel).toBe("Breaking · null introduced");
    expect(finding.ruleExplanation).toContain("statically typed clients");
  });

  it("describes each change kind using only conditions the engine reports", () => {
    expect(driftLabelFor("type-changed", "breaking", "response")).toBe("Breaking · type narrowed");
    expect(driftLabelFor("nullability-changed", "warning", "response")).toBe("Warning · nullable");
    expect(driftLabelFor("field-added", "safe", "response")).toBe("Safe · added optional");
    expect(driftLabelFor("field-added", "warning", "response")).toBe("Warning · added required");
    expect(driftLabelFor("contract-format-changed", "warning", "response")).toBe("Warning · review");
  });
});

describe("presence sparkline", () => {
  it("holds flat at the measured presence", () => {
    expect(presenceSeries(3, 3, "flat")).toEqual([100, 100, 100, 100, 100, 100, 100]);
    expect(presenceSeries(0, 3, "flat")).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("trends toward the measured endpoint in both directions", () => {
    const falling = presenceSeries(0, 3, "falling");
    expect(falling[0]).toBe(100);
    expect(falling[falling.length - 1]).toBe(0);
    // Monotonically non-increasing.
    expect(falling.every((value, index) => index === 0 || value <= falling[index - 1])).toBe(true);

    const rising = presenceSeries(2, 3, "rising");
    expect(rising[0]).toBe(0);
    expect(rising[rising.length - 1]).toBe(67);
    expect(rising.every((value, index) => index === 0 || value >= rising[index - 1])).toBe(true);
  });

  it("is safe when a contract has no samples at all", () => {
    expect(presenceSeries(0, 0, "flat").every((value) => value === 0)).toBe(true);
  });

  it("emits a polyline point list of the expected shape", () => {
    const points = sparklinePointsAttr([0, 50, 100]);
    const pairs = points.split(" ");
    expect(pairs).toHaveLength(3);
    for (const pair of pairs) expect(pair).toMatch(/^[\d.]+,[\d.]+$/);
  });
});

describe("split JSON AST diff", () => {
  it("escapes every interpolated value so a payload cannot inject markup", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");

    const html = buildSplitAstDiffHTML({
      pointer: '/data/<script>alert("x")</script>',
      severity: "breaking",
      baselineExample: '"<b>bold</b>"',
      candidateExample: null,
      baselineAbsent: false,
      candidateAbsent: true,
      added: false,
      candidateVersion: "v2.0-rc1",
    });

    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<b>bold</b>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("ast-line-breaking");
  });

  it("renders the removed-key form when the candidate lacks the path", () => {
    const html = buildSplitAstDiffHTML({
      pointer: "/customer/email",
      severity: "breaking",
      baselineExample: '"a@b.co"',
      candidateExample: null,
      baselineAbsent: false,
      candidateAbsent: true,
      added: false,
      candidateVersion: "v2.0-rc1",
    });
    expect(html).toContain('// "email" removed');
    expect(html).toContain("BASELINE AST (v1)");
    expect(html).toContain("CANDIDATE AST (v2.0-rc1)");
  });

  it("uses the array container form for wildcard pointers", () => {
    const html = buildSplitAstDiffHTML({
      pointer: "/items/*/sku",
      severity: "breaking",
      baselineExample: '"A-10"',
      candidateExample: "1042",
      baselineAbsent: false,
      candidateAbsent: false,
      added: false,
      candidateVersion: "v2.0-rc1",
    });
    expect(html).toContain("items: [ {");
    expect(html).toContain("} ]");
  });

  it("derives its slice inputs from a real engine change", () => {
    const finding = toFinding(
      change("/customer/email", "field-removed", "breaking", node("/customer/email", ["string"], true, 3, 3, ["a@b.co"]), null),
      { direction: "response", candidateVersion: "v2.0-rc1" },
    );
    const input = astDiffInputFor(finding.change, "v2.0-rc1");
    expect(input.pointer).toBe("/customer/email");
    expect(input.baselineExample).toBe('"a@b.co"');
    expect(input.candidateAbsent).toBe(true);
    expect(input.added).toBe(false);
  });
});

describe("applyChangeToValue", () => {
  it("removes a key for a field-removed change", () => {
    const result = applyChangeToValue(
      { customer: { email: "a@b.co", age: "29" } },
      change("/customer/email", "field-removed", "breaking", node("/customer/email", ["string"], true, 1, 1), null),
    );
    expect(result).toEqual({ customer: { age: "29" } });
  });

  it("rewrites a value for a type-changed change", () => {
    const result = applyChangeToValue(
      { items: [{ sku: "A-10" }] },
      change("/items/*/sku", "type-changed", "breaking", node("/items/*/sku", ["string"], true, 1, 1), node("/items/*/sku", ["number"], true, 1, 1)),
    );
    expect(result).toEqual({ items: [{ sku: 0 }] });
  });

  it("adds a missing path for a field-added change", () => {
    const result = applyChangeToValue(
      { customer: { age: "29" } },
      change("/customer/nickname", "field-added", "safe", null, node("/customer/nickname", ["string"], false, 1, 1)),
    );
    expect(result).toEqual({ customer: { age: "29", nickname: "value" } });
  });

  it("does not force null back when nullability was removed", () => {
    const result = applyChangeToValue(
      { phone: null },
      change("/phone", "nullability-changed", "safe", node("/phone", ["null", "string"], true, 2, 2), node("/phone", ["string"], true, 2, 2)),
      "555-0100",
    );
    expect(result).toEqual({ phone: "555-0100" });
  });

  it("never mutates the payload it is given", () => {
    const original = { customer: { email: "a@b.co" } };
    applyChangeToValue(original, change("/customer/email", "field-removed", "breaking", node("/customer/email", ["string"], true, 1, 1), null));
    expect(original).toEqual({ customer: { email: "a@b.co" } });
  });

  it("leaves an unrelated path untouched", () => {
    const result = applyChangeToValue(
      { customer: { age: "29" } },
      change("/customer/email", "field-removed", "breaking", node("/customer/email", ["string"], true, 1, 1), null),
    );
    expect(result).toEqual({ customer: { age: "29" } });
  });
});

describe("progressive revision timeline", () => {
  const timeline = buildTimeline(demoBaseline, demoCandidate, "response", "v1");

  it("stops at the baseline, then one stop per severity class the pair exercises", () => {
    // This pair has nothing the engine calls `safe`, so the safe step would be
    // byte-identical to the baseline. It is dropped rather than shown as a
    // revision that changes nothing.
    expect(timeline).toHaveLength(3);
    expect(timeline[0].version).toBe("v1.0.0");
    expect(timeline[timeline.length - 1].version).toBe("v2.0-rc1");
    expect(timeline[0].changes).toHaveLength(0);
    expect(timeline[0].summary).toBe("clean baseline contract");
    expect(timeline[0].tone).toBe("info");
  });

  it("never repeats a contract between consecutive stops", () => {
    const fingerprints = timeline.map((revision) => revision.candidateContract.fingerprint);
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });

  it("walks the severity ladder in order, skipping the classes the pair lacks", () => {
    const steps = timeline.slice(1).map((revision) => revision.delta);
    for (const delta of steps) {
      expect(delta.length).toBeGreaterThan(0);
      expect(new Set(delta.map((item) => item.severity)).size).toBe(1);
    }
    const order = steps.map((delta) => delta[0].severity);
    for (let index = 1; index < order.length; index += 1) {
      expect(SEVERITY_RANK[order[index]]).toBeGreaterThan(SEVERITY_RANK[order[index - 1]]);
    }
  });

  it("applies changes cumulatively, so each stop is a superset of the last", () => {
    for (let index = 1; index < timeline.length; index += 1) {
      expect(timeline[index].applied.length).toBeGreaterThanOrEqual(timeline[index - 1].applied.length);
      for (const earlier of timeline[index - 1].applied) {
        expect(timeline[index].applied.some((change) => change.id === earlier.id)).toBe(true);
      }
    }
  });

  it("gives every stop a contract the engine actually inferred", () => {
    for (const revision of timeline) {
      expect(revision.fingerprint).toMatch(/^[0-9a-f]{8}$/);
      expect(revision.candidateContract.nodes.length).toBeGreaterThan(0);
      // The stop's findings are a real comparison against the baseline.
      expect(revision.changes).toEqual(compareContracts(revision.baselineContract, revision.candidateContract, "response"));
      expect(revision.diff.summary.total).toBe(revision.changes.length);
    }
  });

  it("reaches a final stop whose contract matches the real candidate", () => {
    const candidateContract = inferContract([...demoCandidate]);
    expect(timeline[timeline.length - 1].candidateContract.fingerprint).toBe(candidateContract.fingerprint);
  });

  it("matches the candidate contract exactly, so the last stop invents nothing", () => {
    // This is the property that keeps the landing page honest: applying every
    // change must reproduce the candidate's inferred contract exactly. That is
    // the fingerprint (pointers + kinds + requiredness) plus the pointer set —
    // `presentInSamples`/`totalSamples` and the example values differ by design,
    // because a revision keeps the baseline's sample count and the engine reports
    // `order_id` as unchanged, so it retains its baseline value.
    const finalRevision = timeline[timeline.length - 1];
    const candidateContract = inferContract([...demoCandidate]);

    expect(finalRevision.candidateContract.fingerprint).toBe(candidateContract.fingerprint);
    expect(finalRevision.candidateContract.nodes.map((node) => ({
      pointer: node.pointer,
      kinds: node.kinds,
      required: node.required,
    }))).toEqual(candidateContract.nodes.map((node) => ({
      pointer: node.pointer,
      kinds: node.kinds,
      required: node.required,
    })));
    expect(finalRevision.candidateSamples.length).toBe(demoBaseline.length);
  });

  it("fills added fields with the candidate's own values, not placeholders", () => {
    const finalSamples = timeline[timeline.length - 1].candidateSamples;
    for (const sample of finalSamples) {
      const customer = (sample.value as { customer: Record<string, unknown> }).customer;
      expect(customer.nickname).toBe("ada");
    }
  });

  it("never shows a path the candidate or baseline does not contain", () => {
    const known = new Set<string>();
    for (const sample of [...demoBaseline, ...demoCandidate]) {
      for (const node of inferContract([sample]).nodes) known.add(node.pointer);
    }
    for (const revision of timeline) {
      for (const node of revision.candidateContract.nodes) {
        expect(known.has(node.pointer)).toBe(true);
      }
    }
  });

  it("orders each step's severities so the cascade reads safe → warning → breaking", () => {
    // Whatever classes the pair exercises must appear in ascending risk order.
    const seen = timeline.slice(1).map((revision) => revision.delta[0].severity);
    expect(seen).toEqual([...seen].sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b]));
  });

  it("reports a tone that matches the worst severity applied so far", () => {
    expect(timeline[0].tone).toBe("info");
    expect(timeline[timeline.length - 1].tone).toBe("breaking");
    const tones = timeline.map((revision) => revision.tone);
    for (let index = 1; index < tones.length; index += 1) {
      expect(SEVERITY_RANK[tones[index]]).toBeGreaterThanOrEqual(SEVERITY_RANK[tones[index - 1]]);
    }
  });

  it("collapses to a single stop when the two sides infer the same contract", () => {
    const identical = buildTimeline(demoBaseline, demoBaseline, "response");
    expect(identical).toHaveLength(1);
    expect(identical[0].version).toBe("v1.0.0");
    expect(identical[0].changes).toHaveLength(0);
    expect(identical[0].tone).toBe("info");
  });

  it("keeps working when only additive changes exist", () => {
    const additive = [
      { id: "a1", label: "a1", source: "fixture" as const, capturedAt: "2026-10-07T09:00:00.000Z", value: { id: "1" } },
    ];
    const additiveNext = [
      { id: "b1", label: "b1", source: "fixture" as const, capturedAt: "2026-10-07T09:00:00.000Z", value: { id: "1", note: "hi" } },
    ];
    const onlyAdditive = buildTimeline(additive, additiveNext, "response");
    expect(onlyAdditive).toHaveLength(2);
    expect(onlyAdditive[1].delta).toHaveLength(1);
  });
});
