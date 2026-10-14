"use client";

import { useMemo } from "react";
import { ArrowRight, CircleAlert, CircleCheck, Info, Search, ShieldAlert, TriangleAlert, X } from "lucide-react";
import type { ChangeSeverity, ContractChange, ContractDirection, DiffSummary } from "@/lib/contract/types";
import { Button } from "@/components/ui/button";
import { ChangeTypeBadge, SEVERITY_LABEL, SEVERITY_ORDER, Severity, SEVERITY_ICON_SIZE } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { filterChanges, groupChangesBySeverity, sideValueLabel } from "@/lib/workbench/diff-view";

const SEVERITY_GLYPH = {
  breaking: ShieldAlert,
  warning: TriangleAlert,
  safe: CircleCheck,
  info: Info,
} as const;

export interface DiffResultsProps {
  changes: readonly ContractChange[];
  counts: DiffSummary;
  direction: ContractDirection;
  severities: readonly ChangeSeverity[];
  query: string;
  /** True while a recomputation is in flight; previous results stay visible. */
  recomputing: boolean;
  selectedChangeId: string | null;
  hasSnapshots: boolean;
  onToggleSeverity: (severity: ChangeSeverity) => void;
  onQueryChange: (query: string) => void;
  onResetFilters: () => void;
  onSelectChange: (change: ContractChange) => void;
  onLoadSample: () => void;
  onImport: (side: "before" | "after") => void;
}

function toggleLabel(severity: ChangeSeverity, count: number, active: boolean): string {
  return `${SEVERITY_LABEL[severity]}: ${count} ${count === 1 ? "finding" : "findings"}, filter ${active ? "on" : "off"}`;
}

