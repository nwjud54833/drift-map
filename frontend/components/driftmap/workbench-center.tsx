"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ChangeSeverity } from "@/lib/contract/types";
import type { Finding, TimelineRevision } from "@/lib/driftmap/presentation";
import { severityPillClass, severityStrokeColor, CLASSIFICATION_CAVEAT } from "@/lib/driftmap/rules";
import { Sparkline } from "./sparkline";
import { ContractForceGraph, type ContractForceGraphHandle } from "./contract-force-graph";
import { TimelineScrubber } from "./timeline-scrubber";
import { useFloatingRowHighlight } from "./use-floating-row-highlight";

/**
 * Workbench centre pane.
 *
 * Ported from the reference build's `#wb-center-table-container` and
 * `#wb-center-graph-container`: the commit timeline scrubber, the Diff Radar
 * segmented percentage bar, the severity filter tabs, the path search, and the
 * segmented toggle between the Table Grid view and the 3D Force Graph view.
 */

const SEVERITY_TABS: ReadonlyArray<{ key: ChangeSeverity | "all"; label: string; dot: string }> = [
  { key: "all", label: "All", dot: "bg-white" },
  { key: "breaking", label: "Breaking", dot: "bg-rose-400" },
  { key: "warning", label: "Warning", dot: "bg-amber-400" },
  { key: "safe", label: "Safe", dot: "bg-emerald-400" },
  { key: "info", label: "Info", dot: "bg-sky-400" },
];

export interface WorkbenchCenterHandle {
  zoomGraph: (delta: number) => void;
  resetGraph: () => void;
  toggleGraphOrbit: () => void;
}

