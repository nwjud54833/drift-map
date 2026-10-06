import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/order-shipped.fixture.json";
import { parsePayloadText, PayloadParseError, MAX_IMPORT_BYTES } from "@/lib/contract/parse";
import { inferContract } from "@/lib/contract/infer";
import { collectUnchangedNodes, compareContracts } from "@/lib/contract/compare";
import { classifyChange, compatibilityRule } from "@/lib/contract/compatibility";
import { escapePointerSegment, getJsonKind } from "@/lib/contract/normalize";
import { buildMarkdownReport } from "@/lib/contract/export";
import type { ContractDirection, PayloadSample } from "@/lib/contract/types";

function samplesFor(values: unknown[]): PayloadSample[] {
  return values.map((value, index) => ({ id: `t${index}`, label: `t${index}`, value: value as PayloadSample["value"], source: "paste", capturedAt: "2026-01-01T00:00:00.000Z" }));
}
function contractFor(values: unknown[]) { return inferContract(samplesFor(values), "fixed"); }

describe("payload parsing", () => {
  it("parses one object sample", () => expect(parsePayloadText('{"id":1}')).toHaveLength(1));
  it("parses arrays of object samples", () => expect(parsePayloadText('[{"id":1},{"id":2}]')).toHaveLength(2));
  it("rejects empty arrays and non-object array entries", () => {
    expect(() => parsePayloadText("[]")).toThrow(PayloadParseError);
    expect(() => parsePayloadText('[{"id":1},2]')).toThrow(/must contain JSON objects/);
  });
  it.each(['"hello"', "42", "true", "null"])("rejects primitive roots %s", (text) => expect(() => parsePayloadText(text)).toThrow(/top-level value/));
  it("enforces the 2 MB limit", () => expect(() => parsePayloadText(" ".repeat(MAX_IMPORT_BYTES + 1))).toThrow(/2 MB/));
  it("rejects malformed JSON with a friendly message", () => expect(() => parsePayloadText("{")).toThrow(/Unable to parse JSON/));
});

describe("json kind inference", () => {
  it("maps every JSON kind", () => {
    expect(getJsonKind("a")).toBe("string");
    expect(getJsonKind(1.5)).toBe("number");
    expect(getJsonKind(false)).toBe("boolean");
    expect(getJsonKind(null)).toBe("null");
    expect(getJsonKind({})).toBe("object");
    expect(getJsonKind([])).toBe("array");
  });
});

describe("path normalization", () => {
  it("uses wildcard array paths", () => {
    const contract = contractFor([{ items: [{ sku: "A" }] }]);
    expect(contract.nodes.some((node) => node.pointer === "/items/*/sku")).toBe(true);
  });
  it("escapes JSON pointer keys", () => {
    expect(escapePointerSegment("a/b~c")).toBe("a~1b~0c");
    expect(contractFor([{ "a/b~c": 1 }]).nodes[0].pointer).toBe("/a~1b~0c");
  });
});

describe("contract inference", () => {
  it("infers union kinds across samples", () => {
    const contract = contractFor([{ email: "a" }, { email: null }, { email: 3 }]);
    expect(contract.nodes.find((node) => node.pointer === "/email")?.kinds).toEqual(["null", "number", "string"]);
  });
  it("computes requiredness from presence, not null values", () => {
    const contract = contractFor([{ id: 1, email: "a" }, { id: 2 }, { id: 3, email: null }]);
    expect(contract.nodes.find((node) => node.pointer === "/id")?.required).toBe(true);
    expect(contract.nodes.find((node) => node.pointer === "/email")?.required).toBe(false);
  });
  it("bounds examples per node", () => {
    const contract = contractFor([{ tag: "a" }, { tag: "b" }, { tag: "c" }, { tag: "d" }]);
    expect(contract.nodes.find((node) => node.pointer === "/tag")?.examples).toHaveLength(3);
  });
  it("has a stable fingerprint independent of array order", () => {
    const a = contractFor([{ values: [{ id: 1 }, { id: 2 }] }]);
    const b = contractFor([{ values: [{ id: 2 }, { id: 1 }] }]);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.nodes).toEqual(b.nodes);
  });
});

describe("compatibility policy", () => {
  it("classifies additions and removals by direction and requiredness", () => {
    expect(classifyChange("field-added", "response", false, true)).toBe("warning");
    expect(classifyChange("field-added", "response", false, false)).toBe("safe");
    expect(classifyChange("field-added", "request", false, true)).toBe("breaking");
    expect(classifyChange("field-added", "request", false, false)).toBe("safe");
    expect(classifyChange("field-removed", "request", true)).toBe("breaking");
    expect(classifyChange("field-removed", "request", false)).toBe("safe");
    expect(classifyChange("field-removed", "event", true)).toBe("breaking");
    expect(classifyChange("became-optional", "response")).toBe("info");
    expect(classifyChange("type-changed", "request")).toBe("breaking");
    expect(classifyChange("became-required", "event")).toBe("breaking");
  });
  it("mentions the direction in the rule text", () => {
    expect(compatibilityRule("field-removed", "response")).toContain("Response payload");
    expect(compatibilityRule("field-added", "request")).toContain("Request payload");
  });
});

