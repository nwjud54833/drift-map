import type { ContractNode, JsonKind } from "@/lib/contract/types";
import { pointerDepth, pointerLabel } from "@/lib/contract/normalize";

/**
 * Pure model behind the contract view. Everything here is deterministic and
 * derived from engine output — no path, kind or requiredness value is invented.
 */

export interface ContractTreeRow {
  pointer: string;
  /** Last pointer segment, already unescaped by the engine's `pointerLabel`. */
  segment: string;
  /** JSON-pointer depth. A top-level field such as `/id` is depth 1. */
  depth: number;
  parentPointer: string | null;
  childPointers: string[];
  hasChildren: boolean;
  /** Path exists only on the opposite side, so this row is shown as removed. */
  ghost: boolean;
  kinds: JsonKind[];
  required: boolean;
  presentInSamples: number;
  totalSamples: number;
  /** Path traverses a normalised array wildcard segment. */
  hasWildcard: boolean;
}

/** True when any pointer segment is the array wildcard `*`. */
export function pointerHasWildcard(pointer: string): boolean {
  return pointer.split("/").includes("*");
}

export function parentPointerOf(pointer: string): string | null {
  const index = pointer.lastIndexOf("/");
  return index <= 0 ? null : pointer.slice(0, index);
}

export interface BuildTreeOptions {
  /** Paths that exist on the other side but not in this contract. */
  ghostPointers?: Iterable<string>;
  /** Sample count used for ghost rows, which have no sample evidence. */
  totalSamples?: number;
}

/** Paths that have at least one child in the union of all visible paths. */
export function collectParentPointers(pointers: Iterable<string>): Set<string> {
  const parents = new Set<string>();
  for (const pointer of pointers) {
    const parent = parentPointerOf(pointer);
    if (parent) parents.add(parent);
  }
  return parents;
}

/**
 * Flattens the contract into rows sorted by depth then path. Rows are emitted
 * for every path including intermediate object/array levels, so the tree stays
 * complete even when the engine reports a child but not its parent.
 */
export function buildContractRows(nodes: readonly ContractNode[], options: BuildTreeOptions = {}): ContractTreeRow[] {
  const byPointer = new Map(nodes.map((node) => [node.pointer, node]));
  const allPointers = new Set<string>([...byPointer.keys(), ...(options.ghostPointers ?? [])]);
  const parents = collectParentPointers(allPointers);
  const childrenOf = new Map<string, string[]>();
  for (const pointer of allPointers) {
    const parent = parentPointerOf(pointer);
    if (!parent) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(pointer);
    childrenOf.set(parent, list);
  }
  for (const list of childrenOf.values()) list.sort((a, b) => a.localeCompare(b));

  return [...allPointers]
    .sort((a, b) => pointerDepth(a) - pointerDepth(b) || a.localeCompare(b))
    .map((pointer) => {
      const node = byPointer.get(pointer);
      return {
        pointer,
        segment: pointerLabel(pointer),
        depth: Math.max(1, pointerDepth(pointer)),
        parentPointer: parentPointerOf(pointer),
        childPointers: childrenOf.get(pointer) ?? [],
        hasChildren: parents.has(pointer),
        ghost: !node,
        kinds: node?.kinds ?? [],
        required: node?.required ?? false,
        presentInSamples: node?.presentInSamples ?? 0,
        totalSamples: node?.totalSamples ?? options.totalSamples ?? 0,
        hasWildcard: pointerHasWildcard(pointer),
      };
    });
}

/** Collapse state: pointers whose descendants are hidden. */
export type ExpandedState = ReadonlySet<string>;

export function initialExpandedState(rows: readonly ContractTreeRow[]): Set<string> {
  return new Set(rows.filter((row) => row.hasChildren).map((row) => row.pointer));
}

export function allCollapsedState(): Set<string> {
  return new Set<string>();
}

/** Rows visible under the current collapse state, in tree order. */
export function visibleRows(rows: readonly ContractTreeRow[], expanded: ExpandedState): ContractTreeRow[] {
  return rows.filter((row) => {
    let parent = row.parentPointer;
    while (parent) {
      if (!expanded.has(parent)) return false;
      parent = parentPointerOf(parent);
    }
    return true;
  });
}

export function isExpanded(row: ContractTreeRow, expanded: ExpandedState): boolean {
  return row.hasChildren && expanded.has(row.pointer);
}

/** Toggles one branch and returns a new set (never mutates the input). */
export function toggleExpanded(expanded: ExpandedState, pointer: string): Set<string> {
  const next = new Set(expanded);
  if (next.has(pointer)) next.delete(pointer);
  else next.add(pointer);
  return next;
}

