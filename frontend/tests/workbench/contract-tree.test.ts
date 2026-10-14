import { describe, expect, it } from "vitest";
import {
  applyTreeKey,
  buildContractRows,
  collectParentPointers,
  filterRows,
  highlightSegments,
  initialExpandedState,
  isExpanded,
  mapTreeKey,
  parentPointerOf,
  pointerHasWildcard,
  toggleExpanded,
  visibleRows,
  type ContractTreeRow,
} from "@/lib/workbench/contract-tree";
import { inferContract } from "@/lib/contract/infer";
import type { PayloadSample } from "@/lib/contract/types";

const samples: PayloadSample[] = [
  {
    id: "s1",
    label: "one",
    source: "paste",
    capturedAt: "2026-01-01T00:00:00.000Z",
    value: {
      id: "ORD-1",
      status: "shipped",
      customer: { id: "CUS-1", email: "a@b.co" },
      items: [{ sku: "MUG", quantity: 1 }],
    },
  },
  {
    id: "s2",
    label: "two",
    source: "paste",
    capturedAt: "2026-01-01T00:00:00.000Z",
    value: {
      id: "ORD-2",
      customer: { id: "CUS-2" },
      items: [{ sku: "TOTE", quantity: 2 }],
    },
  },
];

const contract = inferContract(samples, "test");
const rows = buildContractRows(contract.nodes);

function rowFor(pointer: string): ContractTreeRow {
  const row = rows.find((candidate) => candidate.pointer === pointer);
  if (!row) throw new Error(`missing row ${pointer}`);
  return row;
}

const allExpanded = initialExpandedState(rows);

describe("pointer helpers", () => {
  it("detects the normalised array wildcard segment", () => {
    expect(pointerHasWildcard("/items/*/sku")).toBe(true);
    expect(pointerHasWildcard("/items")).toBe(false);
    // A key that merely contains an asterisk is not the wildcard.
    expect(pointerHasWildcard("/items/*foo")).toBe(false);
  });

  it("finds the parent of nested and top-level pointers", () => {
    expect(parentPointerOf("/customer/email")).toBe("/customer");
    expect(parentPointerOf("/id")).toBeNull();
  });

  it("collects the parent of every pointer exactly once", () => {
    // Only the immediate parent of each input pointer is collected: "/a" has no
    // parent, so it is not added — but it is still recognised as a parent of
    // "/a/b" by buildContractRows, which derives `hasChildren` from this set.
    expect(collectParentPointers(["/a/b/c", "/a/b/d", "/a"])).toEqual(new Set(["/a/b"]));
    expect(collectParentPointers(["/a/b", "/a/c"])).toEqual(new Set(["/a"]));
    expect(collectParentPointers([])).toEqual(new Set());
  });
});

describe("buildContractRows", () => {
  it("emits one row per inferred path, ordered by depth then path", () => {
    expect(rows.map((row) => row.pointer)).toEqual([
      "/customer",
      "/id",
      "/items",
      "/status",
      "/customer/email",
      "/customer/id",
      "/items/*",
      "/items/*/quantity",
      "/items/*/sku",
    ]);
  });

  it("assigns pointer depth starting at 1 for top-level fields", () => {
    expect(rowFor("/id").depth).toBe(1);
    expect(rowFor("/customer/id").depth).toBe(2);
    expect(rowFor("/items/*/sku").depth).toBe(3);
  });

  it("links parents and children", () => {
    expect(rowFor("/customer").childPointers).toEqual(["/customer/email", "/customer/id"]);
    expect(rowFor("/customer").hasChildren).toBe(true);
    expect(rowFor("/customer").parentPointer).toBeNull();
    expect(rowFor("/customer/email").parentPointer).toBe("/customer");
    expect(rowFor("/customer/email").hasChildren).toBe(false);
  });

  it("marks wildcard rows and carries kind/requiredness evidence", () => {
    expect(rowFor("/items/*/sku").hasWildcard).toBe(true);
    expect(rowFor("/items/*/sku").kinds).toEqual(["string"]);
    // Present in every sample.
    expect(rowFor("/items/*/sku").required).toBe(true);
    expect(rowFor("/items/*/sku").presentInSamples).toBe(2);
    // Optional on the baseline side: `status` exists in sample one only.
    expect(rowFor("/status").required).toBe(false);
    expect(rowFor("/status").presentInSamples).toBe(1);
    expect(rowFor("/status").totalSamples).toBe(2);
  });

  it("adds ghost rows for paths only present on the other side", () => {
    const withGhosts = buildContractRows(contract.nodes, { ghostPointers: ["/tracking_number"], totalSamples: 2 });
    const ghost = withGhosts.find((row) => row.pointer === "/tracking_number");
    expect(ghost?.ghost).toBe(true);
    expect(ghost?.kinds).toEqual([]);
    expect(ghost?.totalSamples).toBe(2);
  });

  it("returns an empty list for an empty contract", () => {
    expect(buildContractRows([])).toEqual([]);
  });
});

