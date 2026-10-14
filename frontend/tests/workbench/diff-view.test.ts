import { describe, expect, it } from "vitest";
import {
  emptySummary,
  filterChanges,
  groupChangesBySeverity,
  kindsLabel,
  sideTypeLabel,
  sideValueLabel,
  summarizeChanges,
} from "@/lib/workbench/diff-view";
import type { ContractChange, ContractNode, JsonKind } from "@/lib/contract/types";

function node(pointer: string, kinds: JsonKind[], required: boolean, examples: ContractNode["examples"] = []): ContractNode {
  return { pointer, label: pointer.split("/").pop() ?? "", kinds, presentInSamples: required ? 3 : 1, totalSamples: 3, required, examples };
}

function change(id: string, severity: ContractChange["severity"], pointer: string, explanation = "", title = "Field added"): ContractChange {
  return { id, pointer, kind: "field-added", severity, title, explanation, before: null, after: null };
}

const changes: ContractChange[] = [
  change("a", "safe", "/fulfillment", "optional field added"),
  change("b", "breaking", "/customer/email", "the field was removed"),
  change("c", "info", "/status", "became optional", "Field became optional"),
  change("d", "breaking", "/items/*/price", "type changed from number to object", "Type changed"),
  change("e", "warning", "/schema_version", "required field added"),
];

describe("filterChanges", () => {
  it("returns everything when no severity is selected and the query is empty", () => {
    expect(filterChanges(changes, { query: "", severities: [] })).toHaveLength(5);
  });

  it("treats an empty severity list as 'all severities', not 'none'", () => {
    const result = filterChanges(changes, { query: "", severities: [] });
    expect(result.map((item) => item.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps only selected severities", () => {
    const result = filterChanges(changes, { query: "", severities: ["breaking"] });
    expect(result.map((item) => item.id)).toEqual(["b", "d"]);
  });

  it("matches the pointer, title and explanation case-insensitively", () => {
    expect(filterChanges(changes, { query: "/CUSTOMER/", severities: [] }).map((item) => item.id)).toEqual(["b"]);
    // Title match: only "c" carries a distinct title.
    expect(filterChanges(changes, { query: "became OPTIONAL", severities: [] }).map((item) => item.id)).toEqual(["c"]);
    // Explanation match; "b" and "e" also carry the default title "Field added".
    expect(filterChanges(changes, { query: "field added", severities: [] }).map((item) => item.id)).toEqual(["a", "b", "e"]);
    expect(filterChanges(changes, { query: "was removed", severities: [] }).map((item) => item.id)).toEqual(["b"]);
  });

  it("combines severity and text filters", () => {
    expect(filterChanges(changes, { query: "price", severities: ["breaking"] }).map((item) => item.id)).toEqual(["d"]);
    expect(filterChanges(changes, { query: "price", severities: ["safe"] })).toHaveLength(0);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(filterChanges(changes, { query: "   ", severities: [] })).toHaveLength(5);
  });
});

describe("groupChangesBySeverity", () => {
  it("orders groups breaking, warning, safe, info and drops empty groups", () => {
    const groups = groupChangesBySeverity(changes);
    expect(groups.map((group) => group.severity)).toEqual(["breaking", "warning", "safe", "info"]);
    expect(groups.map((group) => group.changes.length)).toEqual([2, 1, 1, 1]);
  });

  it("preserves engine order inside a group", () => {
    const groups = groupChangesBySeverity(changes);
    expect(groups[0].changes.map((item) => item.id)).toEqual(["b", "d"]);
  });

  it("omits severities with no findings", () => {
    expect(groupChangesBySeverity([change("x", "info", "/x")]).map((group) => group.severity)).toEqual(["info"]);
    expect(groupChangesBySeverity([])).toEqual([]);
  });
});

describe("summarizeChanges", () => {
  it("counts each severity and the total", () => {
    expect(summarizeChanges(changes)).toEqual({ breaking: 2, warning: 1, safe: 1, info: 1, total: 5 });
  });

  it("returns zeroes for an empty list", () => {
    expect(summarizeChanges([])).toEqual(emptySummary());
  });
});

describe("side labels", () => {
  it("describes a missing side without inventing a type", () => {
    expect(sideTypeLabel(null)).toBe("— missing");
    expect(sideValueLabel(undefined)).toBe("— missing");
  });

  it("joins kind unions", () => {
    expect(sideTypeLabel(node("/a", ["string", "null"], true))).toBe("string | null");
    expect(kindsLabel(["string", "null"])).toBe("string | null");
    expect(kindsLabel([])).toBe("unknown");
  });

  it("prefers collected examples over the kind summary", () => {
    expect(sideValueLabel(node("/a", ["string"], true, ["ORD-1001"]))).toBe("\"ORD-1001\"");
    expect(sideValueLabel(node("/a", ["number"], false))).toBe("number · optional");
  });
});
