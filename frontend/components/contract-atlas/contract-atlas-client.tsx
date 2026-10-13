"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDownUp, Download, FileJson, FilePlus2, FileText, FolderPlus, Pencil, Repeat, Search, Upload } from "lucide-react";
import type { Command } from "./command-palette";
import { CommandPalette } from "./command-palette";
import type { ContractDirection, ContractSnapshot, ImportArtifact, Workspace } from "@/lib/contract/types";
import { collectUnchangedNodes, buildDiff, compareContracts } from "@/lib/contract/compare";
import { OpenApiComparisonError } from "@/lib/contract/openapi";
import { buildMarkdownReport, buildWorkspaceExport } from "@/lib/contract/export";
import { createCloudOpenApiSnapshot, createCloudSnapshot, createCloudWorkspace, deleteCloudSnapshot, deleteCloudWorkspace, loadCloudWorkbench, loadOrCreateCloudDiff, renameCloudSnapshot, renameCloudWorkspace, updateCloudWorkspace } from "@/lib/db/cloud-api";
import { createOpenApiSnapshot, createSnapshot, createWorkspace, deleteSnapshot, deleteWorkspace, getDemoSamples, importDemoFixture, loadWorkbench, renameSnapshot, saveWorkspace } from "@/lib/db/contract-atlas-db";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { useSession } from "next-auth/react";
import { CloudAccessPrompt } from "./cloud-access-prompt";
import { ChangeInspector, ChangeRail, EmptyWorkbench, RawJsonDrawer, SnapshotTree } from "./panels";
import { ImportSheet } from "./import-sheet";
import { WorkspaceHeader } from "@/components/driftmap/shell";
import { browserPreferenceStorage, readActiveWorkspaceId, readWorkbenchMode, writeActiveWorkspaceId, writeWorkbenchMode } from "@/lib/workbench/preferences";

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function snapshotScope(snapshot: ContractSnapshot): string {
  return "kind" in snapshot.contract && snapshot.contract.kind === "openapi"
    ? `${snapshot.contract.operations.length} operations`
    : `${snapshot.samples.length} samples`;
}

