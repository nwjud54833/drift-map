import type { ReactNode } from "react";

export type StatusMode = "local" | "cloud" | "neutral";

export interface StatusPillProps {
  mode?: StatusMode;
  children: ReactNode;
  /** Muted styling for secondary detail such as "not synced to cloud". */
  muted?: boolean;
  className?: string;
}

/**
 * Always-visible statement of the active storage mode. The dot is decorative —
 * the text alone carries the meaning, and the colour is never load-bearing.
 */
export function StatusPill({ mode = "neutral", children, muted = false, className }: StatusPillProps) {
  return (
    <span
      className={["ui-status", muted ? "ui-status-muted" : "", className ?? ""].filter(Boolean).join(" ")}
      data-mode={mode === "neutral" ? undefined : mode}
    >
      {!muted && <span className="ui-status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
