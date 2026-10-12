"use client";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDialogFocus } from "./use-dialog-focus";
import { MAX_IMPORT_BYTES, parsePayloadText } from "@/lib/contract/parse";
import { parseOpenApiText } from "@/lib/contract/openapi";
import { inferContract } from "@/lib/contract/infer";
import type { ImportArtifact, PayloadSample } from "@/lib/contract/types";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

function looksLikeOpenApi(text: string): boolean {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { const value = JSON.parse(text) as Record<string, unknown>; return typeof value === "object" && value !== null && ("openapi" in value || "swagger" in value || "asyncapi" in value); }
    catch { return false; }
  }
  return /^\s*(?:openapi|swagger|asyncapi)\s*:/m.test(text);
}

function parseImport(text: string, yamlFile = false): ImportArtifact {
  if (yamlFile || looksLikeOpenApi(text)) return { format: "openapi", contract: parseOpenApiText(text) };
  return { format: "samples", samples: parsePayloadText(text) };
}

export function ImportSheet({ onImport, side, saving = false }: { onImport: (artifact: ImportArtifact, label: string, fileName: string | null, side: "before" | "after", rawText: string) => Promise<void>; side: "before" | "after"; saving?: boolean }) {
  const draft = useWorkspaceUIStore((state) => state.importDraft);
  const setDraft = useWorkspaceUIStore((state) => state.setImportDraft);
  const close = useWorkspaceUIStore((state) => state.setImportOpen);
  const [samples, setSamples] = useState<PayloadSample[]>([]);
  const [openApi, setOpenApi] = useState<import("@/lib/contract/types").OpenApiContract | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const modalRef = useRef<HTMLElement>(null);
  const closeDialog = useCallback(() => close(false), [close]);
  useDialogFocus(modalRef, true, closeDialog);
  const preview = useMemo(() => {
    if (openApi) return { pointers: openApi.operations.slice(0, 8).map((operation) => `${operation.method.toUpperCase()} ${operation.path}`), total: openApi.operations.length, label: "OpenAPI operations" };
    if (!samples.length) return null;
    const contract = inferContract(samples, "preview");
    return { pointers: contract.nodes.slice(0, 8).map((node) => node.pointer), total: contract.nodes.length, label: "Inferred paths" };
  }, [openApi, samples]);
  useEffect(() => {
    try {
      const result = parseImport(draft.rawText);
      if (result.format === "openapi") { setOpenApi(result.contract); setSamples([]); setDraft({ parseError: null, previewSampleCount: result.contract.operations.length }); }
      else { setOpenApi(null); setSamples(result.samples); setDraft({ parseError: null, previewSampleCount: result.samples.length }); }
    } catch (error) { setOpenApi(null); setSamples([]); setDraft({ parseError: draft.rawText.trim() ? error instanceof Error ? error.message : "Unable to validate import." : null, previewSampleCount: 0 }); }
  }, [draft.rawText, draft.source, setDraft]);
  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setActionError(null);
    try {
      if (file.size > MAX_IMPORT_BYTES) throw new Error("File too large. Imports are limited to 2 MB.");
      const text = await file.text();
      const artifact = parseImport(text, /\.ya?ml$/i.test(file.name));
      if (artifact.format === "openapi") { setOpenApi(artifact.contract); setSamples([]); setDraft({ rawText: text, source: "file", fileName: file.name, parseError: null, previewSampleCount: artifact.contract.operations.length, versionLabel: file.name.replace(/\.(json|ya?ml)$/i, "") }); }
      else { setOpenApi(null); setSamples(artifact.samples); setDraft({ rawText: text, source: "file", fileName: file.name, parseError: null, previewSampleCount: artifact.samples.length, versionLabel: file.name.replace(/\.json$/i, "") }); }
    }
    catch (error) { setDraft({ parseError: error instanceof Error ? error.message : "Unable to read file." }); setOpenApi(null); setSamples([]); }
    finally { setBusy(false); }
  }
  const artifact: ImportArtifact | null = openApi ? { format: "openapi", contract: openApi } : samples.length ? { format: "samples", samples } : null;
  return <div className="ca-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(false); }}><section ref={modalRef} tabIndex={-1} className="ca-import-modal" role="dialog" aria-modal="true" aria-labelledby="ca-import-title" aria-describedby={draft.parseError ? "ca-import-error" : actionError ? "ca-import-action-error" : "ca-import-guidance"}><header><div><span className="ca-overline">{side === "before" ? "Baseline" : "Candidate"} snapshot</span><h2 id="ca-import-title">Import contract</h2></div><button className="ca-small-button" onClick={() => close(false)}>Close</button></header><label className="ca-form-label">Version label<input value={draft.versionLabel} onChange={(event) => setDraft({ versionLabel: event.target.value })} placeholder="e.g. 2026-10 candidate · optional" /></label><div className="ca-import-source"><label className="ca-file-button">Choose JSON, YAML, or YML<input type="file" accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label><span>or paste payloads / OpenAPI</span></div><label className="ca-form-label">JSON/YAML<textarea value={draft.rawText} onChange={(event) => { setActionError(null); setDraft({ rawText: event.target.value, source: "paste", fileName: null }); }} placeholder={'Paste JSON samples or an OpenAPI 3.0 JSON/YAML document…'} rows={11} /></label>{draft.parseError && <p id="ca-import-error" className="ca-import-error" role="alert">{draft.parseError}</p>}{actionError && <p id="ca-import-action-error" className="ca-import-error" role="alert">{actionError}</p>}{draft.source === "file" && draft.fileName && <p className="ca-import-status"><span className="ca-file-chip">{draft.fileName}</span></p>}<p id="ca-import-guidance" className="ca-import-status">{busy ? "Reading file…" : openApi ? `${openApi.operations.length} OpenAPI operations parsed` : samples.length ? `${samples.length} valid JSON sample${samples.length === 1 ? "" : "s"} parsed` : "JSON samples and OpenAPI 3.0 · 2 MB maximum"}</p>{preview && <div className="ca-import-preview"><span className="ca-overline">{preview.label} preview</span><p className="ca-import-paths" style={{ whiteSpace: "pre-line" }}>{preview.pointers.join("\n")}{preview.total > preview.pointers.length ? `\n… ${preview.total - preview.pointers.length} more` : ""}</p></div>}<footer><button className="ca-secondary" onClick={() => close(false)}>Cancel</button><button className="ca-primary" disabled={!artifact || busy || saving} aria-busy={busy || saving} onClick={async () => { const fallbackLabel = `${side === "before" ? "Baseline" : "Candidate"} ${new Date().toISOString().slice(0, 10)}`; if (!artifact) return; setActionError(null); try { await onImport(artifact, draft.versionLabel.trim() || fallbackLabel, draft.fileName, side, draft.rawText); } catch (error) { setActionError(error instanceof Error ? error.message : "Unable to save this import."); } }}>{saving ? "Saving…" : busy ? "Reading…" : "Analyze and import"}</button></footer></section></div>;
}
