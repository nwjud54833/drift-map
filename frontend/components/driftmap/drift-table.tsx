"use client";

import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import { severityPillClass } from "@/lib/driftmap/rules";
import { useFloatingRowHighlight } from "./use-floating-row-highlight";

/**
 * Normalized-path drift table for the hero 3D stage.
 *
 * Ported from the reference build's `#hero-drift-rows` / `renderHeroDriftShowcase`
 * pair: laser scanline, decorative crosshair lattice, floating glass row
 * indicator, per-row telemetry and semantic flash pulses.
 *
 * The rows are the real `compareContracts` output adapted by
 * `lib/driftmap/presentation.ts`; `flashIndex` carries the live-traffic tick so
 * only the row that just changed animates.
 */

export interface DriftRow {
  id: string;
  pointer: string;
  ruleId: string;
  fromType: string;
  toType: string;
  driftLabel: string;
  severity: "breaking" | "warning" | "safe" | "info";
  presentCount: number;
  totalSamples: number;
  sparkPoints: readonly number[];
}

export function DriftTable({
  rows,
  flashIndex,
  onSelect,
}: {
  rows: readonly DriftRow[];
  flashIndex: number;
  onSelect?: (index: number) => void;
}) {
  const { selectedIndex, select, stageRef, highlightRef, rowId } = useFloatingRowHighlight({
    count: rows.length,
    hidden: rows.length === 0,
    onSelect: (index) => {
      const row = rows[index];
      if (row) DriftAudioSynth.playForSeverity(row.severity);
      onSelect?.(index);
    },
  });

  return (
    <div className="relative" ref={stageRef}>
      <div id="hero-floating-highlight" ref={highlightRef} className="floating-row-highlight" aria-hidden="true" />
      <div id="hero-drift-rows" className="divide-y divide-white/[0.05] relative z-10" role="listbox" aria-label="Contract drift findings">
        {rows.map((row, index) => (
          <DriftTableRow
            key={row.id}
            id={rowId(index)}
            row={row}
            selected={index === selectedIndex}
            flashing={index === flashIndex}
            onSelect={() => select(index)}
          />
        ))}
      </div>
    </div>
  );
}

/** Only the row that changed flashes, so a live tick never repaints the table. */
function DriftTableRow({
  id,
  row,
  selected,
  flashing,
  onSelect,
}: {
  id: string;
  row: DriftRow;
  selected: boolean;
  flashing: boolean;
  onSelect: () => void;
}) {
  const percent = Math.min(100, Math.round((row.presentCount / Math.max(row.totalSamples, 1)) * 100));
  const barColor = row.severity === "breaking" ? "bg-rose-500"
    : row.severity === "warning" ? "bg-amber-400"
      : row.severity === "safe" ? "bg-emerald-400"
        : "bg-sky-400";
  const chart = sparklineGeometry(row.sparkPoints);

  return (
    <div
      id={id}
      role="option"
      aria-selected={selected}
      tabIndex={-1}
      onClick={onSelect}
      className={`grid grid-cols-12 items-center px-4 sm:px-6 py-3.5 font-mono text-xs cursor-pointer transition-colors ${flashing ? `flash-${row.severity}` : ""}`}
    >
      <div className="col-span-4 pr-2 flex items-center gap-2.5 min-w-0">
        <span className={`w-1 self-stretch rounded-full shrink-0 ${barColor}`} aria-hidden="true" />
        <span className="truncate">
          <span className="block text-white font-medium truncate">{row.pointer}</span>
          <span className="block text-[10px] text-[#5E606E] truncate">{row.ruleId}</span>
        </span>
      </div>

      <div className="col-span-3 pr-2 flex items-center gap-1.5 text-[11px] min-w-0">
        <span className="px-1.5 py-0.5 rounded bg-white/[0.04] text-[#9496A1] border border-white/[0.06] truncate">{row.fromType}</span>
        <svg className="w-3.5 h-3.5 shrink-0 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-4-4 4 4-4 4" />
        </svg>
        <span className="px-1.5 py-0.5 rounded bg-white/[0.06] text-white border border-white/[0.1] truncate">{row.toType}</span>
      </div>

      <div className="col-span-3">
        <span className={`${severityPillClass(row.severity)} px-2.5 py-0.5 rounded-full text-[11px] font-medium inline-block`}>
          {row.driftLabel}
        </span>
      </div>

      <div className="col-span-2 flex flex-col items-end justify-center gap-1">
        <span className="flex items-center gap-1.5">
          <svg className="w-[52px] h-[16px] shrink-0 overflow-visible" viewBox="0 0 52 16" fill="none" aria-hidden="true">
            <polyline
              points={chart}
              stroke={strokeFor(row.severity)}
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[10px] text-[#9496A1]">{row.presentCount}/{row.totalSamples}</span>
        </span>
        <span className="w-16 h-1 rounded-full bg-white/[0.07] overflow-hidden inline-block">
          <span className={`block h-full ${barColor} transition-all duration-300`} style={{ width: `${percent}%` }} />
        </span>
      </div>
    </div>
  );
}

function strokeFor(severity: DriftRow["severity"]): string {
  if (severity === "breaking") return "#FB7185";
  if (severity === "warning") return "#FBBF24";
  if (severity === "safe") return "#34D399";
  return "#38BDF8";
}

function sparklineGeometry(points: readonly number[]): string {
  const width = 52;
  const height = 16;
  const step = width / Math.max(points.length - 1, 1);
  return points
    .map((point, index) => `${(index * step).toFixed(1)},${(height - (point / 100) * (height - 4) - 2).toFixed(1)}`)
    .join(" ");
}

/** Decorative crosshair lattice behind the rows. */
export function CrosshairLattice({ id }: { id: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-25 z-0" aria-hidden="true">
      <defs>
        <pattern id={id} width="120" height="58" patternUnits="userSpaceOnUse">
          <path d="M 116 58 L 124 58 M 120 54 L 120 62" stroke="rgba(255,255,255,0.28)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
