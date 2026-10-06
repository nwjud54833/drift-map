"use client";
import { useEffect, useState } from "react";
import { parsePayloadFile, parsePayloadText } from "@/lib/contract/parse";
import type { PayloadSample } from "@/lib/contract/types";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";

export function ImportSheet({ onImport, side }: { onImport: (samples: PayloadSample[], label: string, fileName: string | null, side: "before" | "after") => Promise<void>; side: "before" | "after" }) {
  const draft = useWorkspaceUIStore((state) => state.importDraft);
  const setDraft = useWorkspaceUIStore((state) => state.setImportDraft);
  const close = useWorkspaceUIStore((state) => state.setImportOpen);
  const [samples, setSamples] = useState<PayloadSample[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { try { const result = parsePayloadText(draft.rawText, { source: draft.source }); setSamples(result); setDraft({ parseError: null, previewSampleCount: result.length }); } catch (error) { setSamples([]); setDraft({ parseError: draft.rawText.trim() ? error instanceof Error ? error.message : "Unable to validate JSON." : null, previewSampleCount: 0 }); } }, [draft.rawText, draft.source, setDraft]);
  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try { const parsed = await parsePayloadFile(file); setSamples(parsed); setDraft({ rawText: await file.text(), source: "file", fileName: file.name, parseError: null, previewSampleCount: parsed.length, versionLabel: file.name.replace(/\.json$/i, "") }); }
    catch (error) { setDraft({ parseError: error instanceof Error ? error.message : "Unable to read file." }); setSamples([]); }
    finally { setBusy(false); }
  }
  return <div className="ca-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(false); }}><section className="ca-import-modal" role="dialog" aria-modal="true" aria-labelledby="ca-import-title"><header><div><span className="ca-overline">{side === "before" ? "Baseline" : "Candidate"} snapshot</span><h2 id="ca-import-title">Import JSON samples</h2></div><button className="ca-small-button" onClick={() => close(false)}>Close</button></header><label className="ca-form-label">Version label<input value={draft.versionLabel} onChange={(event) => setDraft({ versionLabel: event.target.value })} placeholder="e.g. 2026-10 candidate" /></label><div className="ca-import-source"><label className="ca-file-button">Choose .json file<input type="file" accept=".json,application/json" onChange={(event) => void chooseFile(event.target.files?.[0])} /></label><span>or paste payloads</span></div><label className="ca-form-label">JSON payload<textarea value={draft.rawText} onChange={(event) => setDraft({ rawText: event.target.value, source: "paste", fileName: null })} placeholder={'Paste one JSON object or an array of objects…'} rows={11} /></label>{draft.parseError && <p className="ca-import-error" role="alert">{draft.parseError}</p>}<p className="ca-import-status">{busy ? "Reading file…" : samples.length ? `${samples.length} valid sample${samples.length === 1 ? "" : "s"} · ${samples[0].value && Object.keys(samples[0].value).length} top-level paths` : "Import accepts object samples only · 2 MB maximum"}</p><footer><button className="ca-secondary" onClick={() => close(false)}>Cancel</button><button className="ca-primary" disabled={!samples.length || !draft.versionLabel.trim() || busy} onClick={() => { void onImport(samples, draft.versionLabel.trim(), draft.fileName, side); }}>{busy ? "Reading…" : "Analyze and import"}</button></footer></section></div>;
}
