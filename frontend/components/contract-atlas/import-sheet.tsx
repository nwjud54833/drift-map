"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ImportArtifact, OpenApiContract, PayloadSample } from "@/lib/contract/types";
import { inferContract } from "@/lib/contract/infer";
import { MAX_IMPORT_BYTES } from "@/lib/contract/parse";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { useDialogFocus } from "./use-dialog-focus";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { JsonInputEditorSkeleton } from "@/components/workbench/json-input-editor";

const JsonInputEditor = dynamic(() => import("@/components/workbench/json-input-editor"), {
  ssr: false,
  loading: () => <JsonInputEditorSkeleton rows={11} />,
});

export interface ImportSheetProps {
  side: "before" | "after";
  saving?: boolean;
  onImport: (artifact: ImportArtifact, label: string, fileName: string | null, side: "before" | "after", rawText: string) => Promise<void>;
}

/**
 * Import dialog. Reuses the same editor component as the workbench input pane,
 * so line numbers, highlighting, drag-and-drop and the 2 MB pre-check behave
 * identically in both places.
 */
export function ImportSheet({ onImport, side, saving = false }: ImportSheetProps) {
  const draft = useWorkspaceUIStore((state) => state.importDraft);
  const setDraft = useWorkspaceUIStore((state) => state.setImportDraft);
  const close = useWorkspaceUIStore((state) => state.setImportOpen);
  const [actionError, setActionError] = useState<string | null>(null);
  const modalRef = useRef<HTMLElement>(null);
  const closeDialog = useCallback(() => close(false), [close]);
  useDialogFocus(modalRef, true, closeDialog);

  const parsed = useMemo(() => parseImportArtifact(draft.rawText), [draft.rawText]);

  /** Cardinality of the parsed document, for the shared workspace draft. */
  const parsedCount = useMemo(() => {
    if (!parsed.ok) return 0;
    if (parsed.artifact.format === "openapi") return parsed.artifact.contract.operations.length;
    return parsed.artifact.samples.length;
  }, [parsed]);

  // Mirror the parse result into the shared draft so the rest of the workbench
  // can see the sample count while the dialog is open.
  useEffect(() => {
    if (parsed.ok) {
      setDraft({ parseError: null, previewSampleCount: parsedCount });
      return;
    }
    setDraft({ parseError: draft.rawText.trim() ? parsed.message : null, previewSampleCount: 0 });
  }, [parsed, parsedCount, draft.rawText, setDraft]);

  const preview = useMemo(() => {
    if (!parsed.ok) return null;
    if (parsed.format === "openapi" && parsed.artifact.format === "openapi") {
      const contract: OpenApiContract = parsed.artifact.contract;
      return { pointers: contract.operations.slice(0, 8).map((operation) => `${operation.method.toUpperCase()} ${operation.path}`), total: contract.operations.length, label: `${contract.operations.length} OpenAPI operations`, title: contract.title };
    }
    if (parsed.artifact.format === "samples") {
      const samples: PayloadSample[] = parsed.artifact.samples;
      const contract = inferContract(samples, "preview");
      return { pointers: contract.nodes.slice(0, 8).map((node) => node.pointer), total: contract.nodes.length, label: `${samples.length} valid JSON sample${samples.length === 1 ? "" : "s"} · ${contract.nodes.length} inferred paths`, title: contract.fingerprint };
    }
    return null;
  }, [parsed]);

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setActionError(null);
    if (file.size > MAX_IMPORT_BYTES) {
      setActionError(`“${file.name}” is ${(file.size / 1024 / 1024).toFixed(2)} MB. Imports are capped at 2 MB.`);
      return;
    }
    try {
      const text = await file.text();
      setDraft({ rawText: text, source: "file", fileName: file.name, versionLabel: file.name.replace(/\.(json|ya?ml)$/i, "") });
    } catch {
      setActionError(`Unable to read “${file.name}”.`);
    }
  }

  async function confirm() {
    if (!parsed.ok) return;
    setActionError(null);
    try {
      await onImport(parsed.artifact, draft.versionLabel || (parsed.format === "openapi" ? "OpenAPI contract" : "JSON samples"), draft.fileName, side, draft.rawText);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Unable to save this snapshot.");
    }
  }

  return (
    <div className="ca-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(false); }}>
      <section
        ref={modalRef}
        tabIndex={-1}
        className="ca-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ca-import-title"
        aria-describedby={actionError ? "ca-import-action-error" : "ca-import-status"}
      >
        <header>
          <div>
            <span className="ca-overline">{side === "before" ? "Baseline" : "Candidate"} snapshot</span>
            <h2 id="ca-import-title">Import a contract</h2>
          </div>
          <Button size="sm" variant="quiet" onClick={() => close(false)}>Close</Button>
        </header>

        <div className="ca-form-label">
          <TextField
            label="Version label"
            hint="Shown in the workbench and in exported reports. Defaults to the file name."
            value={draft.versionLabel}
            placeholder="e.g. 2026-10 candidate"
            onChange={(event) => setDraft({ versionLabel: event.target.value })}
          />
        </div>

        <div className="ca-import-source">
          <label className="ca-file-button">
            Choose JSON, YAML, or YML
            <input
              type="file"
              accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
              onChange={(event) => { void chooseFile(event.target.files?.[0]); event.target.value = ""; }}
            />
          </label>
          <span>or paste a payload or OpenAPI document below</span>
        </div>

        <div className="ca-import-editor">
          <JsonInputEditor
            id="ca-import-source-text"
            label="Source document"
            hint="JSON payload samples (an object, or an array of objects) or an OpenAPI 3.0 document in JSON or YAML. External $ref URLs are rejected."
            value={draft.rawText}
            onChange={(value) => { setActionError(null); setDraft({ rawText: value, source: "paste", fileName: null }); }}
            onFile={(file) => void chooseFile(file)}
            minRows={11}
          />
        </div>

        {actionError && <p id="ca-import-action-error" className="ca-import-error" role="alert">{actionError}</p>}

        {draft.source === "file" && draft.fileName && (
          <p className="ca-import-status"><span className="ca-file-chip">{draft.fileName}</span></p>
        )}

        {preview && (
          <div className="ca-import-preview">
            <span className="ca-overline">{preview.label}</span>
            <p className="ca-import-paths">{preview.pointers.join("\n")}</p>
          </div>
        )}

        <p id="ca-import-status" className="ca-import-status" aria-live="polite">
          {saving
            ? "Saving snapshot…"
            : !parsed.ok
              ? draft.rawText.trim() ? parsed.message : "Paste or choose a document to continue."
              : "Ready to save. Only the structure is used — values are kept as evidence examples."}
        </p>

        <footer>
          <Button variant="quiet" onClick={() => close(false)}>Cancel</Button>
          <Button variant="primary" disabled={!parsed.ok || saving} onClick={() => void confirm()}>
            {saving ? "Saving…" : `Set as ${side === "before" ? "baseline" : "candidate"}`}
          </Button>
        </footer>
      </section>
    </div>
  );
}