export const WorkbenchCenter = forwardRef<WorkbenchCenterHandle, {
  findings: readonly Finding[];
  revisions: readonly TimelineRevision[];
  activeRevisionIndex: number;
  onRevisionChange: (index: number) => void;
  candidateVersion: string;
  mode: "table" | "graph";
  onModeChange: (mode: "table" | "graph") => void;
  severity: ChangeSeverity | "all";
  onSeverityChange: (severity: ChangeSeverity | "all") => void;
  query: string;
  onQueryChange: (query: string) => void;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  flashIndex: number;
  recomputing: boolean;
}>(function WorkbenchCenter({
  findings,
  revisions,
  activeRevisionIndex,
  onRevisionChange,
  candidateVersion,
  mode,
  onModeChange,
  severity,
  onSeverityChange,
  query,
  onQueryChange,
  selectedIndex,
  onSelectIndex,
  flashIndex,
  recomputing,
}, ref) {
  const graphRef = useRef<ContractForceGraphHandle>(null);
  const [autoOrbit, setAutoOrbit] = useState(true);

  const counts = useMemo(() => {
    const tally = { breaking: 0, warning: 0, safe: 0, info: 0 };
    for (const finding of findings) tally[finding.severity] += 1;
    return tally;
  }, [findings]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return findings.filter((finding) => {
      if (severity !== "all" && finding.severity !== severity) return false;
      if (!text) return true;
      return `${finding.pointer} ${finding.title} ${finding.ruleId} ${finding.explanation}`.toLowerCase().includes(text);
    });
  }, [findings, severity, query]);

  const radar = useMemo(() => {
    const total = Math.max(findings.length, 1);
    const breaking = Math.round((counts.breaking / total) * 100);
    const warning = Math.round((counts.warning / total) * 100);
    const safe = Math.round((counts.safe / total) * 100);
    const info = Math.max(0, 100 - breaking - warning - safe);
    return { breaking, warning, safe, info, total: findings.length };
  }, [counts, findings.length]);

  const activeRevision = revisions[activeRevisionIndex] ?? revisions[0] ?? null;

  useImperativeHandle(ref, () => ({
    zoomGraph: (delta) => graphRef.current?.zoom(delta),
    resetGraph: () => graphRef.current?.resetCamera(),
    toggleGraphOrbit: () => {
      graphRef.current?.toggleAutoOrbit();
      setAutoOrbit(graphRef.current?.autoOrbit() ?? true);
    },
  }), []);

  const { selectedIndex: rowIndex, select, stageRef, highlightRef, rowId } = useFloatingRowHighlight({
    count: filtered.length,
    enabled: mode === "table",
    hidden: filtered.length === 0,
    onSelect: onSelectIndex,
  });

  // Keep the parent's selection authority: an external change (3D graph click,
  // palette command) moves the floating highlight too.
  useEffect(() => {
    if (selectedIndex !== rowIndex && selectedIndex >= 0 && selectedIndex < filtered.length) select(selectedIndex);
    // `select` is stable per count; re-running on every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, filtered.length]);

  const activePointer = filtered[rowIndex]?.pointer ?? null;

  return (
    <div className="lg:col-span-5 bg-[#030304] flex flex-col live-grid-wrapper min-w-0">
      <div className="laser-scanline" aria-hidden="true" />

      {/* Controls */}
      <div className="p-4 bg-[#0A0A0D] border-b border-white/[0.08] space-y-3.5 relative z-10">
        {revisions.length > 1 && (
          <div className="p-3 rounded-xl bg-[#050507] border border-white/[0.08]">
            <div className="flex items-center justify-between gap-2 text-[10px] font-mono mb-2">
              <span className="uppercase tracking-wider text-[#9496A1] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>COMMIT TIMELINE SCRUBBER</span>
              </span>
              <span className={`font-semibold ${activeRevision?.tone === "breaking" ? "text-rose-300" : activeRevision?.tone === "warning" ? "text-amber-300" : activeRevision?.tone === "safe" ? "text-emerald-300" : "text-sky-300"}`}>
                {activeRevision ? `${activeRevision.version} · ${activeRevision.fingerprint.slice(0, 7)}` : "—"}
              </span>
            </div>
            <TimelineScrubber
              revisions={revisions}
              activeIndex={activeRevisionIndex}
              onChange={onRevisionChange}
              idPrefix="wb"
              compact
              label="Commit timeline scrubber"
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#9496A1]">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>DIFF RADAR</span>
              <span className="text-[#5E606E] ml-1">
                {findings.length > 0
                  ? `${radar.breaking}% breaking · ${radar.warning}% warning · ${radar.safe}% safe · ${radar.info}% stable`
                  : "no findings"}
              </span>
            </div>

            <div className="inline-flex items-center p-0.5 rounded-lg bg-[#050507] border border-white/[0.09] font-mono text-[11px]">
              <button
                type="button"
                onClick={() => onModeChange("table")}
                aria-pressed={mode === "table"}
                className={`px-2.5 py-1 rounded-md transition-all ${mode === "table" ? "bg-white text-[#030304] font-semibold" : "text-[#9496A1] hover:text-white"}`}
              >
                Table grid view
              </button>
              <button
                type="button"
                onClick={() => onModeChange("graph")}
                aria-pressed={mode === "graph"}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${mode === "graph" ? "bg-white text-[#030304] font-semibold" : "text-[#9496A1] hover:text-white"}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                <span>3D force graph</span>
              </button>
            </div>
          </div>

          <div className="w-full h-2 rounded-full bg-[#111116] border border-white/[0.07] overflow-hidden flex gap-0.5 p-0.5" role="img" aria-label={`Diff radar: ${radar.breaking}% breaking, ${radar.warning}% warning, ${radar.safe}% safe, ${radar.info}% stable`}>
            <span className="h-full bg-rose-500 rounded-l-full transition-all duration-500" style={{ width: `${radar.breaking}%` }} />
            <span className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${radar.warning}%` }} />
            <span className="h-full bg-emerald-400 transition-all duration-500" style={{ width: `${radar.safe}%` }} />
            <span className="h-full bg-sky-400 rounded-r-full transition-all duration-500" style={{ width: `${radar.info}%` }} />
          </div>
        </div>

        {/* Severity filter tabs */}
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter findings by DriftMap classification">
          {SEVERITY_TABS.map((tab) => {
            const count = tab.key === "all" ? findings.length : counts[tab.key];
            const active = severity === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onSeverityChange(tab.key)}
                aria-pressed={active}
                disabled={count === 0 && tab.key !== "all"}
                className={`px-2.5 py-1 rounded-lg font-mono text-xs inline-flex items-center gap-1.5 transition-all disabled:opacity-40 ${
                  active ? "bg-white text-[#030304] font-semibold" : "bg-[#111116] text-[#9496A1] hover:text-white border border-white/[0.07]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
                <span>{tab.label}</span>
                <span className="opacity-75">({count})</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] font-mono text-[#5E606E] leading-relaxed">{CLASSIFICATION_CAVEAT}</p>

        {/* Path search */}
        <div className="relative">
          <svg className="w-3.5 h-3.5 text-[#5E606E] absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <label className="sr-only" htmlFor="path-search-input">Filter by JSON pointer path</label>
          <input
            id="path-search-input"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Filter by JSON pointer path (e.g. /data/customer or /items/*)…"
            className="w-full pl-9 pr-20 py-1.5 rounded-lg bg-[#111116] border border-white/[0.08] focus:border-white/25 focus:outline-none font-mono text-xs text-white placeholder-[#5E606E]"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#5E606E]">↑↓ / JK</span>
        </div>

        {recomputing && (
          <p className="text-[10px] font-mono text-sky-300" role="status">Recomputing from the debounced draft…</p>
        )}
      </div>

      {/* Table grid view */}
      <div className="flex-1 flex flex-col" hidden={mode !== "table"}>
        <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-[#5E606E] border-b border-white/[0.06] bg-[#08080B] relative z-10">
          <div className="col-span-5">Normalized path &amp; sparkline</div>
          <div className="col-span-4">Classification</div>
          <div className="col-span-3 text-right">Type shift</div>
        </div>

        <div className="relative flex-1 overflow-y-auto max-h-[520px]" ref={stageRef} role="listbox" aria-label="Contract drift findings">
          <div ref={highlightRef} className="floating-row-highlight" aria-hidden="true" />
          <div className="divide-y divide-white/[0.05] relative z-10">
            {filtered.length === 0 ? (
              <p className="p-10 text-center font-mono text-xs text-[#5E606E]">
                No contract drift findings match the current filter.
              </p>
            ) : (
              filtered.map((finding, index) => (
                <div
                  key={finding.id}
                  id={rowId(index)}
                  role="option"
                  aria-selected={index === rowIndex}
                  tabIndex={-1}
                  onClick={() => select(index)}
                  className={`grid grid-cols-12 items-center px-4 py-3 font-mono text-xs cursor-pointer transition-colors ${index === flashIndex ? `flash-${finding.severity}` : ""}`}
                >
                  <div className="col-span-5 pr-2 flex items-center justify-between gap-2 min-w-0">
                    <span className="text-white font-medium truncate">{finding.pointer}</span>
                    <Sparkline points={finding.sparkPoints} severity={finding.severity} />
                  </div>
                  <div className="col-span-4 min-w-0">
                    <span className={`${severityPillClass(finding.severity)} px-2 py-0.5 rounded-full text-[11px] font-medium inline-block truncate max-w-full`}>
                      {finding.driftLabel}
                    </span>
                  </div>
                  <div className="col-span-3 text-right text-[11px] text-[#9496A1] flex items-center justify-end gap-1 min-w-0">
                    <span className="text-white/70 truncate">{finding.fromType}</span>
                    <span className="text-white/30" aria-hidden="true">➔</span>
                    <span className="text-white truncate">{finding.toType}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 3D force graph view */}
      {/*
        `min-h-[480px]` sets the floor and `flex-1 min-h-0` lets the pane shrink
        rather than stretch: without `min-h-0` a flex child refuses to go below
        its content's height, so the canvas would grow the pane and every grid
        track beside it instead of being clipped to the pane.
      */}
      <div
        className="flex-1 min-h-[480px] flex-col relative bg-[#040406] overflow-hidden"
        style={{ display: mode === "graph" ? "flex" : "none" }}
      >
        <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          <div className="px-2.5 py-1.5 rounded-lg bg-[#0A0A0D]/90 border border-white/[0.1] backdrop-blur-md font-mono text-[10px] text-[#9496A1] pointer-events-auto">
            <span className="text-white font-medium">3D orbital contract AST</span> · drag to rotate · click a node to inspect
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto font-mono text-[10px]">
            <button
              type="button"
              onClick={() => { graphRef.current?.toggleAutoOrbit(); setAutoOrbit(graphRef.current?.autoOrbit() ?? true); }}
              className={`px-2.5 py-1 rounded-lg bg-[#0A0A0D]/90 border border-white/[0.12] hover:text-white transition-colors ${autoOrbit ? "text-emerald-400" : "text-[#9496A1]"}`}
            >
              ⟳ Auto-orbit: {autoOrbit ? "on" : "paused"}
            </button>
            <button type="button" onClick={() => graphRef.current?.zoom(0.15)} className="px-2 py-1 rounded-lg bg-[#0A0A0D]/90 border border-white/[0.12] text-white hover:bg-white/10" title="Zoom in">+</button>
            <button type="button" onClick={() => graphRef.current?.zoom(-0.15)} className="px-2 py-1 rounded-lg bg-[#0A0A0D]/90 border border-white/[0.12] text-white hover:bg-white/10" title="Zoom out">−</button>
            <button type="button" onClick={() => graphRef.current?.resetCamera()} className="px-2 py-1 rounded-lg bg-[#0A0A0D]/90 border border-white/[0.12] text-[#9496A1] hover:text-white">Reset</button>
          </div>
        </div>

        <ContractForceGraph
          ref={graphRef}
          findings={filtered}
          activePointer={activePointer}
          active={mode === "graph"}
          onSelectFinding={(index) => select(index)}
        />

        <div className="absolute bottom-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0A0A0D]/90 border border-white/[0.08] backdrop-blur-md font-mono text-[10px] text-[#9496A1]">          <div className="flex flex-wrap items-center gap-3">
            {(["breaking", "warning", "safe", "info"] as const).map((tone) => (
              <span key={tone} className="flex items-center gap-1.5 capitalize">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: severityStrokeColor(tone) }} />
                {tone}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#A1A1AA]" />
              Structural root/branch
            </span>
          </div>
          <span className="text-white font-medium truncate max-w-[50%]">{activePointer ?? "no node selected"}</span>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {filtered.length} of {findings.length} findings for revision {candidateVersion}.
      </p>
    </div>
  );
});
