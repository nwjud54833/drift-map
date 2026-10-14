import type { ReactNode } from "react";

export interface EmptyStateProps {
  /** Decorative; the heading carries the meaning. */
  icon?: ReactNode;
  overline?: string;
  title: string;
  /** Heading level so the page keeps a valid outline. */
  headingLevel?: 1 | 2 | 3;
  tone?: "neutral" | "positive";
  children?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
}

export function EmptyState({ icon, overline, title, headingLevel = 2, tone = "neutral", children, actions, note }: EmptyStateProps) {
  const Heading = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <section className="ui-empty" data-tone={tone}>
      {icon && <span className="ui-empty-symbol" aria-hidden="true">{icon}</span>}
      {overline && <span className="ui-overline">{overline}</span>}
      <Heading>{title}</Heading>
      {children && <p>{children}</p>}
      {actions && <div className="ui-empty-actions">{actions}</div>}
      {note && <small className="ui-empty-note">{note}</small>}
    </section>
  );
}
