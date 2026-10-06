"use client";

import { useMemo, useState } from "react";
import type { ContractChange, ContractDirection, ContractNode, ContractSnapshot, JsonKind } from "@/lib/contract/types";
import { pointerLabel, pointerDepth } from "@/lib/contract/normalize";
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

export function SnapshotTree({ title, snapshot, opposite, changes, side }: { title: string; snapshot: ContractSnapshot | null; opposite: ContractSnapshot | null; changes: ContractChange[]; side: "before" | "after" }) {
  const pointer = useWorkspaceUIStore((state) => state.activePointer);
  const selectChange = useWorkspaceUIStore((state) => state.selectChange);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const pathMap = useMemo(() => new Map((snapshot?.contract.nodes ?? []).map((node) => [node.pointer, node])), [snapshot]);
  const changeMap = useMemo(() => new Map(changes.map((change) => [change.pointer, change])), [changes]);
  const allPointers = new Set([...pathMap.keys(), ...(opposite?.contract.nodes.map((node) => node.pointer) ?? [])]);
  const nodes = [...allPointers].filter((item) => {
    const parentParts = item.split("/").slice(1, -1);
    let parent = "";
    for (const part of parentParts) { parent += `/${part}`; if (collapsed.has(parent)) return false; }
    return true;
  }).sort((a, b) => pointerDepth(a) - pointerDepth(b) || a.localeCompare(b));
  return <section className="ca-tree-pane" aria-label={`${title} contract tree`}><header className="ca-pane-heading"><div><span className="ca-overline">{title}</span><strong>{snapshot?.versionLabel ?? "No snapshot"}</strong></div><button className="ca-small-button" onClick={() => useWorkspaceUIStore.getState().setImportOpen(true)}>{snapshot ? "Replace" : "Import"}</button></header>
    {!snapshot ? <div className="ca-tree-empty">Import a JSON payload to infer this side.</div> : <div className="ca-tree-scroll" role="tree">{nodes.map((path) => {
      const node = pathMap.get(path);
      const change = changeMap.get(path);
      const renderedNode = node ?? undefined;
      const missing = !renderedNode;
      const isSelected = pointer === path;
      const hasChildren = [...allPointers].some((candidate) => candidate.startsWith(`${path}/`));
      return <button key={path} role="treeitem" aria-selected={isSelected} className={`ca-tree-row ${isSelected ? "is-selected" : ""} ${missing ? "is-ghost" : ""}`} style={{ paddingLeft: `${12 + Math.min(pointerDepth(path), 8) * 15}px` }} onClick={() => { selectChange(change?.id ?? null, path); }} title={path}>
        {hasChildren && <span role="button" tabIndex={0} aria-label={`${collapsed.has(path) ? "Expand" : "Collapse"} ${path}`} className="ca-twisty" onClick={(event) => { event.stopPropagation(); setCollapsed((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; }); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.stopPropagation(); setCollapsed((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; }); } }}>▾</span>}
        <span className="ca-path-label">{pointerLabel(path)}</span><span className="ca-kind">{missing ? "— missing" : typeText(renderedNode)}</span>
        {change && <span className={`ca-dot ca-dot-${change.severity}`} aria-label={severityNames[change.severity]} />}
        {node && <span className="ca-required">{node.required ? "required" : "optional"}</span>}
      </button>;
    })}</div>}
  </section>;
}

export function ChangeRail({ changes, counts, direction, onSelect }: { changes: ContractChange[]; counts: Record<string, number>; direction: ContractDirection; onSelect: (change: ContractChange) => void }) {
  const filters = useWorkspaceUIStore((state) => state.filters);
  const query = useWorkspaceUIStore((state) => state.setQuery);
  const toggleSeverity = useWorkspaceUIStore((state) => state.toggleSeverity);
  const resetFilters = useWorkspaceUIStore((state) => state.resetFilters);
  const filtered = changes.filter((change) => filters.severities.includes(change.severity) && (!filters.query || `${change.pointer} ${change.title} ${change.explanation}`.toLowerCase().includes(filters.query.toLowerCase())));
  return <section className="ca-change-pane"><header className="ca-pane-heading"><div><span className="ca-overline">Semantic drift</span><strong>{changes.length} changes · {direction}</strong></div></header>
    <div className="ca-count-strip">{(["breaking", "warning", "safe", "info"] as const).map((severity) => <button key={severity} className={`ca-count ca-${severity} ${filters.severities.includes(severity) ? "active" : ""}`} onClick={() => toggleSeverity(severity)}><b>{counts[severity] ?? 0}</b>{severityNames[severity]}</button>)}</div>
    <div className="ca-filter-row"><input aria-label="Search changes" value={filters.query} onChange={(event) => query(event.target.value)} placeholder="Search paths or changes…" /><button onClick={resetFilters} title="Reset filters">Reset</button></div>
    <div className="ca-change-list">{filtered.map((change) => <button key={change.id} className={`ca-change-row ${useWorkspaceUIStore.getState().focusedChangeId === change.id ? "is-selected" : ""}`} onClick={() => onSelect(change)}><SeverityBadge severity={change.severity}/><code>{change.pointer}</code><strong>{change.title}</strong><span className="ca-before-after">{typeText(change.before ?? undefined)} <span>→</span> {typeText(change.after ?? undefined)}</span></button>)}{filtered.length === 0 && <p className="ca-muted ca-no-results">No changes match these filters.</p>}</div>
  </section>;
}

