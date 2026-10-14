import type { ChangeSeverity } from "@/lib/contract/types";
import { severityStrokeColor } from "./rules";

/**
 * Presence sparkline for a finding row.
 *
 * The engine reports a single measured presence point per finding
 * (`presentInSamples` / `totalSamples`), not a time series, so this builds the
 * trend the reference build visualises from the evidence that actually exists:
 * a removed or added field trends away from its baseline observation, while a
 * stable field holds flat. Nothing is extrapolated beyond the series' own
 * measured endpoints.
 */

export const SPARKLINE_POINTS = 7;
const VIEW_WIDTH = 52;
const VIEW_HEIGHT = 16;

/** True when a series rises over time (a field that was absent and now appears). */
export type SparklineDirection = "flat" | "rising" | "falling";

export function presenceSeries(
  presentInSamples: number,
  totalSamples: number,
  direction: SparklineDirection = "flat",
): number[] {
  const pct = totalSamples > 0 ? Math.round((presentInSamples / totalSamples) * 100) : 0;
  return Array.from({ length: SPARKLINE_POINTS }, (_, index) => {
    if (direction === "flat" || index === SPARKLINE_POINTS - 1) return pct;
    const progress = index / (SPARKLINE_POINTS - 1);
    if (direction === "rising") return Math.round(pct * progress);
    return Math.round(pct + (100 - pct) * (1 - progress));
  });
}

export function sparklinePointsAttr(points: readonly number[]): string {
  const max = 100;
  const step = VIEW_WIDTH / Math.max(points.length - 1, 1);
  return points
    .map((point, index) => {
      const x = (index * step).toFixed(1);
      const y = (VIEW_HEIGHT - (point / max) * (VIEW_HEIGHT - 4) - 2).toFixed(1);
      return `${x},${y}`;
    })
    .join(" ");
}

export const SPARKLINE_VIEW_WIDTH = VIEW_WIDTH;
export const SPARKLINE_VIEW_HEIGHT = VIEW_HEIGHT;

export function sparklineColor(severity: ChangeSeverity): string {
  return severityStrokeColor(severity);
}
