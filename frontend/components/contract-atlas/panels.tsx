"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ContractChange, ContractDirection, ContractNode, ContractSnapshot, DiffSummary } from "@/lib/contract/types";
import type { UnchangedNode } from "@/lib/contract/compare";
import { pointerDepth, pointerLabel } from "@/lib/contract/normalize";
import { compatibilityRule } from "@/lib/contract/compatibility";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { AlertTriangle, Check, CircleHelp, Info, ShieldAlert } from "lucide-react";

const severityIcons = { breaking: ShieldAlert, warning: AlertTriangle, safe: Check, info: Info };
const severityNames = { breaking: "Breaking", warning: "Warning", safe: "Safe", info: "Info" };

export function SeverityBadge({ severity }: { severity: ContractChange["severity"] }) {
  const Icon = severityIcons[severity];
  return <span className={`ca-severity ca-${severity}`}><Icon size={13} aria-hidden="true" />{severityNames[severity]}</span>;
}

function typeText(node: ContractNode | undefined): string {
  return node ? node.kinds.join(" | ") : "— missing";
}

function ancestorsOf(pointer: string): string[] {
  const ancestors: string[] = [];
  let current = "";
  for (const part of pointer.split("/").slice(1, -1)) { current += `/${part}`; ancestors.push(current); }
  return ancestors;
}

interface SnapshotTreeProps {
  title: string;
  snapshot: ContractSnapshot | null;
  opposite: ContractSnapshot | null;
  changes: ContractChange[];
  side: "before" | "after";
  onRenameLabel: (snapshot: ContractSnapshot, label: string) => void;
  onDeleteSnapshot?: (side: "before" | "after") => void;
}

