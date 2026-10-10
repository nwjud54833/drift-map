import type { ReactNode } from "react";
import { Boxes } from "lucide-react";

export const GITHUB_URL = "https://github.com/nwjud54833/drift-map";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="landing-logo">
      <span className="landing-logo-mark" aria-hidden="true"><Boxes size={15} strokeWidth={1.8} /></span>
      {!compact && <span>DriftMap</span>}
    </span>
  );
}

export function SectionHead({ overline, title, children, align = "center" }: { overline: string; title: ReactNode; children?: ReactNode; align?: "center" | "left" }) {
  return <div className={`section-head ${align === "left" ? "section-head-left" : ""}`}><p className="section-overline">{overline}</p><h2>{title}</h2>{children && <p className="section-copy">{children}</p>}</div>;
}

export type Severity = "breaking" | "warning" | "safe" | "info";
export function SeverityChip({ severity, label }: { severity: Severity; label: string }) {
  return <span className={`landing-severity severity-${severity}`}><i aria-hidden="true" />{label}</span>;
}