describe("collapse state", () => {
  it("starts with every branch expanded", () => {
    expect(visibleRows(rows, allExpanded)).toHaveLength(rows.length);
    expect(isExpanded(rowFor("/customer"), allExpanded)).toBe(true);
  });

  it("hides descendants of a collapsed branch", () => {
    const collapsed = toggleExpanded(allExpanded, "/customer");
    const visible = visibleRows(rows, collapsed).map((row) => row.pointer);
    expect(visible).toContain("/customer");
    expect(visible).not.toContain("/customer/email");
    expect(visible).not.toContain("/customer/id");
    // Unrelated branches are untouched.
    expect(visible).toContain("/items/*/sku");
  });

  it("hides a whole subtree when a deep branch is collapsed", () => {
    const collapsed = toggleExpanded(allExpanded, "/items/*");
    const visible = visibleRows(rows, collapsed).map((row) => row.pointer);
    expect(visible).toContain("/items/*");
    expect(visible).not.toContain("/items/*/sku");
    expect(visible).toContain("/customer/email");
  });

  it("never mutates the input set", () => {
    const before = new Set(allExpanded);
    const next = toggleExpanded(allExpanded, "/customer");
    expect(allExpanded).toEqual(before);
    expect(next).not.toBe(allExpanded);
  });

  it("toggles back to the original state", () => {
    const twice = toggleExpanded(toggleExpanded(allExpanded, "/customer"), "/customer");
    expect(visibleRows(rows, twice).map((row) => row.pointer)).toEqual(rows.map((row) => row.pointer));
  });
});

describe("filterRows", () => {
  it("returns every row with no match ranges when the query is empty", () => {
    const result = filterRows(rows, "   ");
    expect(result).toHaveLength(rows.length);
    expect(result.every((entry) => entry.matches.length === 0)).toBe(true);
  });

  it("matches a pointer substring case-insensitively", () => {
    const result = filterRows(rows, "CUSTOMER");
    expect(result.map((entry) => entry.row.pointer)).toEqual(["/customer", "/customer/email", "/customer/id"]);
  });

  it("reports the character ranges of every match", () => {
    const result = filterRows(rows, "id");
    const root = result.find((entry) => entry.row.pointer === "/id");
    expect(root?.matches).toEqual([[1, 3]]);
  });

  it("matches rows that the collapse state would hide", () => {
    const collapsed = toggleExpanded(allExpanded, "/customer");
    expect(visibleRows(rows, collapsed).map((row) => row.pointer)).not.toContain("/customer/email");
    expect(filterRows(rows, "email").map((entry) => entry.row.pointer)).toEqual(["/customer/email"]);
  });

  it("returns nothing when the query matches no path", () => {
    expect(filterRows(rows, "zzz")).toEqual([]);
  });
});

describe("highlightSegments", () => {
  it("returns the whole string unmatched when there are no ranges", () => {
    expect(highlightSegments("/customer", [])).toEqual([{ text: "/customer", match: false }]);
  });

  it("splits the path around a match and preserves the original text", () => {
    const segments = highlightSegments("/customer/email", [[1, 9]]);
    expect(segments).toEqual([
      { text: "/", match: false },
      { text: "customer", match: true },
      { text: "/email", match: false },
    ]);
    expect(segments.map((segment) => segment.text).join("")).toBe("/customer/email");
  });

  it("handles repeated matches", () => {
    // "/items/*/item_id" → "items" at 1-5, first "item" at 9-12, trailing "id" at 14-15.
    const segments = highlightSegments("/items/*/item_id", [[9, 13], [14, 16]]);
    expect(segments.filter((segment) => segment.match).map((segment) => segment.text)).toEqual(["item", "id"]);
    expect(segments.map((segment) => segment.text).join("")).toBe("/items/*/item_id");
  });
});

