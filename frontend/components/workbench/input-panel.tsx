"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { ContractSnapshot, ImportArtifact } from "@/lib/contract/types";
import type { WorkbenchMode } from "./app-shell";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { JsonInputEditorSkeleton } from "./json-input-editor";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { inferContract } from "@/lib/contract/infer";

/**
 * The editor is loaded on demand so the landing page never pays for it. The
 * skeleton reserves the editor's final height.
 */
const JsonInputEditor = dynamic(() => import("./json-input-editor"), {
  ssr: false,
  loading: () => <JsonInputEditorSkeleton />,
});

export interface InputPanelProps {
  side: "before" | "after";
  draft: string;
  mode: WorkbenchMode;
  baseline: ContractSnapshot | null;
  candidate: ContractSnapshot | null;
  pending: boolean;
  /** Fingerprint of the inferred contract for the current draft, if valid. */
  onSideChange: (side: "before" | "after") => void;
  onDraftChange: (value: string) => void;
  onApply: (artifact: ImportArtifact) => void;
  onFile: (file: File) => void;
  onLoadSample: () => void;
}

const PLACEHOLDER = `[
  { "id": "ORD-1001", "status": "shipped", "total_cents": 12900 },
  { "id": "ORD-1002", "status": "shipped", "total_cents": 7500 }
]`;

/**
 * Input pane: the JSON editor plus a live structural preview, so a reviewer can
 * see what the engine inferred before committing the snapshot.
 */
export function InputPanel({
  side,
  draft,
  mode,
  baseline,
  candidate,
  pending,
  onSideChange,
  onDraftChange,
  onApply,
  onFile,
  onLoadSample,
}: InputPanelProps) {
  const other = side === "before" ? candidate : baseline;

  const preview = useMemo(() => {
    const result = parseImportArtifact(draft);
    if (!result.ok) return { state: "invalid" as const, message: result.message };
    if (result.format === "openapi") {
      const paths = result.artifact.format === "openapi" ? result.artifact.contract.operations.slice(0, 6).map((operation) => `${operation.method.toUpperCase()} ${operation.path}`) : [];
      const total = result.artifact.format === "openapi" ? result.artifact.contract.operations.length : 0;
      return { state: "openapi" as const, paths, total };
    }
    const samples = result.artifact.format === "samples" ? result.artifact.samples : [];
    const contract = inferContract(samples, "preview");
    // The engine already emits normalised pointers, including `/*` wildcards.
    const paths = contract.nodes.slice(0, 6).map((node) => node.pointer);
    return { state: "samples" as const, paths, total: samples.length, nodeCount: contract.nodes.length };
  }, [draft]);

  const previewId = `ca-input-preview-${side}`;

  return (
    <section className="ca-pane" aria-label={`${side === "before" ? "Baseline" : "Candidate"} input`}>
      <header className="ca-pane-heading">
        <div className="ca-pane-heading-top">
          <div>
            <span className="ca-overline">Inputs</span>
            <strong>{side === "before" ? "Baseline payload" : "Candidate payload"}</strong>
          </div>
          <Segmented
            label="Side to edit"
            value={side}
            onChange={(next) => onSideChange(next)}
            options={[
              { value: "before" as const, label: baseline ? "Baseline ✓" : "Baseline" },
              { value: "after" as const, label: candidate ? "Candidate ✓" : "Candidate" },
            ]}
          />
        </div>
      </header>

      <div className="ca-pane-body ca-input-body">
        <JsonInputEditor
          id={`ca-json-editor-${side}`}
          label={`${side === "before" ? "Baseline" : "Candidate"} JSON or OpenAPI document`}
          hint="Paste JSON payload samples (an object or an array of objects), or an OpenAPI 3.0 document in JSON or YAML. Drag a file onto the editor, or use Choose file. Imports are capped at 2 MB."
          placeholder={PLACEHOLDER}
          value={draft}
          onChange={onDraftChange}
          onFile={onFile}
          sampleAction={{ label: "Load sample", onSelect: onLoadSample }}
        />

        <div className="ca-input-preview" id={previewId} aria-live="polite">
          {preview.state === "invalid" ? (
            <p className="ca-input-preview-invalid">
              <strong>Not ready to import.</strong> {preview.message}
            </p>
          ) : (
            <>
              <span className="ca-overline">
                {preview.state === "openapi"
                  ? `${preview.total} OpenAPI operations detected`
                  : `${preview.total} sample${preview.total === 1 ? "" : "s"} · ${preview.nodeCount} inferred paths`}
              </span>
              <p className="ca-import-paths">{preview.paths.join("\n")}</p>
            </>
          )}
        </div>

        <div className="ca-input-actions">
          <Button
            variant="primary"
            disabled={pending || preview.state === "invalid"}
            onClick={() => {
              const result = parseImportArtifact(draft);
              if (!result.ok) return;
              onApply(result.artifact);
            }}
          >
            {pending ? "Saving…" : `Set as ${side === "before" ? "baseline" : "candidate"}`}
          </Button>
          <Button variant="quiet" onClick={onLoadSample}>Load sample for this side</Button>
        </div>

        <p className="ca-input-note">
          {mode === "cloud"
            ? "Saved to your cloud workspace. Local browser data is not uploaded or merged."
            : "Saved to this browser only (IndexedDB). Nothing is uploaded, and there is no automatic sync to cloud."}
          {other === null && " The other side is still empty, so no comparison is shown yet."}
        </p>
      </div>
    </section>
  );
}
