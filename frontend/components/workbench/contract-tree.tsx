"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Copy, Minus, Plus } from "lucide-react";
import type { ContractChange, ContractNode, ContractSnapshot } from "@/lib/contract/types";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { RequiredBadge, Severity, TypeList, WildcardBadge } from "@/components/ui/badge";
import {
  applyTreeKey,
  buildContractRows,
  filterRows,
  highlightSegments,
  initialExpandedState,
  isExpanded,
  mapTreeKey,
  toggleExpanded,
  visibleRows,
  type ContractTreeRow,
} from "@/lib/workbench/contract-tree";

export interface ContractTreeProps {
  /** "Baseline" or "Candidate". */
  title: string;
  snapshot: ContractSnapshot | null;
  /** Paths present on the other side but absent here, rendered as removed. */
  ghostPointers: readonly string[];
  changes: readonly ContractChange[];
  side: "before" | "after";
  /** Stable identity for the inferred contract, shown verbatim. */
  fingerprint: string | null;
  pending: boolean;
  selectedPointer: string | null;
  onSelectPointer: (pointer: string, change: ContractChange | null) => void;
  onRenameSnapshot: (snapshot: ContractSnapshot, label: string) => void;
  onDeleteSnapshot: (side: "before" | "after") => void;
  onReplaceSnapshot: (side: "before" | "after") => void;
  onCopyFingerprint: (value: string) => void;
}

function HighlightedPath({ pointer, matches }: { pointer: string; matches: readonly (readonly [number, number])[] }) {
  const segments = highlightSegments(pointer, matches);
  return (
    <>
      {segments.map((segment, index) => segment.match
        ? <mark key={index}>{segment.text}</mark>
        : <span key={index}>{segment.text}</span>)}
    </>
  );
}

/**
 * Contract view: the inferred structure as a navigable JSON-pointer tree.
 *
 * Accessibility model — a real ARIA tree. Rows use `role="treeitem"` with
 * `aria-level`, `aria-expanded`, `aria-selected` and `aria-setsize`/
 * `aria-posinset`, grouped by `role="group"`, and implement roving tabindex: the
 * tree holds exactly one tab stop and Arrow keys move focus within it, so Tab
 * leaves the tree instead of stepping through every path.
 */