export function ChangeInspector({ change, direction, onCopy }: { change: ContractChange | null; direction: ContractDirection; onCopy: (text: string) => void }) {
  const kinds = (node: ContractNode | null) => node ? node.kinds.join(" | ") : "missing";
  return <section className="ca-inspector"><div className="ca-inspector-title"><span className="ca-overline">Inspector</span>{change ? <SeverityBadge severity={change.severity} /> : null}</div>{change ? <div className="ca-inspector-grid"><div><span className="ca-overline">Path</span><code className="ca-inspector-path">{change.pointer}</code><button className="ca-small-button" onClick={() => onCopy(change.pointer)}>Copy path</button></div><div><span className="ca-overline">Change</span><strong>{change.title}</strong><div className="ca-before-after">{kinds(change.before)} → {kinds(change.after)}</div></div><div><span className="ca-overline">Why</span><p>{change.explanation}</p><p className="ca-muted">{direction[0].toUpperCase() + direction.slice(1)} compatibility · Sample inference is evidence, not proof of a formal schema.</p><button className="ca-small-button" onClick={() => onCopy(`${change.severity.toUpperCase()} ${change.pointer} — ${change.title}. ${change.explanation}`)}>Copy summary</button></div></div> : <p className="ca-muted">Select a change to inspect its evidence and compatibility rule.</p>}</section>;
}

export function RawJsonDrawer({ baseline, candidate, onClose }: { baseline: ContractSnapshot | null; candidate: ContractSnapshot | null; onClose: () => void }) {
  const [side, setSide] = useState<"before" | "after">("before");
  const [sample, setSample] = useState(0);
  const snapshot = side === "before" ? baseline : candidate;
  return <div className="ca-raw-drawer"><header><strong>Raw payload samples</strong><div className="ca-raw-actions"><button className="ca-small-button" onClick={() => setSide("before")}>Baseline</button><button className="ca-small-button" onClick={() => setSide("after")}>Candidate</button><button aria-label="Close raw JSON" className="ca-small-button" onClick={onClose}>Close</button></div></header>{snapshot?.samples.length ? <><div className="ca-sample-tabs">{snapshot.samples.map((item, index) => <button key={item.id} className={sample === index ? "active" : ""} onClick={() => setSample(index)}>{item.label}</button>)}</div><pre>{JSON.stringify(snapshot.samples[Math.min(sample, snapshot.samples.length - 1)].value, null, 2)}</pre></> : <p className="ca-muted">No sample available on this side.</p>}</div>;
}

export function EmptyWorkbench({ onImport, onDemo }: { onImport: (side: "before" | "after") => void; onDemo: () => void }) {
  return <div className="ca-empty-state"><div className="ca-empty-symbol"><CircleHelp size={22}/></div><span className="ca-overline">Contract Atlas</span><h1>Compare a contract</h1><p>Import real JSON samples, infer their shapes, then review semantic drift instead of noisy text diffs.</p><div className="ca-steps"><span><b>01</b> Import a baseline payload</span><span><b>02</b> Import a candidate payload</span><span><b>03</b> Analyze structural drift</span></div><div className="ca-empty-actions"><button className="ca-primary" onClick={() => onImport("before")}>Import baseline</button><button className="ca-secondary" onClick={() => onImport("after")}>Import candidate</button><button className="ca-secondary" onClick={onDemo}>Load demo</button></div><small>Your payloads stay in this browser. Nothing is uploaded.</small></div>;
}

export type Kind = JsonKind;