export function SnapshotTree({ title, snapshot, opposite, changes, side, onRenameLabel, onDeleteSnapshot }: SnapshotTreeProps) {
  const activePointer = useWorkspaceUIStore((state) => state.activePointer);
  const selectChange = useWorkspaceUIStore((state) => state.selectChange);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const pathMap = useMemo(() => new Map((snapshot?.contract.nodes ?? []).map((node) => [node.pointer, node])), [snapshot]);
  const changeMap = useMemo(() => new Map(changes.map((change) => [change.pointer, change])), [changes]);
  const allPointers = useMemo(() => new Set([...pathMap.keys(), ...(opposite?.contract.nodes.map((node) => node.pointer) ?? [])]), [pathMap, opposite]);
  const parentSet = useMemo(() => {
    const parents = new Set<string>();
    for (const pointer of allPointers) {
      const ancestors = ancestorsOf(pointer);
      if (ancestors.length > 0) parents.add(ancestors[ancestors.length - 1]);
    }
    return parents;
  }, [allPointers]);

  // Auto-reveal ancestors of the selected change so the path is always visible.
  useEffect(() => {
    if (!activePointer) return;
    setCollapsed((current) => {
      const hidden = ancestorsOf(activePointer).filter((ancestor) => current.has(ancestor));
      if (hidden.length === 0) return current;
      const next = new Set(current);
      for (const ancestor of hidden) next.delete(ancestor);
      return next;
    });
  }, [activePointer]);

  // Keep the selected row in view on both sides.
  useEffect(() => {
    if (!activePointer) return;
    const selected = scrollRef.current?.querySelector(`[data-pointer="${CSS.escape(activePointer)}"]`);
    if (selected instanceof HTMLElement) selected.scrollIntoView({ block: "nearest" });
  }, [activePointer, collapsed, allPointers]);

  const visiblePointers = [...allPointers]
    .filter((pointer) => ancestorsOf(pointer).every((ancestor) => !collapsed.has(ancestor)))
    .sort((a, b) => pointerDepth(a) - pointerDepth(b) || a.localeCompare(b));

  function toggle(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path); else next.add(path);
      return next;
    });
  }

  return (
    <section className="ca-tree-pane" aria-label={`${title} contract tree`}>
      <header className="ca-pane-heading">
        <div><span className="ca-overline">{title}</span><strong>{snapshot?.versionLabel ?? "No snapshot"}</strong></div>
        <div style={{ display: "flex", gap: 5 }}>
          {snapshot && (
            <button className="ca-small-button" onClick={() => { const label = window.prompt("Snapshot label", snapshot.versionLabel); if (label?.trim() && label.trim() !== snapshot.versionLabel) onRenameLabel(snapshot, label.trim()); }}>Rename</button>
          )}
          {snapshot && onDeleteSnapshot && <button className="ca-small-button is-danger" onClick={() => onDeleteSnapshot(side)}>Delete</button>}
          <button className="ca-small-button" onClick={() => useWorkspaceUIStore.getState().setImportOpen(true)}>{snapshot ? "Replace" : "Import"}</button>
        </div>
      </header>
      {!snapshot ? <div className="ca-tree-empty">Import a JSON payload to infer this side.</div> : (
        <div className="ca-tree-scroll" role="tree" aria-label={`${title} contract paths`} ref={scrollRef}>
          {visiblePointers.map((path) => {
            const node = pathMap.get(path);
            const change = changeMap.get(path);
            const missing = !node;
            const isSelected = activePointer === path;
            const hasChildren = parentSet.has(path);
            return (
              <div
                key={path}
                data-pointer={path}
                role="treeitem"
                aria-selected={isSelected}
                aria-expanded={hasChildren ? !collapsed.has(path) : undefined}
                aria-level={Math.min(pointerDepth(path), 8) + 1}
                tabIndex={0}
                className={`ca-tree-row ${isSelected ? "is-selected" : ""} ${missing ? "is-ghost" : ""}`}
                style={{ paddingLeft: `${12 + Math.min(pointerDepth(path), 8) * 15}px` }}
                title={path}
                onClick={() => selectChange(change?.id ?? null, path)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectChange(change?.id ?? null, path); } }}
              >
                <button
                  className={`ca-twisty ${hasChildren ? "" : "is-leaf"}`}
                  tabIndex={-1}
                  aria-hidden={!hasChildren}
                  aria-label={`${collapsed.has(path) ? "Expand" : "Collapse"} ${path}`}
                  onClick={(event) => { event.stopPropagation(); toggle(path); }}
                >▾</button>
                <span className="ca-path-label">{pointerLabel(path)}</span>
                <span className="ca-kind">{missing ? "— missing" : typeText(node)}</span>
                {change && <span className={`ca-dot ca-dot-${change.severity}`} aria-label={severityNames[change.severity]} />}
                {node && <span className="ca-required">{node.required ? "required" : "optional"}</span>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ChangeRailProps {
  changes: ContractChange[];
  counts: DiffSummary;
  direction: ContractDirection;
  unchanged: UnchangedNode[];
  onSelect: (change: ContractChange) => void;
}

const UNCHANGED_LIMIT = 150;

export function ChangeRail({ changes, counts, direction, unchanged, onSelect }: ChangeRailProps) {
  const filters = useWorkspaceUIStore((state) => state.filters);
  const focusedChangeId = useWorkspaceUIStore((state) => state.focusedChangeId);
  const setQuery = useWorkspaceUIStore((state) => state.setQuery);
  const toggleSeverity = useWorkspaceUIStore((state) => state.toggleSeverity);
  const resetFilters = useWorkspaceUIStore((state) => state.resetFilters);
  const setShowUnchanged = useWorkspaceUIStore((state) => state.setShowUnchanged);
  const query = filters.query.trim().toLowerCase();
  const filtered = changes.filter((change) =>
    filters.severities.includes(change.severity) &&
    (!query || `${change.pointer} ${change.title} ${change.explanation}`.toLowerCase().includes(query)),
  );

  return (
    <section className="ca-change-pane" aria-label="Semantic drift">
      <header className="ca-pane-heading"><div><span className="ca-overline">Drift</span><strong>{changes.length} changes · {direction}</strong></div></header>
      <div className="ca-count-strip">
        {(["breaking", "warning", "safe", "info"] as const).map((severity) => (
          <button
            key={severity}
            className={`ca-count ca-${severity} ${filters.severities.includes(severity) ? "active" : ""}`}
            aria-pressed={filters.severities.includes(severity)}
            onClick={() => toggleSeverity(severity)}
          ><b>{counts[severity]}</b>{severityNames[severity]}</button>
        ))}
      </div>
      <div className="ca-filter-row">
        <input aria-label="Search changes" value={filters.query} onChange={(event) => setQuery(event.target.value)} placeholder="Search paths or changes…" />
        <button className="ca-unchanged-toggle" aria-pressed={filters.showUnchanged} title="Show or hide unchanged paths" onClick={() => setShowUnchanged(!filters.showUnchanged)}>Unchanged</button>
        <button onClick={resetFilters} title="Reset filters">Reset</button>
      </div>
      <div className="ca-change-list">
        {filtered.map((change) => (
          <button key={change.id} className={`ca-change-row ${focusedChangeId === change.id ? "is-selected" : ""}`} onClick={() => onSelect(change)}>
            <SeverityBadge severity={change.severity} />
            <code>{change.pointer}</code>
            <strong>{change.title}</strong>
            <span className="ca-before-after">{typeText(change.before ?? undefined)} <span>→</span> {typeText(change.after ?? undefined)}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="ca-muted" style={{ padding: 12 }}>No changes match these filters.</p>}
        {filters.showUnchanged && (
          <div className="ca-unchanged-list" aria-label="Unchanged paths">
            {unchanged.slice(0, UNCHANGED_LIMIT).map((node) => (
              <div key={node.pointer} className="ca-unchanged-row">
                <code>{node.pointer}</code>
                <span className="ca-kind">{node.kinds.join(" | ")}</span>
                <span className="ca-required">{node.required ? "required" : "optional"}</span>
              </div>
            ))}
            {unchanged.length > UNCHANGED_LIMIT && <p className="ca-unchanged-note">Showing the first {UNCHANGED_LIMIT} of {unchanged.length} unchanged paths.</p>}
            {unchanged.length === 0 && <p className="ca-unchanged-note">No unchanged paths shared by both sides.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function examplesText(node: ContractNode | null): string | null {
  if (!node || node.examples.length === 0) return null;
  return node.examples.map((example) => JSON.stringify(example)).join(", ");
}

export function ChangeInspector({ change, direction, onCopy }: { change: ContractChange | null; direction: ContractDirection; onCopy: (text: string) => void }) {
  if (!change) {
    return (
      <section className="ca-inspector" aria-label="Change inspector">
        <div className="ca-inspector-title"><span className="ca-overline">Inspector</span></div>
        <p className="ca-muted" style={{ paddingTop: 9 }}>Select a change to inspect its evidence and compatibility rule.</p>
      </section>
    );
  }
  const kinds = (node: ContractNode | null) => (node ? node.kinds.join(" | ") : "missing");
  const beforeExamples = examplesText(change.before);
  const afterExamples = examplesText(change.after);
  return (
    <section className="ca-inspector" aria-label="Change inspector">
      <div className="ca-inspector-title"><span className="ca-overline">Inspector</span><SeverityBadge severity={change.severity} /></div>
      <div className="ca-inspector-grid">
        <div>
          <span className="ca-overline">Path</span>
          <code className="ca-inspector-path">{change.pointer}</code>
          <button className="ca-small-button" onClick={() => onCopy(change.pointer)}>Copy path</button>
        </div>
        <div>
          <span className="ca-overline">Change</span>
          <strong>{change.title}</strong>
          <div className="ca-before-after">{kinds(change.before)} → {kinds(change.after)}</div>
          {change.before && <span className="ca-sample-count">Before: {change.before.presentInSamples}/{change.before.totalSamples} samples · {change.before.required ? "required" : "optional"}</span>}
          {change.after && <span className="ca-sample-count">After: {change.after.presentInSamples}/{change.after.totalSamples} samples · {change.after.required ? "required" : "optional"}</span>}
          {beforeExamples && <p className="ca-examples">Before examples: {beforeExamples}</p>}
          {afterExamples && <p className="ca-examples">After examples: {afterExamples}</p>}
        </div>
        <div>
          <span className="ca-overline">Why</span>
          <p>{change.explanation}</p>
          <p className="ca-muted">Sample inference is evidence, not proof of the producer&apos;s formal schema.</p>
          <div className="ca-inspector-rule"><strong>Compatibility rule.</strong> {compatibilityRule(change.kind, direction, change.before?.required ?? false)}</div>
          <button className="ca-small-button" style={{ marginTop: 7 }} onClick={() => onCopy(`${change.severity.toUpperCase()} ${change.pointer} — ${change.title}. ${change.explanation}`)}>Copy summary</button>
        </div>
      </div>
    </section>
  );
}

export function RawJsonDrawer({ baseline, candidate, onClose }: { baseline: ContractSnapshot | null; candidate: ContractSnapshot | null; onClose: () => void }) {
  const [side, setSide] = useState<"before" | "after">("before");
  const [sampleIndex, setSampleIndex] = useState(0);
  const snapshot = side === "before" ? baseline : candidate;
  const activeSample = snapshot?.samples.length ? snapshot.samples[Math.min(sampleIndex, snapshot.samples.length - 1)] : null;
  return (
    <div className="ca-raw-drawer" role="dialog" aria-label="Raw JSON samples">
      <header>
        <strong>Raw payload samples</strong>
        <div className="ca-raw-actions">
          <button className="ca-small-button" aria-pressed={side === "before"} onClick={() => { setSide("before"); setSampleIndex(0); }}>Baseline</button>
          <button className="ca-small-button" aria-pressed={side === "after"} onClick={() => { setSide("after"); setSampleIndex(0); }}>Candidate</button>
          <button aria-label="Close raw JSON drawer" className="ca-small-button" onClick={onClose}>Close</button>
        </div>
      </header>
      {snapshot?.samples.length ? (
        <>
          <div className="ca-sample-tabs" role="tablist" aria-label="Samples">
            {snapshot.samples.map((item, index) => (
              <button key={item.id} role="tab" aria-selected={sampleIndex === index} className={sampleIndex === index ? "active" : ""} onClick={() => setSampleIndex(index)}>{item.label}</button>
            ))}
          </div>
          <pre>{JSON.stringify(activeSample?.value ?? {}, null, 2)}</pre>
        </>
      ) : <p className="ca-muted" style={{ padding: 12 }}>No sample available on this side.</p>}
    </div>
  );
}

export function EmptyWorkbench({ onImport, onDemo }: { onImport: (side: "before" | "after") => void; onDemo: () => void }) {
  return (
    <div className="ca-empty-state">
      <div className="ca-empty-symbol"><CircleHelp size={22} aria-hidden="true" /></div>
      <span className="ca-overline">DriftMap</span>
      <h1>Compare a contract</h1>
      <p>Import real JSON samples, infer their shapes, then review semantic drift instead of a noisy text diff.</p>
      <div className="ca-steps">
        <span><b>01</b> Import a baseline JSON payload</span>
        <span><b>02</b> Import a candidate JSON payload</span>
        <span><b>03</b> Analyze structural drift</span>
      </div>
      <div className="ca-empty-actions">
        <button className="ca-primary" onClick={() => onImport("before")}>Import baseline</button>
        <button className="ca-secondary" onClick={() => onImport("after")}>Import candidate</button>
        <button className="ca-secondary" onClick={onDemo}>Load demo</button>
      </div>
      <small>Your payloads stay in this browser. Nothing is uploaded.</small>
    </div>
  );
}