export function ContractTree({
  title,
  snapshot,
  ghostPointers,
  changes,
  side,
  fingerprint,
  pending,
  selectedPointer,
  onSelectPointer,
  onRenameSnapshot,
  onDeleteSnapshot,
  onReplaceSnapshot,
  onCopyFingerprint,
}: ContractTreeProps) {
  const nodes = useMemo<ContractNode[]>(
    () => snapshot?.contract.nodes ?? [],
    [snapshot],
  );
  const rows = useMemo(
    () => buildContractRows(nodes, { ghostPointers, totalSamples: snapshot?.samples.length ?? 0 }),
    [nodes, ghostPointers, snapshot?.samples.length],
  );
  const rowIndex = useMemo(() => new Map(rows.map((row) => [row.pointer, row])), [rows]);
  const changeByPointer = useMemo(() => new Map(changes.map((change) => [change.pointer, change])), [changes]);
  const initialExpanded = useMemo(() => initialExpandedState(rows), [rows]);

  const [expanded, setExpanded] = useState<Set<string>>(initialExpanded);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const treeRef = useRef<HTMLDivElement>(null);

  // Re-expand when the contract itself changes, so a fresh import is readable.
  useEffect(() => { setExpanded(initialExpanded); }, [initialExpanded]);

  const matches = useMemo(() => (query.trim() ? filterRows(rows, query) : null), [rows, query]);
  const list = useMemo(
    () => (matches ? matches.map((entry) => entry.row) : visibleRows(rows, expanded)),
    [matches, rows, expanded],
  );
  const matchRanges = useMemo(() => {
    const map = new Map<string, readonly (readonly [number, number])[]>();
    for (const entry of matches ?? []) map.set(entry.row.pointer, entry.matches);
    return map;
  }, [matches]);

  const cursorRow = list[Math.min(cursor, Math.max(0, list.length - 1))];

  /** Brings the selected path into view when it changes elsewhere (e.g. inspector). */
  useEffect(() => {
    if (!selectedPointer) return;
    document.getElementById(`ca-tree-${side}-${selectedPointer}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedPointer, side]);

  const focusRow = useCallback((index: number) => {
    setCursor(index);
    const row = list[index];
    if (!row) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`ca-tree-${side}-${row.pointer}`)?.focus();
    });
  }, [list, side]);

  function onTreeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget && !(event.target as HTMLElement).closest('[role="treeitem"]')) return;
    const action = mapTreeKey(event.key);
    if (!action) return;
    if (action === "activate") {
      event.preventDefault();
      const row = cursorRow;
      if (!row) return;
      if (event.key === " " && row.hasChildren) setExpanded((current) => toggleExpanded(current, row.pointer));
      onSelectPointer(row.pointer, changeByPointer.get(row.pointer) ?? null);
      return;
    }
    event.preventDefault();
    const result = applyTreeKey(action, list, expanded, cursor);
    if (result.expanded !== expanded) setExpanded(result.expanded);
    if (result.cursor !== null) focusRow(result.cursor);
  }

  function activateRow(row: ContractTreeRow) {
    setCursor(list.findIndex((candidate) => candidate.pointer === row.pointer));
    onSelectPointer(row.pointer, changeByPointer.get(row.pointer) ?? null);
  }

  const emptyLabel = snapshot ? "This contract has no inferred paths." : "Import a payload to infer this side.";

  return (
    <section className="ca-pane" aria-label={`${title} contract`}>
      <header className="ca-pane-heading">
        <div className="ca-pane-heading-top">
          <div>
            <span className="ca-overline">{title}</span>
            <strong>{snapshot?.versionLabel ?? "No snapshot"}</strong>
          </div>
          <div className="ca-pane-heading-actions">
            <Button size="sm" variant="quiet" disabled={!snapshot} onClick={() => setExpanded(new Set(rows.filter((row) => row.hasChildren).map((row) => row.pointer)))}>
              <Plus size={13} aria-hidden="true" /> Expand all
            </Button>
            <Button size="sm" variant="quiet" disabled={!snapshot} onClick={() => setExpanded(new Set())}>
              <Minus size={13} aria-hidden="true" /> Collapse all
            </Button>
            <Button size="sm" variant="quiet" disabled={!snapshot || pending} onClick={() => onReplaceSnapshot(side)}>
              {snapshot ? "Replace" : "Import"}
            </Button>
          </div>
        </div>

        {snapshot && (
          <div className="ca-pane-heading-actions">
            <Button size="sm" variant="quiet" disabled={pending} onClick={() => {
              const label = window.prompt("Snapshot label", snapshot.versionLabel);
              if (label?.trim() && label.trim() !== snapshot.versionLabel) onRenameSnapshot(snapshot, label.trim());
            }}>Rename</Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => onDeleteSnapshot(side)}>Delete {title.toLowerCase()}</Button>
          </div>
        )}

        {snapshot && (
          <div className="ca-tree-tools">
            <label className="sr-only" htmlFor={`ca-tree-filter-${side}`}>Filter {title} paths</label>
            <input
              id={`ca-tree-filter-${side}`}
              className="ui-input"
              type="search"
              value={query}
              placeholder="Filter by path…"
              onChange={(event) => { setQuery(event.target.value); setCursor(0); }}
              onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setQuery(""); } }}
            />
            <span className="ca-tree-count" aria-live="polite">
              {query.trim() ? `${list.length} of ${rows.length}` : `${rows.length} paths`}
            </span>
          </div>
        )}
      </header>

      {!snapshot || rows.length === 0 ? (
        <p className="ca-tree-empty">{emptyLabel}</p>
      ) : (
        <>
          <div
            className="ca-tree-scroll"
            ref={treeRef}
            role="tree"
            aria-label={`${title} contract paths`}
            aria-busy={pending || undefined}
            onKeyDown={onTreeKeyDown}
          >
            {list.map((row) => {
              const change = changeByPointer.get(row.pointer);
              const selected = selectedPointer === row.pointer;
              const open = isExpanded(row, expanded);
              const siblings = row.parentPointer ? (rowIndex.get(row.parentPointer)?.childPointers.length ?? 1) : rows.length;
              const position = row.parentPointer
                ? (rowIndex.get(row.parentPointer)?.childPointers.indexOf(row.pointer) ?? 0) + 1
                : row.depth;
              return (
                <div
                  key={row.pointer}
                  id={`ca-tree-${side}-${row.pointer}`}
                  role="treeitem"
                  aria-level={row.depth + 1}
                  aria-posinset={position}
                  aria-setsize={siblings}
                  aria-selected={selected}
                  aria-expanded={row.hasChildren ? open : undefined}
                  tabIndex={cursorRow?.pointer === row.pointer ? 0 : -1}
                  className={`ca-tree-row ${selected ? "is-selected" : ""} ${row.ghost ? "is-ghost" : ""}`}
                  style={{ paddingLeft: `${4 + (row.depth - 1) * 15}px` }}
                  title={row.pointer}
                  onClick={() => activateRow(row)}
                  onFocus={() => setCursor(list.indexOf(row))}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      className={`ca-twisty ${open ? "" : "is-collapsed"}`}
                      tabIndex={-1}
                      aria-hidden="true"
                      onClick={(event) => { event.stopPropagation(); setExpanded((current) => toggleExpanded(current, row.pointer)); }}
                    >
                      <ChevronRight size={14} />
                    </button>
                  ) : (
                    <span className="ca-twisty is-leaf" aria-hidden="true" />
                  )}

                  <span className="ca-path-label">
                    <HighlightedPath pointer={row.pointer} matches={matchRanges.get(row.pointer) ?? []} />
                  </span>

                  {row.hasWildcard && <WildcardBadge />}
                  {row.ghost ? (
                    <span className="ui-badge ui-badge-required" data-state="unknown">removed</span>
                  ) : (
                    <>
                      <span className="ca-kind"><TypeList kinds={row.kinds} /></span>
                      <RequiredBadge required={row.required} known={row.totalSamples > 0} />
                      {row.totalSamples > 0 && (
                        <span className="dm-tree-meta" title={`Present in ${row.presentInSamples} of ${row.totalSamples} samples`}>
                          {row.presentInSamples}/{row.totalSamples}
                        </span>
                      )}
                    </>
                  )}
                  {change && <Severity severity={change.severity} announce />}
                </div>
              );
            })}
            {list.length === 0 && <p className="ca-tree-empty">No path matches “{query.trim()}”.</p>}
          </div>

          {fingerprint && (
            <div className="ca-fingerprint">
              <span className="ca-overline">Fingerprint</span>
              <code>{fingerprint}</code>
              <IconButton label="Copy contract fingerprint" onClick={() => onCopyFingerprint(fingerprint)}>
                <Copy size={13} aria-hidden="true" />
              </IconButton>
              <span className="ca-fingerprint-note">
                {nodes.length} paths · stable for this inferred structure
              </span>
            </div>
          )}
        </>
      )}

      {!snapshot && (
        <div className="ca-pane-body">
          <Button variant="primary" onClick={() => onReplaceSnapshot(side)}>
            {side === "before" ? "Import baseline" : "Import candidate"}
          </Button>
        </div>
      )}
    </section>
  );
}
