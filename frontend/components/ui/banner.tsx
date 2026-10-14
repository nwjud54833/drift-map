import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert } from "lucide-react";

export type BannerTone = "error" | "warning" | "info" | "neutral";

const TONE_ICON = { error: CircleAlert, warning: TriangleAlert, info: Info } as const;

export interface BannerProps {
  tone?: BannerTone;
  title?: string;
  children: ReactNode;
  /** e.g. a "Retry" button. */
  actions?: ReactNode;
  className?: string;
  id?: string;
}

/**
 * Dismissible inline message. Messages shown here are user-facing strings that
 * have already been reduced to plain language by the caller — never raw server
 * payloads or stack traces.
 */
export function Banner({ tone = "neutral", title, children, actions, className, id }: BannerProps) {
  const Icon = tone === "neutral" ? null : TONE_ICON[tone];
  return (
    <div className={["ui-banner", className ?? ""].filter(Boolean).join(" ")} data-tone={tone} id={id}>
      {Icon && <Icon className="ui-banner-icon" size={16} aria-hidden="true" />}
      <div className="ui-banner-body">
        {title && <strong>{title}</strong>}
        {children}
      </div>
      {actions && <div className="ui-banner-actions">{actions}</div>}
    </div>
  );
}
