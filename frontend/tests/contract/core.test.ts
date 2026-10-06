import { describe, expect, it } from "vitest";
import fixture from "@/fixtures/order-shipped.fixture.json";
import { parsePayloadText, PayloadParseError, MAX_IMPORT_BYTES } from "@/lib/contract/parse";
import { inferContract } from "@/lib/contract/infer";
import { compareContracts } from "@/lib/contract/compare";
import { classifyChange } from "@/lib/contract/compatibility";
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
  it.each(["\"hello\"", "42", "true", "null"])("rejects primitive roots %s", (text) => expect(() => parsePayloadText(text)).toThrow(/top-level value/));
  it("enforces the 2 MB limit", () => expect(() => parsePayloadText(" ".repeat(MAX_IMPORT_BYTES + 1))).toThrow(/2 MB/));
  it("rejects malformed JSON with a friendly message", () => expect(() => parsePayloadText("{" )).toThrow(/Unable to parse JSON/));
});

describe("contract inference", () => {
  it("infers all JSON kinds", () => {
    const contract = contractFor([{ s: "a", n: 3, b: true, z: null, o: {}, a: [] }]);
    const kinds = new Map(contract.nodes.map((node) => [node.pointer, node.kinds[0]]));
    expect(kinds.get("/s")).toBe("string"); expect(kinds.get("/n")).toBe("number"); expect(kinds.get("/b")).toBe("boolean");
    expect(kinds.get("/z")).toBe("null"); expect(kinds.get("/o")).toBe("object"); expect(kinds.get("/a")).toBe("array");
  });
  it("uses wildcard array paths, requiredness, and kind unions", () => {
    const contract = contractFor([{ id: 1, email: "a", items: [{ sku: "A" }] }, { id: 2, items: [{ sku: "B" }] }, { id: 3, email: null, items: [] }]);
    expect(contract.nodes.find((node) => node.pointer === "/id")?.required).toBe(true);
    expect(contract.nodes.find((node) => node.pointer === "/email")?.required).toBe(true);
    expect(contract.nodes.find((node) => node.pointer === "/email")?.kinds).toEqual(["null", "string"]);
    expect(contract.nodes.some((node) => node.pointer === "/items/*/sku")).toBe(true);
  });
  it("has a stable fingerprint independent of samples and array order", () => {
    const a = contractFor([{ values: [{ id: 1 }, { id: 2 }] }]);
    const b = contractFor([{ values: [{ id: 2 }, { id: 1 }] }]);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.nodes).toEqual(b.nodes);
  });
  it("escapes JSON pointer keys", () => expect(contractFor([{ "a/b~c": 1 }]).nodes[0].pointer).toBe("/a~1b~0c"));
});

describe("compatibility and comparison", () => {
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
  });
  it("detects added, removed, type-changed, and requiredness changes", () => {
    const changes = compareContracts(contractFor([{ removed: 1, variant: "x", sometimes: "a" }]), contractFor([{ added: true, variant: 2, sometimes: "a" }, { added: true, variant: 3 }]), "response");
    expect(changes.some((change) => change.pointer === "/removed" && change.kind === "field-removed")).toBe(true);
    expect(changes.some((change) => change.pointer === "/added" && change.kind === "field-added")).toBe(true);
    expect(changes.some((change) => change.pointer === "/variant" && change.kind === "type-changed")).toBe(true);
    expect(changes.some((change) => change.pointer === "/sometimes" && change.kind === "became-optional")).toBe(true);
  });
  it("shows the supplied demo's important semantic changes without enum drift", () => {
    const before = inferContract(samplesFor(fixture.baseline), "fixed");
    const after = inferContract(samplesFor(fixture.candidate), "fixed");
    const changes = compareContracts(before, after, "event");
    const paths = new Set(changes.map((change) => change.pointer));
    for (const pointer of ["/data/total_cents", "/data/currency", "/data/customer/email", "/data/shipping/tracking_number", "/data/discount_cents", "/schema_version", "/data/total", "/data/fulfillment", "/data/items/*/unit_price"]) expect(paths.has(pointer)).toBe(true);
    expect(paths.has("/data/status")).toBe(false);
    const direction: ContractDirection = "request";
    expect(compareContracts(before, after, direction).find((change) => change.pointer === "/schema_version")?.severity).toBe("breaking");
  });
});
