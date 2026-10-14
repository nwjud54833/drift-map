import type { CSSProperties } from "react";

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  /** Animated shimmer used for indeterminate loading; static for placeholders. */
  shimmer?: boolean;
  radius?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * Layout-matched placeholder. Callers size it to the final content so async
 * states do not shift the page.
 */
export function Skeleton({ width = "100%", height = 12, shimmer = false, radius, className, style }: SkeletonProps) {
  return (
    <span
      className={["ui-skeleton", shimmer ? "ui-skeleton-shimmer" : "", className ?? ""].filter(Boolean).join(" ")}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** A few stacked text lines, sized to represent realistic content. */
export function SkeletonLines({ lines = 3, gap = 8, height = 12 }: { lines?: number; gap?: number; height?: number }) {
  const widths = ["96%", "88%", "72%", "92%", "64%"];
  return (
    <span style={{ display: "grid", gap }} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton key={index} width={widths[index % widths.length]} height={height} />
      ))}
    </span>
  );
}
