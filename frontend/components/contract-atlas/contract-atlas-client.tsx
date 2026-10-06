"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Download, FileJson, FileText, Plus, X } from "lucide-react";
import type { ContractDirection, ContractSnapshot, PayloadSample, Workspace } from "@/lib/contract/types";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { buildMarkdownReport, buildWorkspaceExport } from "@/lib/contract/export";
import { createSnapshot, createWorkspace, deleteWorkspace, loadWorkbench, saveWorkspace } from "@/lib/db/contract-atlas-db";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { ChangeInspector, ChangeRail, EmptyWorkbench, RawJsonDrawer, SnapshotTree } from "./panels";
import { ImportSheet } from "./import-sheet";
import { WorkspaceHeader } from "./workspace-header";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

export default function ContractAtlasClient() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [snapshots, setSnapshots] = useState<ContractSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeId = useWorkspaceUIStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceUIStore((state) => state.setActiveWorkspace);
  const selectedId = useWorkspaceUIStore((state) => state.focusedChangeId);
  const selectChange = useWorkspaceUIStore((state) => state.selectChange);
  const importOpen = useWorkspaceUIStore((state) => state.isImportSheetOpen);
  const setImportOpen = useWorkspaceUIStore((state) => state.setImportOpen);
  const rawOpen = useWorkspaceUIStore((state) => state.isRawJsonDrawerOpen);
  const setRawOpen = useWorkspaceUIStore((state) => state.setRawOpen);
  const paletteOpen = useWorkspaceUIStore((state) => state.isCommandPaletteOpen);
  const setPaletteOpen = useWorkspaceUIStore((state) => state.setPaletteOpen);
  const [importSide, setImportSide] = useState<"before" | "after">("before");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const result = await loadWorkbench();
      setWorkspaces(result.workspaces); setSnapshots(result.snapshots);
      if (!useWorkspaceUIStore.getState().activeWorkspaceId || !result.workspaces.some((workspace) => workspace.id === useWorkspaceUIStore.getState().activeWorkspaceId)) setActiveWorkspace(result.workspaces[0]?.id ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Local browser storage is unavailable."); }
    finally { setLoading(false); }
  }, [setActiveWorkspace]);
  useEffect(() => { void refresh(); }, [refresh]);

  const active = workspaces.find((workspace) => workspace.id === activeId) ?? null;
  const baseline = snapshots.find((snapshot) => snapshot.id === active?.baselineSnapshotId) ?? null;
  const candidate = snapshots.find((snapshot) => snapshot.id === active?.candidateSnapshotId) ?? null;
  const changes = useMemo(() => baseline && candidate && active ? compareContracts(baseline.contract, candidate.contract, active.direction) : [], [baseline, candidate, active]);
  const diff = useMemo(() => baseline && candidate && active ? buildDiff(baseline.id, candidate.id, active.direction, changes) : null, [baseline, candidate, active, changes]);
  const counts = diff?.summary ?? { breaking: 0, warning: 0, safe: 0, info: 0, total: 0 };
  const selected = changes.find((change) => change.id === selectedId) ?? changes.find((change) => change.pointer === useWorkspaceUIStore.getState().activePointer) ?? null;

  const copy = useCallback(async (text: string) => {
    try { await navigator.clipboard.writeText(text); setNotice("Copied"); setTimeout(() => setNotice(""), 1500); }
    catch { setNotice("Clipboard permission unavailable"); setTimeout(() => setNotice(""), 2000); }
  }, []);

  const handleImport = useCallback(async (samples: PayloadSample[], label: string, fileName: string | null, side: "before" | "after") => {
    let workspace = active;
    if (!workspace) { workspace = createWorkspace("Untitled Contract"); await saveWorkspace(workspace); setWorkspaces((current) => [workspace!, ...current]); setActiveWorkspace(workspace.id); }
    const snapshot = await createSnapshot(workspace.id, samples, label, fileName);
    const updated: Workspace = { ...workspace, [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: snapshot.id, updatedAt: new Date().toISOString() };
    await saveWorkspace(updated); setSnapshots((current) => [...current, snapshot]); setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item));
    selectChange(null, null); setImportOpen(false); setNotice(`${side === "before" ? "Baseline" : "Candidate"} imported`); setTimeout(() => setNotice(""), 1800);
  }, [active, setImportOpen, selectChange, setActiveWorkspace]);

  async function newWorkspace() {
    const name = window.prompt("Workspace name", "New contract workspace"); if (!name?.trim()) return;
    const workspace = createWorkspace(name.trim()); await saveWorkspace(workspace); setWorkspaces((current) => [workspace, ...current]); setActiveWorkspace(workspace.id);
  }
  async function renameWorkspace() {
    if (!active) return; const name = window.prompt("Rename workspace", active.name); if (!name?.trim()) return;
    const updated = { ...active, name: name.trim(), updatedAt: new Date().toISOString() }; await saveWorkspace(updated); setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item));
  }
  async function removeWorkspace() {
    if (!active) return;
    if (workspaces.length < 2) { setError("Keep at least one workspace open. Create another workspace before deleting this one."); return; }
    if (!window.confirm(`Delete “${active.name}” and its local snapshots?`)) return;
    await deleteWorkspace(active.id); setSnapshots((current) => current.filter((snapshot) => snapshot.workspaceId !== active.id)); const remaining = workspaces.filter((item) => item.id !== active.id); setWorkspaces(remaining); setActiveWorkspace(remaining[0]?.id ?? null);
  }
  async function swapSnapshots() {
    if (!active) return; const updated = { ...active, baselineSnapshotId: active.candidateSnapshotId, candidateSnapshotId: active.baselineSnapshotId, updatedAt: new Date().toISOString() }; await saveWorkspace(updated); setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item)); selectChange(null, null);
  }
  async function changeDirection(direction: ContractDirection) {
    if (!active) return; const updated = { ...active, direction, updatedAt: new Date().toISOString() }; await saveWorkspace(updated); setWorkspaces((current) => current.map((item) => item.id === updated.id ? updated : item));
  }
  function exportFile(kind: "workspace" | "report") {
    if (!active) return;
    if (kind === "workspace") download("contract-atlas-workspace.json", buildWorkspaceExport(active, baseline, candidate), "application/json");
    else if (baseline && candidate && diff) download("contract-atlas-report.md", buildMarkdownReport(active, baseline, candidate, diff), "text/markdown;charset=utf-8");
    else setError("This workspace does not have both snapshots yet.");
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = !!target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(!useWorkspaceUIStore.getState().isCommandPaletteOpen); }
      else if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") { event.preventDefault(); setImportOpen(true); }
      else if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") { event.preventDefault(); exportFile("report"); }
      else if (event.key === "Escape") { if (useWorkspaceUIStore.getState().isImportSheetOpen) setImportOpen(false); else if (useWorkspaceUIStore.getState().isCommandPaletteOpen) setPaletteOpen(false); else if (useWorkspaceUIStore.getState().isRawJsonDrawerOpen) setRawOpen(false); }
    }
    window.addEventListener("keydown", onKeyDown); return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (loading) return <main className="ca-app"><div className="ca-loading">Loading local workspace…</div></main>;
  return <main className="ca-app"><WorkspaceHeader workspaces={workspaces} active={active} onSelect={setActiveWorkspace} onImport={(side) => { setImportSide(side); openImport(true); }} onNew={() => void newWorkspace()} onRename={() => void renameWorkspace()} onDelete={() => void removeWorkspace()} onSwap={() => void swapSnapshots()} onDirection={(direction) => void changeDirection(direction)} onExport={exportFile} onRaw={() => setRawOpen(!rawOpen)} onPalette={() => setPaletteOpen(true)} />
    {error && <div className="ca-error" role="alert">{error}<button onClick={() => setError(null)}>Dismiss</button></div>}
    {!baseline || !candidate ? <EmptyWorkbench onImport={(side) => { setImportSide(side); openImport(true); }} onDemo={() => { void refresh(); }} /> : <>
      <div className="ca-workspace-title"><div><span className="ca-overline">Local workspace</span><h1>{active?.name}</h1></div><div className="ca-compare-meta"><span>{baseline.samples.length} baseline samples</span><ArrowDownUp size={14}/><span>{candidate.samples.length} candidate samples</span><button onClick={() => void swapSnapshots()}>Swap sides</button></div></div>
      <div className="ca-three-pane"><SnapshotTree title="Baseline" snapshot={baseline} opposite={candidate} changes={changes} side="before"/><ChangeRail changes={changes} counts={counts} direction={active?.direction ?? "event"} onSelect={(change) => selectChange(change.id, change.pointer)}/><SnapshotTree title="Candidate" snapshot={candidate} opposite={baseline} changes={changes} side="after"/></div>
      <ChangeInspector change={selected} direction={active?.direction ?? "event"} onCopy={(text) => void copy(text)}/>
    </>}
    <footer className="ca-footer"><span>Local-only · JSON payloads never leave this browser</span><button onClick={() => setRawOpen(!rawOpen)}><FileJson size={14}/>{rawOpen ? "Hide raw JSON" : "View raw JSON"}</button><button onClick={() => exportFile("workspace")}><Download size={14}/>Backup workspace</button><span className="ca-shortcut-hint">Ctrl/⌘ K commands · Ctrl/⌘ O import · Ctrl/⌘ E export</span></footer>
    {rawOpen && <RawJsonDrawer baseline={baseline} candidate={candidate} onClose={() => setRawOpen(false)}/>}
    {importOpen && <ImportSheet onImport={handleImport} side={importSide}/>}
    {paletteOpen && <div className="ca-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaletteOpen(false); }}><section className="ca-command-modal" role="dialog" aria-modal="true" aria-label="Command palette"><header><strong>Command palette</strong><button className="ca-small-button" onClick={() => setPaletteOpen(false)}><X size={14}/></button></header><button onClick={() => { setImportSide("before"); openImport(true); setPaletteOpen(false); }}>Import baseline</button><button onClick={() => { setImportSide("after"); openImport(true); setPaletteOpen(false); }}>Import candidate</button><button onClick={() => { void newWorkspace(); setPaletteOpen(false); }}><Plus size={14}/>New workspace</button><button onClick={() => { void swapSnapshots(); setPaletteOpen(false); }}>Swap baseline/candidate</button><button onClick={() => { exportFile("report"); setPaletteOpen(false); }}><FileText size={14}/>Export report</button><button onClick={() => { setRawOpen(!rawOpen); setPaletteOpen(false); }}>Toggle raw JSON</button></section></div>}
    {notice && <div className="ca-toast" role="status">{notice}</div>}
  </main>;
}
