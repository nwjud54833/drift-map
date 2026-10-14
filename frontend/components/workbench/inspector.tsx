"use client";

import { useMemo, useState } from "react";
import { CircleHelp, Copy, Download, X } from "lucide-react";
import type { ContractChange, ContractDirection, ContractSnapshot, Workspace } from "@/lib/contract/types";
import { compatibilityRule } from "@/lib/contract/compatibility";
import { buildMarkdownReport, buildWorkspaceExport } from "@/lib/contract/export";
import { pointerLabel } from "@/lib/contract/normalize";
import { Button } from "@/components/ui/button";
import { ChangeTypeBadge, RequiredBadge, Severity, TypeList } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";

/* --------------------------------------------------------------------------
 * Changed types
 * ------------------------------------------------------------------------ */

/** Kinds on each side of a change, with a visible arrow rather than colour. */
function ChangedTypes({ change }: { change: ContractChange }) {
  return (
    <div className="ca-before-after">
      <span className="ca-before-after-side">
        <span className="ca-overline">Baseline</span>
        {change.before ? <TypeList kinds={change.before.kinds} /> : <span className="ui-badge ui-badge-required" data-state="unknown">missing</span>}
      </span>
      <span className="ca-before-after-arrow" aria-hidden="true">→</span>
      <span className="ca-before-after-side">
        <span className="ca-overline">Candidate</span>
        {change.after ? <TypeList kinds={change.after.kinds} /> : <span className="ui-badge ui-badge-required" data-state="unknown">missing</span>}
      </span>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Inspector
 * ------------------------------------------------------------------------ */

export interface ChangeInspectorProps {
  change: ContractChange | null;
  direction: ContractDirection;
  onCopy: (text: string, label: string) => void;
}

export function ChangeInspector({ change, direction, onCopy }: ChangeInspectorProps) {
  if (!change) {
    return (
      <section className="ca-inspector" aria-label="Change inspector">
        <div className="ca-inspector-title"><span className="ca-overline">Inspector</span></div>
        <div className="ca-inspector-empty">
          <span className="ca-empty-symbol" aria-hidden="true"><CircleHelp size={16} /></span>
          <div>
            <strong>No change selected</strong>
            <p className="ca-muted">
              Select a finding from the drift list, or a path from either contract tree, to see its evidence and the
              compatibility rule behind its severity.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const sampleBased = ["field-added", "field-removed", "type-changed", "became-required", "became-optional"].includes(change.kind);
  const evidence = (label: string, node: ContractChange["before"]) => node && node.totalSamples > 0
    ? `${label}: present in ${node.presentInSamples} of ${node.totalSamples} samples · ${node.required ? "required" : "optional"}`
    : null;

  return (
    <section className="ca-inspector" aria-label="Change inspector">
      <div className="ca-inspector-title">
        <span className="ca-overline">Inspector</span>
        <span className="ca-inspector-tags">
          <Severity severity={change.severity} />
          <ChangeTypeBadge kind={change.kind} />
        </span>
      </div>

      <div className="ca-inspector-grid">
        <div>
          <span className="ca-overline">JSON pointer path</span>
          <code className="ca-inspector-path">{change.pointer}</code>
          <span className="ca-sample-count">Label: {pointerLabel(change.pointer) || "$"}</span>
          <Button size="sm" variant="quiet" onClick={() => onCopy(change.pointer, "Path copied")}>
            <Copy size={13} aria-hidden="true" /> Copy path
          </Button>
        </div>

        <div>
          <span className="ca-overline">Change</span>
          <strong>{change.title}</strong>
          <ChangedTypes change={change} />
          {change.before && (
            <span className="ca-sample-count">
              Baseline requiredness: <RequiredBadge required={change.before.required} known={change.before.totalSamples > 0} />
              {change.before.totalSamples > 0 && ` · ${change.before.presentInSamples}/${change.before.totalSamples} samples`}
            </span>
          )}
          {change.after && (
            <span className="ca-sample-count">
              Candidate requiredness: <RequiredBadge required={change.after.required} known={change.after.totalSamples > 0} />
              {change.after.totalSamples > 0 && ` · ${change.after.presentInSamples}/${change.after.totalSamples} samples`}
            </span>
          )}
          {evidence("Baseline", change.before)}
          {evidence("Candidate", change.after)}
          {change.before && change.before.examples.length > 0 && (
            <p className="ca-examples">Baseline examples: {change.before.examples.map((example) => JSON.stringify(example)).join(", ")}</p>
          )}
          {change.after && change.after.examples.length > 0 && (
            <p className="ca-examples">Candidate examples: {change.after.examples.map((example) => JSON.stringify(example)).join(", ")}</p>
          )}
        </div>

        <div>
          <span className="ca-overline">Why</span>
          <p>{change.explanation}</p>
          <p className="ca-muted">
            {sampleBased
              ? "Sample inference is evidence, not proof of the producer's formal schema."
              : "This result follows the declared OpenAPI contract; it does not prove that the deployed implementation conforms."}
          </p>
          <div className="ca-inspector-rule">
            <strong>Compatibility rule.</strong> {compatibilityRule(change.kind, direction, change.before?.required ?? false)}
          </div>
          <Button
            size="sm"
            variant="quiet"
            onClick={() => onCopy(`${change.severity.toUpperCase()} ${change.pointer} — ${change.title}. ${change.explanation}`, "Summary copied")}
          >
            <Copy size={13} aria-hidden="true" /> Copy summary
          </Button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------------------------------------------------
 * Export
 * ------------------------------------------------------------------------ */

export interface ExportPanelProps {
  workspace: Workspace | null;
  baseline: ContractSnapshot | null;
  candidate: ContractSnapshot | null;
  diff: import("@/lib/contract/types").ContractDiff | null;
  pending: boolean;
  onCopy: (text: string, label: string) => void;
  onDownload: (filename: string, content: string, type: string, label: string) => void;
  onError: (message: string) => void;
}

/**
 * Export panel. Both actions use the engine's existing export functions and
 * never alter the produced format; Copy and Download are offered where the
 * output is text.
 */
export function ExportPanel({ workspace, baseline, candidate, diff, pending, onCopy, onDownload, onError }: ExportPanelProps) {
  const [busy, setBusy] = useState<"report" | "workspace" | null>(null);

  const report = useMemo(
    () => (workspace && baseline && candidate && diff ? buildMarkdownReport(workspace, baseline, candidate, diff) : null),
    [workspace, baseline, candidate, diff],
  );
  const workspaceExport = useMemo(
    () => (workspace ? buildWorkspaceExport(workspace, baseline, candidate) : null),
    [workspace, baseline, candidate],
  );

  function build(kind: "report" | "workspace"): string | null {
    if (kind === "report") {
      if (!report) { onError("This workspace does not have both snapshots yet, so there is no report to export."); return null; }
      return report;
    }
    if (!workspaceExport) { onError("There is no active workspace to back up."); return null; }
    return workspaceExport;
  }

  function handleDownload(kind: "report" | "workspace") {
    const content = build(kind);
    if (content === null) return;
    setBusy(kind);
    try {
      if (kind === "report") onDownload("driftmap-report.md", content, "text/markdown;charset=utf-8", "Markdown report downloaded");
      else onDownload("driftmap-workspace.json", content, "application/json", "Workspace backup downloaded");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="ca-export">
      <div className="ca-export-row">
        <div>
          <strong>Markdown drift report</strong>
          <p>A human-readable summary of every finding with its path, before and after evidence, and the reason for its severity.</p>
        </div>
        <div className="ca-export-actions">
          <Button
            size="sm"
            disabled={pending || !report}
            onClick={() => { const content = build("report"); if (content !== null) onCopy(content, "Report copied to clipboard"); }}
          >
            <Copy size={13} aria-hidden="true" /> Copy
          </Button>
          <Button size="sm" variant="primary" disabled={pending || busy === "report" || !report} onClick={() => handleDownload("report")}>
            <Download size={13} aria-hidden="true" /> {busy === "report" ? "Preparing…" : "Download .md"}
          </Button>
        </div>
      </div>

      <div className="ca-export-row">
        <div>
          <strong>Workspace backup</strong>
          <p>The active workspace with both snapshots as JSON, in the engine&apos;s existing export format.</p>
        </div>
        <div className="ca-export-actions">
          <Button
            size="sm"
            disabled={pending || !workspaceExport}
            onClick={() => { const content = build("workspace"); if (content !== null) onCopy(content, "Workspace JSON copied to clipboard"); }}
          >
            <Copy size={13} aria-hidden="true" /> Copy
          </Button>
          <Button size="sm" disabled={pending || busy === "workspace" || !workspaceExport} onClick={() => handleDownload("workspace")}>
            <Download size={13} aria-hidden="true" /> {busy === "workspace" ? "Preparing…" : "Download .json"}
          </Button>
        </div>
      </div>

      <p className="ca-export-note">
        Exports are produced locally from the engine&apos;s existing output. Local-mode exports are never uploaded.
      </p>
    </div>
  );
}

/* --------------------------------------------------------------------------
 * Raw JSON drawer
 * ------------------------------------------------------------------------ */

export function RawJsonDrawer({
  baseline,
  candidate,
  onClose,
}: {
  baseline: ContractSnapshot | null;
  candidate: ContractSnapshot | null;
  onClose: () => void;
}) {
  const [side, setSide] = useState<"before" | "after">("before");
  const [sampleIndex, setSampleIndex] = useState(0);
  const snapshot = side === "before" ? baseline : candidate;
  const openApiDocument = snapshot && "kind" in snapshot.contract && snapshot.contract.kind === "openapi" ? snapshot.contract.document : null;
  const activeSample = snapshot?.samples.length ? snapshot.samples[Math.min(sampleIndex, snapshot.samples.length - 1)] : null;

  return (
    <section className="ca-raw-drawer" aria-label="Raw contract source">
      <header>
        <strong>Raw contract source</strong>
        <div className="ca-raw-actions">
          <Button size="sm" variant="quiet" aria-pressed={side === "before"} onClick={() => { setSide("before"); setSampleIndex(0); }}>
            Baseline
          </Button>
          <Button size="sm" variant="quiet" aria-pressed={side === "after"} onClick={() => { setSide("after"); setSampleIndex(0); }}>
            Candidate
          </Button>
          <IconButton label="Close raw JSON drawer" onClick={onClose}>
            <X size={14} aria-hidden="true" />
          </IconButton>
        </div>
      </header>

      {openApiDocument ? (
        <pre className="scroll-area">{JSON.stringify(openApiDocument, null, 2)}</pre>
      ) : snapshot?.samples.length ? (
        <>
          <div className="ca-sample-tabs" role="tablist" aria-label="Payload samples">
            {snapshot.samples.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={sampleIndex === index}
                className={sampleIndex === index ? "active" : ""}
                onClick={() => setSampleIndex(index)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <pre className="scroll-area">{JSON.stringify(activeSample?.value ?? {}, null, 2)}</pre>
        </>
      ) : (
        <p className="ca-muted" style={{ padding: 12 }}>No source document or payload sample is available on this side.</p>
      )}
    </section>
  );
}