export function DiffResults({
  changes,
  counts,
  direction,
  severities,
  query,
  recomputing,
  selectedChangeId,
  hasSnapshots,
  onToggleSeverity,
  onQueryChange,
  onResetFilters,
  onSelectChange,
  onLoadSample,
  onImport,
}: DiffResultsProps) {
  const filtered = useMemo(() => filterChanges(changes, { query, severities }), [changes, query, severities]);
  const groups = useMemo(() => groupChangesBySeverity(filtered), [filtered]);
  const filtersActive = query.trim().length > 0 || severities.length > 0;

  return (
    <section className="ca-pane" aria-label="Semantic drift results">
      <header className="ca-pane-heading">
        <div className="ca-pane-heading-top">
          <div>
            <span className="ca-overline">Drift</span>
            <strong>
              {counts.total} {counts.total === 1 ? "finding" : "findings"} · {direction} payload
            </strong>
          </div>
          {recomputing && (
            <span className="ca-recomputing" role="status">
              <Skeleton width={12} height={12} radius="50%" shimmer />
              Recomputing…
            </span>
          )}
        </div>
      </header>

      {/* Summary strip doubles as the severity filter. */}
      <div className="dm-summary" role="group" aria-label="Filter findings by severity">
        {SEVERITY_ORDER.map((severity) => {
          const count = counts[severity];
          const active = severities.includes(severity);
          const Glyph = SEVERITY_GLYPH[severity];
          return (
            <button
              key={severity}
              type="button"
              className={`dm-summary-card is-${severity}`}
              aria-pressed={active}
              aria-label={toggleLabel(severity, count, active)}
              disabled={count === 0}
              onClick={() => onToggleSeverity(severity)}
            >
              <b>{count}</b>
              <span className="dm-summary-label">
                <Glyph size={SEVERITY_ICON_SIZE} aria-hidden="true" />
                {SEVERITY_LABEL[severity]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ca-filter-row">
        <label className="sr-only" htmlFor="ca-drift-filter">Filter findings by path or explanation</label>
        <input
          id="ca-drift-filter"
          className="ui-input"
          type="search"
          value={query}
          placeholder="Filter by path, change, or explanation…"
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onQueryChange(""); } }}
        />
        <Button size="sm" variant="quiet" disabled={!filtersActive} onClick={onResetFilters}>
          <X size={13} aria-hidden="true" /> Reset
        </Button>
      </div>

      <p className="ca-showing" aria-live="polite">
        Showing {filtered.length} of {changes.length} findings
        {severities.length > 0 && severities.length < SEVERITY_ORDER.length && ` · ${severities.map((severity) => SEVERITY_LABEL[severity].toLowerCase()).join(", ")} only`}
      </p>

      {!hasSnapshots ? (
        <div className="ca-pane-body">
          <EmptyState
            icon={<CircleAlert size={18} aria-hidden="true" />}
            overline="No samples yet"
            title="Add two payloads to compare"
            headingLevel={3}
            actions={
              <>
                <Button variant="primary" onClick={() => onImport("before")}>Import baseline</Button>
                <Button onClick={() => onImport("after")}>Import candidate</Button>
                <Button variant="quiet" onClick={onLoadSample}>Load sample pair</Button>
              </>
            }
            note="Sample inference is evidence, not formal schema validation."
          >
            Import a baseline and a candidate, or load the bundled sample pair — a webhook payload migration with removed
            fields, newly required fields, and a restructured nested object.
          </EmptyState>
        </div>
      ) : counts.total === 0 ? (
        <div className="ca-pane-body">
          <EmptyState
            tone="positive"
            icon={<CircleCheck size={18} aria-hidden="true" />}
            overline="No structural drift"
            title="No drift detected between these samples"
            headingLevel={3}
            actions={<Button variant="quiet" onClick={onLoadSample}>Load sample pair</Button>}
            note="Inference is based only on the evidence in the provided samples. A field that is simply absent from every sample is indistinguishable from one that was removed."
          >
            Every path present on both sides has the same inferred kinds and requiredness.
          </EmptyState>
        </div>
      ) : (
        <div className={`ca-change-list ${recomputing ? "ca-stale" : ""}`}>
          {groups.length === 0 && (
            <EmptyState
              icon={<Search size={18} aria-hidden="true" />}
              overline="No matches"
              title="No findings match these filters"
              headingLevel={3}
              actions={<Button variant="quiet" onClick={onResetFilters}>Reset filters</Button>}
            >
              {`No finding matches the current severity and text filters. There ${counts.total === 1 ? "is" : "are"} ${counts.total} finding${counts.total === 1 ? "" : "s"} in total.`}
            </EmptyState>
          )}

          {groups.map((group) => (
            <section key={group.severity} aria-label={`${SEVERITY_LABEL[group.severity]} findings`}>
              <h3 className="ca-group-head">
                <Severity severity={group.severity} />
                <span className="ca-group-count">{group.changes.length}</span>
              </h3>
              {group.changes.map((change) => (
                <article key={change.id} className={`ca-finding ${selectedChangeId === change.id ? "is-selected" : ""}`}>
                  <button
                    type="button"
                    className="ca-finding-select"
                    aria-pressed={selectedChangeId === change.id}
                    onClick={() => onSelectChange(change)}
                  >
                    <span className="ca-finding-head">
                      <Severity severity={change.severity} />
                      <ChangeTypeBadge kind={change.kind} />
                    </span>
                    <code className="ca-finding-path">{change.pointer}</code>
                    <span className="ca-finding-values">
                      <span className="ca-value-cell">
                        <span>Baseline</span>
                        <code>{sideValueLabel(change.before)}</code>
                      </span>
                      <span className="ca-value-arrow" aria-hidden="true"><ArrowRight size={14} /></span>
                      <span className="ca-value-cell">
                        <span>Candidate</span>
                        <code>{sideValueLabel(change.after)}</code>
                      </span>
                    </span>
                    <span className="ca-finding-why">{change.explanation}</span>
                  </button>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}

      <div className="ca-assurance">
        <CircleCheck size={13} aria-hidden="true" />
        <span>
          Inferred from {hasSnapshots ? "the provided samples" : "no samples yet"} — evidence, not proof that a deployed server
          conforms to its specification.
        </span>
      </div>
    </section>
  );
}