describe("mapTreeKey", () => {
  it("maps the ARIA tree keys and ignores everything else", () => {
    expect(mapTreeKey("ArrowDown")).toBe("focusNext");
    expect(mapTreeKey("ArrowUp")).toBe("focusPrevious");
    expect(mapTreeKey("Home")).toBe("focusFirst");
    expect(mapTreeKey("End")).toBe("focusLast");
    expect(mapTreeKey("ArrowRight")).toBe("expand");
    expect(mapTreeKey("ArrowLeft")).toBe("collapse");
    expect(mapTreeKey("Enter")).toBe("activate");
    expect(mapTreeKey(" ")).toBe("activate");
    expect(mapTreeKey("Tab")).toBeNull();
    expect(mapTreeKey("a")).toBeNull();
  });
});

describe("applyTreeKey", () => {
  const visible = visibleRows(rows, allExpanded);
  const indexOf = (pointer: string) => visible.findIndex((row) => row.pointer === pointer);

  it("moves the cursor down and up and clamps at both ends", () => {
    expect(applyTreeKey("focusNext", visible, allExpanded, 0).cursor).toBe(1);
    expect(applyTreeKey("focusNext", visible, allExpanded, visible.length - 1).cursor).toBe(visible.length - 1);
    expect(applyTreeKey("focusPrevious", visible, allExpanded, 2).cursor).toBe(1);
    expect(applyTreeKey("focusPrevious", visible, allExpanded, 0).cursor).toBe(0);
  });

  it("jumps to the first and last visible row", () => {
    expect(applyTreeKey("focusFirst", visible, allExpanded, 4).cursor).toBe(0);
    expect(applyTreeKey("focusLast", visible, allExpanded, 0).cursor).toBe(visible.length - 1);
  });

  it("ArrowRight expands a collapsed branch without moving focus", () => {
    const collapsed = toggleExpanded(allExpanded, "/customer");
    const collapsedVisible = visibleRows(rows, collapsed);
    const cursor = collapsedVisible.findIndex((row) => row.pointer === "/customer");
    const result = applyTreeKey("expand", collapsedVisible, collapsed, cursor);
    expect(result.cursor).toBeNull();
    expect(result.expanded.has("/customer")).toBe(true);
    expect(visibleRows(rows, result.expanded).map((row) => row.pointer)).toContain("/customer/email");
  });

  it("ArrowRight on an expanded branch moves into its first child", () => {
    const cursor = indexOf("/customer");
    const result = applyTreeKey("expand", visible, allExpanded, cursor);
    expect(result.cursor).toBe(indexOf("/customer/email"));
  });

  it("ArrowRight on a leaf does nothing", () => {
    const result = applyTreeKey("expand", visible, allExpanded, indexOf("/id"));
    expect(result.cursor).toBeNull();
    expect([...result.expanded]).toEqual([...allExpanded]);
  });

  it("ArrowLeft collapses an expanded branch without moving focus", () => {
    const result = applyTreeKey("collapse", visible, allExpanded, indexOf("/customer"));
    expect(result.cursor).toBeNull();
    expect(result.expanded.has("/customer")).toBe(false);
  });

  it("ArrowLeft on an already-collapsed branch leaves focus where it is", () => {
    const collapsed = toggleExpanded(allExpanded, "/customer");
    const collapsedVisible = visibleRows(rows, collapsed);
    const cursor = collapsedVisible.findIndex((row) => row.pointer === "/customer");
    const result = applyTreeKey("collapse", collapsedVisible, collapsed, cursor);
    // `/customer` is top level, so there is no parent to move to.
    expect(result.cursor).toBeNull();
    expect(result.expanded.has("/customer")).toBe(false);
  });

  it("ArrowLeft on a leaf moves focus to its parent", () => {
    const onLeaf = applyTreeKey("collapse", visible, allExpanded, indexOf("/customer/email"));
    expect(onLeaf.cursor).toBe(indexOf("/customer"));
    expect(visible[onLeaf.cursor!].pointer).toBe("/customer");
  });

  it("ArrowLeft on a top-level leaf leaves focus where it is", () => {
    const result = applyTreeKey("collapse", visible, allExpanded, indexOf("/id"));
    expect(result.cursor).toBeNull();
  });

  it("returns a new expansion set and never mutates the input", () => {
    const before = new Set(allExpanded);
    const result = applyTreeKey("collapse", visible, allExpanded, indexOf("/customer"));
    expect(allExpanded).toEqual(before);
    expect(result.expanded).not.toBe(allExpanded);
  });

  it("handles an empty row list without throwing", () => {
    expect(applyTreeKey("focusNext", [], new Set(), 0)).toEqual({ cursor: null, expanded: new Set() });
    expect(applyTreeKey("expand", [], new Set(), 0).cursor).toBeNull();
  });

  it("does not change focus for activate", () => {
    expect(applyTreeKey("activate", visible, allExpanded, 3).cursor).toBeNull();
  });
});
