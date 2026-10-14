import type { ReactNode } from "react";
import { CircleCheck, Info, ShieldAlert, TriangleAlert } from "lucide-react";
import type { ChangeKind, ChangeSeverity, JsonKind } from "@/lib/contract/types";

/* --------------------------------------------------------------------------
 * Severity
 * ------------------------------------------------------------------------ */

export const SEVERITY_ORDER: readonly ChangeSeverity[] = ["breaking", "warning", "safe", "info"] as const;

export const SEVERITY_LABEL: Record<ChangeSeverity, string> = {
  breaking: "Breaking",
  warning: "Warning",
  safe: "Safe",
  info: "Info",
};

/**
 * Four visually distinct glyphs so severity survives without colour:
 * shield-with-bang, triangle, check-in-circle, plain info circle.
 */
const SEVERITY_ICON = {
  breaking: ShieldAlert,
  warning: TriangleAlert,
  safe: CircleCheck,
  info: Info,
} as const;

export const SEVERITY_ICON_SIZE = 12;

export interface SeverityProps {
  severity: ChangeSeverity;
  /** Renders as a summary count instead of a chip. */
  count?: number;
  /** Adds an explicit "Severity: x" prefix for assistive technology. */
  announce?: boolean;
  className?: string;
}

/**
 * The one severity component used everywhere. Always renders a visible text
 * label plus a distinct icon shape, and carries screen-reader text so the
 * severity is announced even when the visible label is abbreviated.
 */
export function Severity({ severity, count, announce = true, className }: SeverityProps) {
  const Icon = SEVERITY_ICON[severity];
  return (
    <span className={["ui-badge", "ui-badge-severity", className ?? ""].filter(Boolean).join(" ")} data-tone={severity}>
      <Icon size={SEVERITY_ICON_SIZE} aria-hidden="true" />
      {announce && <span className="sr-only">Severity: </span>}
      {count === undefined ? SEVERITY_LABEL[severity] : <>{SEVERITY_LABEL[severity]} <b>{count}</b></>}
    </span>
  );
}

/* --------------------------------------------------------------------------
 * Type
 * ------------------------------------------------------------------------ */

export interface TypeBadgeProps {
  kind: JsonKind;
  className?: string;
}

/** JSON kind label in monospace, tinted per kind. The word is always shown. */
export function TypeBadge({ kind, className }: TypeBadgeProps) {
  return <span className={["ui-badge", "ui-badge-type", className ?? ""].filter(Boolean).join(" ")} data-kind={kind}>{kind}</span>;
}

/** Renders a node's kind list, including unions such as `string | null`. */
export function TypeList({ kinds, className }: { kinds: JsonKind[]; className?: string }) {
  if (kinds.length === 0) return <span className={["ui-badge", "ui-badge-type", className ?? ""].filter(Boolean).join(" ")}>unknown</span>;
  return (
    <span className={["ui-type-list", className ?? ""].filter(Boolean).join(" ")}>
      {kinds.map((kind, index) => (
        <span key={kind}>
          {index > 0 && <span className="ui-type-list-sep" aria-hidden="true">|</span>}
          <TypeBadge kind={kind} />
        </span>
      ))}
    </span>
  );
}

/* --------------------------------------------------------------------------
 * Change type
 * ------------------------------------------------------------------------ */

const CHANGE_KIND_LABEL: Record<ChangeKind, string> = {
  "field-added": "Field added",
  "field-removed": "Field removed",
  "type-changed": "Type changed",
  "became-required": "Requiredness changed",
  "became-optional": "Requiredness changed",
  "endpoint-added": "Endpoint added",
  "endpoint-removed": "Endpoint removed",
  "parameter-added": "Parameter added",
  "parameter-removed": "Parameter removed",
  "parameter-changed": "Parameter changed",
  "request-schema-changed": "Request schema changed",
  "response-status-added": "Response status added",
  "response-status-removed": "Response status removed",
  "response-schema-changed": "Response schema changed",
  "property-added": "Property added",
  "property-removed": "Property removed",
  "enum-changed": "Enum changed",
  "nullability-changed": "Nullability changed",
  "format-changed": "Format changed",
  "constraint-changed": "Constraint changed",
  "requiredness-changed": "Requiredness changed",
  "additional-properties-changed": "Additional properties changed",
  "contract-format-changed": "Contract format changed",
};

/** Human label for an engine change kind. Purely presentational. */
export function changeKindLabel(kind: ChangeKind): string {
  return CHANGE_KIND_LABEL[kind] ?? "Contract changed";
}

export function ChangeTypeBadge({ kind, className }: { kind: ChangeKind; className?: string }) {
  return (
    <span className={["ui-badge", "ui-badge-change", className ?? ""].filter(Boolean).join(" ")} data-kind={kind}>
      {changeKindLabel(kind)}
    </span>
  );
}

/* --------------------------------------------------------------------------
 * Requiredness / structure
 * ------------------------------------------------------------------------ */

/** Requiredness always renders as a visible word, never colour alone. */
export function RequiredBadge({ required, known = true }: { required: boolean; known?: boolean }) {
  const state = !known ? "unknown" : required ? "required" : "optional";
  return <span className="ui-badge ui-badge-required" data-state={state}>{state === "unknown" ? "unknown" : state}</span>;
}

export function WildcardBadge() {
  return <span className="ui-badge ui-badge-wildcard" title="Array items are normalised to a wildcard segment">array items</span>;
}

export function Badge({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return <span className={["ui-badge", className ?? ""].filter(Boolean).join(" ")} title={title}>{children}</span>;
}
