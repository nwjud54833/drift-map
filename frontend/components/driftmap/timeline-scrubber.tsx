"use client";

import type { TimelineRevision } from "@/lib/driftmap/presentation";

/**
 * Schema version timeline scrubber.
 *
 * Ported from the reference build's `#hero-timeline-slider` +
 * `renderTimelineNodes()` pair. The reference scrubs a hard-coded snapshot
 * array; here the four stops are real contracts the engine produced (see
 * `buildTimeline`), so dragging the slider morphs the comparison through
 * genuinely inferred revisions.
 *
 * Each node's count is `revision.counts`, which `reindexRevisions` derives from
 * the same change list the findings table renders. Counting the step delta here
 * instead is what once made a `6 changes` label sit above a 16-row table.
 */

export function TimelineScrubber({
  revisions,
  activeIndex,
  onChange,
  idPrefix,
  compact = false,
  label = "SCHEMA VERSION TIMELINE SCRUBBER",
  baselineLabel,
}: {
  revisions: readonly TimelineRevision[];
  activeIndex: number;
  onChange: (index: number) => void;
  /** Unique per instance: the landing hero and the workbench both render one. */
  idPrefix: string;
  /** Workbench variant drops the per-node summary line. */
  compact?: boolean;
  label?: string;
  baselineLabel?: string;
}) {
  const active = revisions[activeIndex] ?? revisions[0];
  const max = Math.max(revisions.length - 1, 0);

  return (
    <div className="px-1">
      <input
        id={`${idPrefix}-timeline-slider`}
        type="range"
        min={0}
        max={max}
        step={1}
        value={activeIndex}
        aria-label={label}
        aria-valuetext={active ? `${active.version} · ${active.summary}` : undefined}
        onChange={(event) => onChange(Number.parseInt(event.target.value, 10))}
        className="timeline-slider mb-3"
      />

      <div className={`grid gap-2 text-left font-mono ${compact ? "grid-cols-4 gap-1 text-[10px]" : "grid-cols-2 sm:grid-cols-4 text-[11px]"}`} id={`${idPrefix}-timeline-nodes`}>
        {revisions.map((revision, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={revision.version}
              type="button"
              onClick={() => onChange(index)}
              aria-current={isActive}
              className={`text-left rounded-xl border transition-all ${compact ? "p-1.5" : "p-2"} ${
                isActive
                  ? "bg-white/[0.08] border-white/30 text-white shadow-sm"
                  : "bg-[#050507]/70 border-white/[0.06] text-[#9496A1] hover:text-white hover:border-white/15"
              }`}
            >
              <span className="flex items-center justify-between gap-1">
                <span className="font-semibold flex items-center gap-1.5 min-w-0">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${revision.dotClass}`} />
                  <span className="truncate">{revision.version}</span>
                </span>
                {!compact && (
                  <span className="text-[10px] text-[#5E606E] hidden sm:inline shrink-0">{revision.fingerprint.slice(0, 7)}</span>
                )}
              </span>
              {!compact && (
                <span className="block text-[10px] text-[#5E606E] truncate mt-0.5">{revision.summary}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Announced to assistive technology; the visual equivalent is the node grid. */}
      <p className="sr-only" aria-live="polite">
        {active ? `${active.version}: ${active.summary}. Comparing ${baselineLabel ?? "v1.0.0"} to ${active.version}.` : ""}
      </p>
    </div>
  );
}

/** The "Comparing: <baseline> ➔ <active>" badge pair from the reference header. */
export function TimelineBadges({
  baselineLabel,
  revision,
}: {
  baselineLabel: string;
  revision: TimelineRevision | null;
}) {
  return (
    <div className="flex items-center gap-2 font-mono text-xs">
      <span className="text-[#9496A1]">Comparing:</span>
      <span className="px-2 py-0.5 rounded bg-white/[0.05] text-white border border-white/[0.08]">{baselineLabel}</span>
      <span className="text-white/40">➔</span>
      <span
        id="hero-timeline-active-badge"
        className={`px-2 py-0.5 rounded font-semibold ${
          revision?.tone === "breaking" ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
            : revision?.tone === "warning" ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
              : revision?.tone === "safe" ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                : "bg-sky-500/15 text-sky-300 border border-sky-500/30"
        }`}
      >
        {revision ? `${revision.version} · ${revision.fingerprint.slice(0, 7)}` : "—"}
      </span>
    </div>
  );
}