export default function ContractAtlasClient() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [snapshots, setSnapshots] = useState<ContractSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [importSide, setImportSide] = useState<"before" | "after">("before");
  const [mode, setMode] = useState<"local" | "cloud">("local");
  const [modePreferenceReady, setModePreferenceReady] = useState(false);
  const [cloudPromptOpen, setCloudPromptOpen] = useState(false);
  const [savedDiff, setSavedDiff] = useState<{ id: string; workspaceId: string; baselineSnapshotId: string; candidateSnapshotId: string; direction: ContractDirection; summary: { breaking: number; warning: number; safe: number; info: number; total: number }; changes: import("@/lib/contract/types").ContractChange[] } | null>(null);
  const [savedDiffStatus, setSavedDiffStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const { data: session, status: sessionStatus } = useSession();
  const restoredMode = useRef(false);
  const loadedMode = useRef<"local" | "cloud" | null>(null);

  const activeId = useWorkspaceUIStore((state) => state.activeWorkspaceId);
  const setActiveWorkspace = useWorkspaceUIStore((state) => state.setActiveWorkspace);
  const selectedId = useWorkspaceUIStore((state) => state.focusedChangeId);
  const activePointer = useWorkspaceUIStore((state) => state.activePointer);
  const selectChange = useWorkspaceUIStore((state) => state.selectChange);
  const importOpen = useWorkspaceUIStore((state) => state.isImportSheetOpen);
  const setImportOpen = useWorkspaceUIStore((state) => state.setImportOpen);
  const rawOpen = useWorkspaceUIStore((state) => state.isRawJsonDrawerOpen);
  const setRawOpen = useWorkspaceUIStore((state) => state.setRawOpen);
  const paletteOpen = useWorkspaceUIStore((state) => state.isCommandPaletteOpen);
  const setPaletteOpen = useWorkspaceUIStore((state) => state.setPaletteOpen);

  const openImport = useCallback((side: "before" | "after") => { setImportSide(side); setImportOpen(true); }, [setImportOpen]);
  const filterToSeverity = useCallback((severity: "breaking" | "warning" | "safe" | "info") => {
    const { filters, toggleSeverity } = useWorkspaceUIStore.getState();
    if (filters.severities.length === 1 && filters.severities[0] === severity) useWorkspaceUIStore.getState().resetFilters();
    else { useWorkspaceUIStore.setState({ filters: { ...filters, severities: [severity] } }); }
    void toggleSeverity;
  }, []);
  const flash = useCallback((message: string, milliseconds = 1800) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), milliseconds);
  }, []);
  const chooseMode = useCallback((nextMode: "local" | "cloud") => {
    if (nextMode === "cloud" && sessionStatus === "loading") {
      flash("Checking sign-in status…", 1400);
      return;
    }
    if (nextMode === "cloud" && sessionStatus !== "authenticated") {
      writeWorkbenchMode(browserPreferenceStorage(), "cloud");
      setCloudPromptOpen(true);
      return;
    }
    setCloudPromptOpen(false);
    writeWorkbenchMode(browserPreferenceStorage(), nextMode);
    setMode(nextMode);
  }, [flash, sessionStatus]);

  const selectWorkspace = useCallback((workspaceId: string | null) => {
    setActiveWorkspace(workspaceId);
    writeActiveWorkspaceId(browserPreferenceStorage(), mode, workspaceId);
  }, [mode, setActiveWorkspace]);

  useEffect(() => {
    if (sessionStatus === "loading" || restoredMode.current) return;
    restoredMode.current = true;
    const preferredMode = readWorkbenchMode(browserPreferenceStorage());
    if (preferredMode === "cloud" && sessionStatus === "authenticated") setMode("cloud");
    setModePreferenceReady(true);
  }, [sessionStatus]);

  const refresh = useCallback(async () => {
    if (!modePreferenceReady) return;
    try {
      setLoading(true);
      setError(null);
      if (loadedMode.current !== mode) {
        setWorkspaces([]);
        setSnapshots([]);
        setActiveWorkspace(null);
      }
      const result = mode === "cloud" ? await loadCloudWorkbench() : await loadWorkbench();
      loadedMode.current = mode;
      setWorkspaces(result.workspaces);
      setSnapshots(result.snapshots);
      const preferredWorkspaceId = readActiveWorkspaceId(browserPreferenceStorage(), mode);
      const selectedWorkspace = result.workspaces.find((workspace) => workspace.id === preferredWorkspaceId) ?? result.workspaces[0] ?? null;
      selectWorkspace(selectedWorkspace?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Local browser storage is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [mode, modePreferenceReady, selectWorkspace, setActiveWorkspace]);

  useEffect(() => { void refresh(); }, [refresh]);

  const active = workspaces.find((workspace) => workspace.id === activeId) ?? null;
  const baseline = snapshots.find((snapshot) => snapshot.id === active?.baselineSnapshotId) ?? null;
  const candidate = snapshots.find((snapshot) => snapshot.id === active?.candidateSnapshotId) ?? null;
  const localComparison = useMemo(() => {
    if (mode === "cloud") return { changes: [], error: null as string | null };
    try { return { changes: baseline && candidate && active ? compareContracts(baseline.contract, candidate.contract, active.direction) : [], error: null as string | null }; }
    catch (reason) { return { changes: [], error: reason instanceof OpenApiComparisonError ? reason.message : "Unable to compare these contracts." }; }
  }, [mode, baseline, candidate, active]);
  const localChanges = localComparison.changes;
  useEffect(() => { if (mode === "local" && localComparison.error) setError(localComparison.error); }, [mode, localComparison.error]);
  const localDiff = useMemo(
    () => (baseline && candidate && active ? buildDiff(baseline.id, candidate.id, active.direction, localChanges) : null),
    [baseline, candidate, active, localChanges],
  );
  const unchanged = useMemo(
    () => (baseline && candidate ? collectUnchangedNodes(baseline.contract, candidate.contract) : []),
    [baseline, candidate],
  );
  useEffect(() => {
    if (mode !== "cloud" || !active || !baseline || !candidate) { setSavedDiff(null); setSavedDiffStatus("idle"); return; }
    let cancelled = false;
    setSavedDiff(null);
    setSavedDiffStatus("loading");
    void loadOrCreateCloudDiff(active.id, baseline.id, candidate.id, active.direction)
      .then((result) => { if (!cancelled) { setSavedDiff({ ...result, workspaceId: active.id, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id, direction: active.direction }); setSavedDiffStatus("ready"); } })
      .catch((reason: unknown) => { if (!cancelled) { setSavedDiffStatus("error"); setError(reason instanceof Error ? reason.message : "Unable to load the saved comparison."); } });
    return () => { cancelled = true; };
  }, [mode, active, baseline, candidate]);
  const savedDiffMatches = !!savedDiff && savedDiff.workspaceId === active?.id && savedDiff.baselineSnapshotId === baseline?.id && savedDiff.candidateSnapshotId === candidate?.id && savedDiff.direction === active?.direction;
  const changes = mode === "cloud" ? (savedDiffMatches ? savedDiff!.changes : []) : localChanges;
  const diff = mode === "cloud"
    ? savedDiffMatches && localDiff ? { ...localDiff, summary: savedDiff!.summary, changes: savedDiff!.changes } : null
    : localDiff;
  const counts = diff?.summary ?? { breaking: 0, warning: 0, safe: 0, info: 0, total: 0 };
  const selected = changes.find((change) => change.id === selectedId) ?? changes.find((change) => change.pointer === activePointer) ?? null;

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash("Copied", 1500);
    } catch {
      flash("Clipboard permission unavailable", 2000);
    }
  }, [flash]);

  const handleImport = useCallback(async (artifact: ImportArtifact, label: string, fileName: string | null, side: "before" | "after", rawText: string) => {
    setPendingAction("import");
    try {
      let workspace = active;
      if (!workspace) {
        workspace = mode === "cloud" ? await createCloudWorkspace("Untitled Contract", "response") : createWorkspace("Untitled Contract");
        if (mode === "local") await saveWorkspace(workspace);
        setWorkspaces((current) => [workspace!, ...current]);
        selectWorkspace(workspace.id);
      }
      const snapshotResult = mode === "cloud"
        ? artifact.format === "openapi"
          ? await createCloudOpenApiSnapshot(workspace.id, label, rawText, fileName, side === "before" ? "baseline" : "candidate")
          : await createCloudSnapshot(workspace.id, label, artifact.samples, fileName, side === "before" ? "baseline" : "candidate")
        : null;
      const snapshot = snapshotResult?.snapshot ?? (artifact.format === "openapi"
        ? await createOpenApiSnapshot(workspace.id, artifact.contract, label, fileName)
        : await createSnapshot(workspace.id, artifact.samples, label, fileName));
      const updated: Workspace = {
        ...workspace,
        [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: snapshot.id,
        updatedAt: snapshotResult?.workspace.updatedAt ?? new Date().toISOString(),
      };
      if (mode === "local") await saveWorkspace(updated);
      setSnapshots((current) => mode === "cloud" ? [...current.filter((item) => item.id !== snapshot.id), snapshot] : [...current, snapshot]);
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      selectChange(null, null);
      setImportOpen(false);
      flash(`${side === "before" ? "Baseline" : "Candidate"} imported`);
    } catch (reason) {
      throw reason instanceof Error ? reason : new Error("Unable to import this snapshot.");
    } finally {
      setPendingAction(null);
    }
  }, [active, flash, mode, selectChange, selectWorkspace, setImportOpen]);

  async function newWorkspace() {
    const name = window.prompt("Workspace name", "New contract workspace");
    if (!name?.trim() || pendingAction) return;
    setPendingAction("workspace");
    try {
      const workspace = mode === "cloud" ? await createCloudWorkspace(name.trim(), "response") : createWorkspace(name.trim());
      if (mode === "local") await saveWorkspace(workspace);
      setWorkspaces((current) => [workspace, ...current]);
      selectWorkspace(workspace.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to create the ${mode} workspace.`);
    } finally {
      setPendingAction(null);
    }
  }

  async function renameWorkspace() {
    if (!active || pendingAction) return;
    const name = window.prompt("Rename workspace", active.name);
    if (!name?.trim() || name.trim() === active.name) return;
    setPendingAction("workspace");
    try {
      const updated = mode === "cloud"
        ? await renameCloudWorkspace(active.id, name.trim())
        : { ...active, name: name.trim(), updatedAt: new Date().toISOString() };
      const persisted: Workspace = mode === "cloud" ? { ...active, ...updated } : updated;
      if (mode === "local") await saveWorkspace(persisted);
      setWorkspaces((current) => current.map((item) => (item.id === persisted.id ? persisted : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename this workspace.");
    } finally {
      setPendingAction(null);
    }
  }

  async function removeWorkspace() {
    if (!active || pendingAction) return;
    if (!window.confirm(`Delete “${active.name}”, all of its snapshots, and all saved comparisons? This cannot be undone.`)) return;
    setPendingAction("workspace");
    try {
      if (mode === "cloud") await deleteCloudWorkspace(active.id);
      else await deleteWorkspace(active.id);
      setSnapshots((current) => current.filter((snapshot) => snapshot.workspaceId !== active.id));
      const remaining = workspaces.filter((item) => item.id !== active.id);
      setWorkspaces(remaining);
      selectWorkspace(remaining[0]?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this workspace.");
    } finally {
      setPendingAction(null);
    }
  }

  async function swapSnapshots() {
    if (!active || pendingAction) return;
    setPendingAction("swap");
    try {
      const updated = { ...active, baselineSnapshotId: active.candidateSnapshotId, candidateSnapshotId: active.baselineSnapshotId, updatedAt: new Date().toISOString() };
      if (mode === "cloud") {
        const persisted = await updateCloudWorkspace(active.id, { baselineSnapshotId: updated.baselineSnapshotId, candidateSnapshotId: updated.candidateSnapshotId });
        updated.updatedAt = persisted.updatedAt;
      } else { await saveWorkspace(updated); }
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      selectChange(null, null);
      flash("Sides swapped");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to swap snapshots.");
    } finally {
      setPendingAction(null);
    }
  }

  async function changeDirection(direction: ContractDirection) {
    if (!active || pendingAction) return;
    setPendingAction("direction");
    try {
      const updated = { ...active, direction, updatedAt: new Date().toISOString() };
      if (mode === "cloud") {
        const persisted = await updateCloudWorkspace(active.id, { direction });
        updated.updatedAt = persisted.updatedAt;
      } else { await saveWorkspace(updated); }
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change this contract direction.");
    } finally {
      setPendingAction(null);
    }
  }

  const renameLabel = useCallback(async (snapshot: ContractSnapshot, versionLabel: string) => {
    try {
      if (mode === "cloud") await renameCloudSnapshot(snapshot.id, versionLabel);
      else await renameSnapshot(snapshot.id, versionLabel);
      setSnapshots((current) => current.map((item) => (item.id === snapshot.id ? { ...item, versionLabel } : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename this snapshot.");
    }
  }, [mode]);

  const deleteSide = useCallback(async (side: "before" | "after") => {
    if (!active || pendingAction) return;
    const snapshot = side === "before" ? baseline : candidate;
    if (!snapshot) return;
    if (!window.confirm(`Delete the ${side === "before" ? "baseline" : "candidate"} snapshot “${snapshot.versionLabel}” and saved comparisons that use it? This cannot be undone.`)) return;
    setPendingAction(`delete-${side}`);
    try {
      if (mode === "cloud") {
        const persisted = await updateCloudWorkspace(active.id, side === "before" ? { baselineSnapshotId: null } : { candidateSnapshotId: null });
        await deleteCloudSnapshot(snapshot.id);
        const updated: Workspace = { ...active, updatedAt: persisted.updatedAt, [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: null };
        setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      } else {
        const persisted = { ...active, updatedAt: new Date().toISOString(), [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: null };
        await deleteSnapshot(snapshot.id);
        await saveWorkspace(persisted);
        setWorkspaces((current) => current.map((item) => (item.id === persisted.id ? persisted : item)));
      }
      setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
      selectChange(null, null);
      flash("Snapshot deleted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this snapshot.");
      await refresh();
    } finally {
      setPendingAction(null);
    }
  }, [active, baseline, candidate, flash, mode, pendingAction, refresh, selectChange]);

  const loadDemo = useCallback(async () => {
    if (pendingAction) return;
    if (active?.baselineSnapshotId || active?.candidateSnapshotId) {
      if (!window.confirm("Load demo contracts into this workspace and replace its active baseline and candidate? Existing snapshots and saved comparisons will remain in history.")) return;
    }
    setPendingAction("demo");
    try {
      let workspace = active;
      if (!workspace) {
        workspace = mode === "cloud" ? await createCloudWorkspace("Demo contract workspace", "event") : createWorkspace("Demo contract workspace", "event");
        if (mode === "local") await saveWorkspace(workspace);
      }
      if (mode === "cloud") {
        const demo = getDemoSamples();
        const baseline = await createCloudSnapshot(workspace.id, "2026-09 baseline", demo.baseline, "order-shipped-v1.json", "baseline");
        const candidate = await createCloudSnapshot(workspace.id, "2026-10 candidate", demo.candidate, "order-shipped-v2.json", "candidate");
        const updated = { ...workspace, ...candidate.workspace };
        setWorkspaces((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        setSnapshots((current) => [...current.filter((item) => item.id !== baseline.snapshot.id && item.id !== candidate.snapshot.id), baseline.snapshot, candidate.snapshot]);
        selectWorkspace(updated.id);
      } else {
        const result = await importDemoFixture(workspace);
        setSnapshots((current) => [...current.filter((snapshot) => ![result.baseline.id, result.candidate.id].includes(snapshot.id)), result.baseline, result.candidate]);
        setWorkspaces((current) => [result.workspace, ...current.filter((item) => item.id !== result.workspace.id)]);
        selectWorkspace(result.workspace.id);
      }
      selectChange(null, null);
      flash("Demo payloads loaded");
    } catch (reason) {
      if (mode === "cloud") await refresh();
      setError(reason instanceof Error ? reason.message : "Unable to load the demo payloads.");
    } finally {
      setPendingAction(null);
    }
  }, [active, flash, mode, pendingAction, refresh, selectChange, selectWorkspace]);

  function exportFile(kind: "workspace" | "report") {
    if (!active || pendingAction) return;
    setPendingAction("export");
    try {
      if (kind === "workspace") {
        download("contract-atlas-workspace.json", buildWorkspaceExport(active, baseline, candidate), "application/json");
        flash("Workspace backup downloaded");
      } else if (baseline && candidate && diff) {
        download("contract-atlas-report.md", buildMarkdownReport(active, baseline, candidate, diff), "text/markdown;charset=utf-8");
        flash("Report downloaded");
      } else {
        setError("This workspace does not have both snapshots yet.");
      }
    } finally {
      setPendingAction(null);
    }
  }

  // Recomputed each render; the palette only mounts while open, so this is cheap.
  const commands: Command[] = [
    { id: "import-baseline", label: "Import baseline", hint: "Ctrl O", icon: FilePlus2, run: () => openImport("before") },
    { id: "import-candidate", label: "Import candidate", icon: FilePlus2, run: () => openImport("after") },
    { id: "new-workspace", label: "New workspace", icon: FolderPlus, run: () => void newWorkspace() },
    { id: "swap", label: "Swap baseline/candidate", icon: Repeat, run: () => void swapSnapshots() },
    { id: "rename", label: "Rename workspace", icon: Pencil, run: () => void renameWorkspace() },
    { id: "export-report", label: "Export report", hint: "Ctrl E", icon: FileText, run: () => exportFile("report") },
    { id: "export-workspace", label: "Backup workspace", icon: Download, run: () => exportFile("workspace") },
    { id: "raw-json", label: "Toggle raw JSON", icon: FileJson, run: () => setRawOpen(!rawOpen) },
    { id: "clear-filters", label: "Clear filters", icon: Search, run: () => useWorkspaceUIStore.getState().resetFilters() },
    { id: "load-demo", label: "Load demo payloads", icon: ArrowDownUp, run: () => void loadDemo() },
  ];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = !!target && (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!useWorkspaceUIStore.getState().isCommandPaletteOpen);
      } else if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        openImport("before");
      } else if (!editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        exportFile("report");
      } else if (event.key === "Escape") {
        if (useWorkspaceUIStore.getState().isCommandPaletteOpen) setPaletteOpen(false);
        else if (useWorkspaceUIStore.getState().isImportSheetOpen) setImportOpen(false);
        else if (useWorkspaceUIStore.getState().isRawJsonDrawerOpen) setRawOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (loading) return <main className="ca-app" aria-busy="true">
    <div className="ca-main">        <div className="dm-skeleton" role="status" aria-live="polite" style={{ margin: "auto", width: "min(100%, 390px)" }}>
        <div className="ca-boot"><div className="ca-boot-mark"><Link href="/" className="ca-boot-brand" aria-label="DriftMap home"><Image src="/logos/driftmap-icon.svg" alt="" width={30} height={30} /><span>DriftMap</span></Link></div><div className="ca-boot-step is-active"><span className="ca-boot-dot"/>{mode === "cloud" ? "Loading cloud workspaces" : "Opening local workspace"}</div><div className="ca-boot-step"><span className="ca-boot-dot"/>Loading contract graph</div></div>
      </div>
    </div>
  </main>;

  return (
    <main className="ca-app">
      <WorkspaceHeader
        workspaces={workspaces}
        active={active}
        mode={mode}
        cloudAvailable={!!session}
        sessionStatus={sessionStatus}
        onModeChange={chooseMode}
        onSelect={selectWorkspace}
        onNew={() => void newWorkspace()}
        onRename={() => void renameWorkspace()}
        onDelete={() => void removeWorkspace()}
        onSwap={() => void swapSnapshots()}
        onDeleteSnapshot={(side) => void deleteSide(side)}
        onDirection={(direction) => void changeDirection(direction)}
        onPalette={() => setPaletteOpen(true)}
      />
      <div className="ca-main">
        {error && (
          <div className="ca-error" role="alert">
            {error}
            <button onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {!baseline || !candidate ? (
          <EmptyWorkbench mode={mode} onImport={openImport} onDemo={() => void loadDemo()} />
        ) : (
          <>
            <div className="ca-toolbar">
              <nav className="dm-breadcrumb" aria-label="Workspace breadcrumb">
                <Link href="/">DriftMap</Link>
                <span aria-hidden="true">/</span>
                <span className="ca-overline">Workspaces</span>
                <span aria-hidden="true">/</span>
                <strong aria-current="page" style={{ color: "var(--text-primary)", fontSize: 12 }}>{active?.name}</strong>
              </nav>
              <span role="status" aria-live="polite" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--text-muted)", border: "1px solid var(--border)", background: mode === "cloud" ? "var(--severity-info-bg)" : "var(--severity-safe-bg)", padding: "4px 8px", borderRadius: 999 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: mode === "cloud" ? "var(--severity-info)" : "var(--severity-safe)" }} aria-hidden="true" />
                {mode === "cloud" ? (session?.user?.email ? `Cloud mode · signed in as ${session.user.email}` : "Cloud mode · signed in") : "Local mode: data stays in this browser"}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-soft)" }}>{mode === "cloud" ? "" : "Not synced to cloud"}</span>
              <div className="dm-toolbar-actions">
                <button className="dm-btn" disabled={pendingAction !== null} onClick={() => openImport("before")}><Upload size={14} aria-hidden="true" /><span>Import baseline</span></button>
                <button className="dm-btn" disabled={pendingAction !== null} onClick={() => openImport("after")}><Upload size={14} aria-hidden="true" /><span>Import candidate</span></button>
                <button className="dm-btn is-primary" disabled={pendingAction !== null} onClick={() => exportFile("report")}><FileText size={14} aria-hidden="true" /><span>Export report</span></button>
              </div>
            </div>
            <div className="ca-workspace-title">
              <div>
                <span className="ca-overline">{mode === "cloud" ? "Cloud workspace" : "Local workspace"}</span>
                <h1>{active?.name ?? "Untitled workspace"}</h1>
              </div>
              <div className="ca-compare-meta">
                <span className="dm-version-pill is-baseline"><ArrowDownUp size={11} aria-hidden="true" />{baseline.versionLabel} · {snapshotScope(baseline)}</span>
                <span className="dm-version-pill is-candidate"><ArrowDownUp size={11} aria-hidden="true" />{candidate.versionLabel} · {snapshotScope(candidate)}</span>
              </div>
            </div>
            <div className="dm-summary" aria-label="Change summary">
              <button className="dm-summary-card is-breaking" aria-pressed={useWorkspaceUIStore.getState().filters.severities.length === 1 && useWorkspaceUIStore.getState().filters.severities[0] === "breaking"}
                onClick={() => filterToSeverity("breaking")} aria-label={`Filter breaking: ${counts.breaking}`}>
                <b>{counts.breaking}</b><span>Breaking</span>
              </button>
              <button className="dm-summary-card is-warning" aria-pressed={useWorkspaceUIStore.getState().filters.severities.length === 1 && useWorkspaceUIStore.getState().filters.severities[0] === "warning"} onClick={() => filterToSeverity("warning")} aria-label={`Filter warnings: ${counts.warning}`}><b>{counts.warning}</b><span>Warnings</span></button>
              <button className="dm-summary-card is-safe" aria-pressed={useWorkspaceUIStore.getState().filters.severities.length === 1 && useWorkspaceUIStore.getState().filters.severities[0] === "safe"} onClick={() => filterToSeverity("safe")} aria-label={`Filter safe: ${counts.safe}`}><b>{counts.safe}</b><span>Safe</span></button>
              <button className="dm-summary-card is-info" aria-pressed={useWorkspaceUIStore.getState().filters.severities.length === 1 && useWorkspaceUIStore.getState().filters.severities[0] === "info"} onClick={() => filterToSeverity("info")} aria-label={`Filter info: ${counts.info}`}><b>{counts.info}</b><span>Info</span></button>
            </div>
            {mode === "cloud" && savedDiffStatus === "loading" && <p role="status" className="ca-muted">Loading saved comparison…</p>}
            <div className="ca-three-pane">
              <SnapshotTree title="Baseline" snapshot={baseline} opposite={candidate} changes={changes} side="before" onRenameLabel={(snapshot, label) => void renameLabel(snapshot, label)} onDeleteSnapshot={() => void deleteSide("before")} />
              <ChangeRail changes={changes} counts={counts} direction={active?.direction ?? "event"} unchanged={unchanged} onSelect={(change) => selectChange(change.id, change.pointer)} />
              <SnapshotTree title="Candidate" snapshot={candidate} opposite={baseline} changes={changes} side="after" onRenameLabel={(snapshot, label) => void renameLabel(snapshot, label)} onDeleteSnapshot={() => void deleteSide("after")} />
            </div>
            <ChangeInspector change={selected} direction={active?.direction ?? "event"} onCopy={(text) => void copy(text)} />
          </>
        )}
        <footer className="ca-footer">
          <span>{mode === "cloud" ? "Cloud-synced · contracts saved to your private workspace" : "Local-only · imported contracts stay in this browser"}</span>
          <button disabled={pendingAction !== null} onClick={() => setRawOpen(!rawOpen)}><FileJson size={14} aria-hidden="true" />{rawOpen ? "Hide raw JSON" : "View raw JSON"}</button>
          <button disabled={pendingAction !== null} onClick={() => exportFile("workspace")}><Download size={14} aria-hidden="true" />{pendingAction === "export" ? "Preparing…" : "Backup workspace"}</button>
          <span className="ca-shortcut-hint">Ctrl/⌘ K commands · Ctrl/⌘ O import · Ctrl/⌘ E export</span>
        </footer>
      </div>
      {rawOpen && <RawJsonDrawer baseline={baseline} candidate={candidate} onClose={() => setRawOpen(false)} />}
      {cloudPromptOpen && <CloudAccessPrompt onStayLocal={() => { writeWorkbenchMode(browserPreferenceStorage(), "local"); setCloudPromptOpen(false); setMode("local"); }} />}
      {importOpen && <ImportSheet onImport={handleImport} side={importSide} saving={pendingAction === "import"} />}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      {notice && <div className="ca-toast" role="status">{notice}</div>}
    </main>
  );
}