describe("contract comparison", () => {
  it("detects added, removed, type-changed, and requiredness changes", () => {
    const changes = compareContracts(
      contractFor([{ removed: 1, variant: "x", sometimes: "a" }]),
      contractFor([{ added: true, variant: 2, sometimes: "a" }, { added: true, variant: 3 }]),
      "response",
    );
    expect(changes.some((change) => change.pointer === "/removed" && change.kind === "field-removed")).toBe(true);
    expect(changes.some((change) => change.pointer === "/added" && change.kind === "field-added")).toBe(true);
    expect(changes.some((change) => change.pointer === "/variant" && change.kind === "type-changed")).toBe(true);
    expect(changes.some((change) => change.pointer === "/sometimes" && change.kind === "became-optional")).toBe(true);
  });
  it("suppresses descendant changes beneath a changed-type parent", () => {
    const changes = compareContracts(
      contractFor([{ wrapper: { inner: "text" } }]),
      contractFor([{ wrapper: [1, 2] }]),
      "response",
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].pointer).toBe("/wrapper");
  });
  it("sorts deterministically by severity then pointer", () => {
    const changes = compareContracts(
      contractFor([{ keep: 1, drop: 2 }]),
      contractFor([{ keep: 1, fresh: 3 }]),
      "response",
    );
    const severities = changes.map((change) => change.severity);
    expect(severities).toEqual([...severities].sort());
  });
  it("collects unchanged nodes shared by both sides", () => {
    const unchanged = collectUnchangedNodes(contractFor([{ same: 1, gone: 2 }]), contractFor([{ same: 1 }]));
    expect(unchanged.map((node) => node.pointer)).toEqual(["/same"]);
  });
});

describe("demo fixture", () => {
  const before = inferContract(samplesFor(fixture.baseline), "fixed");
  const after = inferContract(samplesFor(fixture.candidate), "fixed");
  const changes = compareContracts(before, after, "event");
  const paths = new Set(changes.map((change) => change.pointer));

  it("detects the breaking money and identity changes", () => {
    for (const pointer of ["/data/total_cents", "/data/currency", "/data/customer/email", "/data/shipping/tracking_number", "/data/discount_cents", "/data/items/*/unit_price_cents"]) {
      expect(paths.has(pointer)).toBe(true);
    }
  });
  it("detects the warning-level additions", () => {
    for (const pointer of ["/schema_version", "/data/total", "/data/total/amount", "/data/total/currency", "/data/shipping/tracking", "/data/fulfillment", "/data/fulfillment/location_id", "/data/items/*/unit_price", "/data/items/*/unit_price/amount", "/data/items/*/unit_price/currency"]) {
      expect(paths.has(pointer)).toBe(true);
    }
  });
  it("does not treat value changes as type changes", () => {
    expect(paths.has("/data/status")).toBe(false);
  });
  it("flips severity for additions under the request direction", () => {
    const requestDirection: ContractDirection = "request";
    expect(compareContracts(before, after, requestDirection).find((change) => change.pointer === "/schema_version")?.severity).toBe("breaking");
  });
  it("renders a markdown report with a summary line", () => {
    const diff = {
      baselineSnapshotId: "b", candidateSnapshotId: "c", direction: "event" as ContractDirection,
      generatedAt: "fixed", summary: { breaking: 6, warning: 10, safe: 0, info: 0, total: 16 }, changes,
    };
    const report = buildMarkdownReport(
      { id: "ws", name: "Order Webhook Migration", direction: "event", baselineSnapshotId: "b", candidateSnapshotId: "c", createdAt: "fixed", updatedAt: "fixed" },
      { id: "b", workspaceId: "ws", versionLabel: "2026-09 baseline", notes: "", sourceFileName: null, samples: [], contract: before, createdAt: "fixed" },
      { id: "c", workspaceId: "ws", versionLabel: "2026-10 candidate", notes: "", sourceFileName: null, samples: [], contract: after, createdAt: "fixed" },
      diff,
    );
    expect(report).toContain("# Contract Drift Report");
    expect(report).toContain("6 breaking");
    expect(report).toContain("/data/total_cents");
    expect(report).not.toContain("taylor@example.com");
  });
});
