"use client";

import type { ChangeSeverity } from "@/lib/contract/types";
import { SPARKLINE_VIEW_HEIGHT, SPARKLINE_VIEW_WIDTH, sparklinePointsAttr } from "@/lib/driftmap/sparkline";
import { severityStrokeColor } from "@/lib/driftmap/rules";

/**
 * Presence sparkline rendered inside a finding row. Ported from
 * `buildSparklineSVG` in the Obsidian v2.5 "Spatial" reference build, as a real
 * component so it participates in React's render tree instead of being injected
 * as an HTML string.
 */
export function Sparkline({
  points,
  severity,
  className = "w-[52px] h-[16px] shrink-0 overflow-visible",
}: {
  points: readonly number[];
  severity: ChangeSeverity;
  className?: string;
}) {
  const color = severityStrokeColor(severity);
  return (
    <svg className={className} viewBox={`0 0 ${SPARKLINE_VIEW_WIDTH} ${SPARKLINE_VIEW_HEIGHT}`} fill="none" aria-hidden="true">
      <polyline
        points={sparklinePointsAttr(points)}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The visibility bar that sits under the sparkline in the telemetry cell. */
export function PresenceBar({
  presentCount,
  totalSamples,
  severity,
}: {
  presentCount: number;
  totalSamples: number;
  severity: ChangeSeverity;
}) {
  const percent = Math.min(100, Math.round((presentCount / Math.max(totalSamples, 1)) * 100));
  const barColor = severity === "breaking" ? "bg-rose-500"
    : severity === "warning" ? "bg-amber-400"
      : severity === "safe" ? "bg-emerald-400"
        : "bg-sky-400";
  return (
    <span className="w-16 h-1 rounded-full bg-white/[0.07] overflow-hidden inline-block">
      <span className={`block h-full ${barColor} transition-all duration-300`} style={{ width: `${percent}%` }} />
    </span>
  );
}