/* --------------------------------------------------------------------------
 * Filtering
 * ------------------------------------------------------------------------ */

export interface PathMatch {
  row: ContractTreeRow;
  /** Character ranges of the case-insensitive match within `row.pointer`. */
  matches: Array<[number, number]>;
}

/**
 * Filters by pointer substring. Filtering overrides the collapse state so every
 * matching row is reachable, and returns match ranges for highlighting.
 */
export function filterRows(rows: readonly ContractTreeRow[], query: string): PathMatch[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows.map((row) => ({ row, matches: [] }));
  const matches: PathMatch[] = [];
  for (const row of rows) {
    const haystack = row.pointer.toLowerCase();
    const ranges: Array<[number, number]> = [];
    let index = haystack.indexOf(needle);
    while (index !== -1) {
      ranges.push([index, index + needle.length]);
      index = haystack.indexOf(needle, index + needle.length);
    }
    if (ranges.length > 0) matches.push({ row, matches: ranges });
  }
  return matches;
}

/** Splits a path into alternating unmatched/matched segments for rendering. */
export function highlightSegments(pointer: string, ranges: readonly (readonly [number, number])[]): Array<{ text: string; match: boolean }> {
  if (ranges.length === 0) return [{ text: pointer, match: false }];
  const ordered = [...ranges].sort((a, b) => a[0] - b[0]);
  const segments: Array<{ text: string; match: boolean }> = [];
  let cursor = 0;
  for (const [start, end] of ordered) {
    if (start > cursor) segments.push({ text: pointer.slice(cursor, start), match: false });
    segments.push({ text: pointer.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < pointer.length) segments.push({ text: pointer.slice(cursor), match: false });
  return segments;
}

/* --------------------------------------------------------------------------
 * Keyboard model (ARIA tree pattern, roving tabindex)
 * ------------------------------------------------------------------------ */

export type TreeKeyAction =
  | "focusNext"
  | "focusPrevious"
  | "focusFirst"
  | "focusLast"
  | "expand"
  | "collapse"
  | "activate";

export function mapTreeKey(key: string): TreeKeyAction | null {
  switch (key) {
    case "ArrowDown": return "focusNext";
    case "ArrowUp": return "focusPrevious";
    case "Home": return "focusFirst";
    case "End": return "focusLast";
    case "ArrowRight": return "expand";
    case "ArrowLeft": return "collapse";
    case "Enter":
    case " ": return "activate";
    default: return null;
  }
}

export interface TreeNavigationResult {
  /** Index into `rows` that should own focus, or null when nothing changes. */
  cursor: number | null;
  expanded: Set<string>;
}

const clamp = (index: number, length: number) => Math.max(0, Math.min(index, length - 1));

/**
 * Applies one key action to the visible row list.
 *
 * `ArrowRight` expands a collapsed branch, then steps into its first child.
 * `ArrowLeft` collapses an expanded branch, then steps out to the parent.
 */
export function applyTreeKey(
  action: TreeKeyAction,
  rows: readonly ContractTreeRow[],
  expanded: ExpandedState,
  cursor: number,
): TreeNavigationResult {
  const next = new Set(expanded);
  if (rows.length === 0) return { cursor: null, expanded: next };
  const row = rows[clamp(cursor, rows.length)];
  switch (action) {
    case "focusNext":
      return { cursor: clamp(cursor + 1, rows.length), expanded: next };
    case "focusPrevious":
      return { cursor: clamp(cursor - 1, rows.length), expanded: next };
    case "focusFirst":
      return { cursor: 0, expanded: next };
    case "focusLast":
      return { cursor: rows.length - 1, expanded: next };
    case "expand": {
      if (!row.hasChildren) return { cursor: null, expanded: next };
      if (!next.has(row.pointer)) {
        next.add(row.pointer);
        return { cursor: null, expanded: next };
      }
      const child = row.childPointers[0];
      const childIndex = child ? rows.findIndex((candidate) => candidate.pointer === child) : -1;
      return { cursor: childIndex === -1 ? null : childIndex, expanded: next };
    }
    case "collapse": {
      if (row.hasChildren && next.has(row.pointer)) {
        next.delete(row.pointer);
        return { cursor: null, expanded: next };
      }
      const parentIndex = row.parentPointer ? rows.findIndex((candidate) => candidate.pointer === row.parentPointer) : -1;
      return { cursor: parentIndex === -1 ? null : parentIndex, expanded: next };
    }
    case "activate":
    default:
      return { cursor: null, expanded: next };
  }
}
