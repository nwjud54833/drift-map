"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Download, FileJson, FilePlus2, FileText, FolderPlus, Pencil, Repeat, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import type { ContractDirection, ContractSnapshot, ImportArtifact, Workspace } from "@/lib/contract/types";
import { buildDiff, collectUnchangedNodes, compareContracts } from "@/lib/contract/compare";
import { OpenApiComparisonError } from "@/lib/contract/openapi";
import { buildMarkdownReport, buildWorkspaceExport } from "@/lib/contract/export";
import {
  createCloudOpenApiSnapshot,
  createCloudSnapshot,
  createCloudWorkspace,
  deleteCloudSnapshot,
  deleteCloudWorkspace,
  loadCloudWorkbench,
  loadOrCreateCloudDiff,
  renameCloudSnapshot,
  renameCloudWorkspace,
  updateCloudWorkspace,
} from "@/lib/db/cloud-api";
import {
  createOpenApiSnapshot,
  createSnapshot,
  createWorkspace,
  deleteSnapshot,
  deleteWorkspace,
  getDemoSamples,
  importDemoFixture,
  loadWorkbench,
  renameSnapshot,
  saveWorkspace,
} from "@/lib/db/contract-atlas-db";
import { useWorkspaceUIStore } from "@/stores/workspace-ui-store";
import { browserPreferenceStorage, readActiveWorkspaceId, readWorkbenchMode, writeActiveWorkspaceId, writeWorkbenchMode } from "@/lib/workbench/preferences";
import { useDebouncedValue } from "@/lib/workbench/use-debounced-value";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { ghostPointers, snapshotFingerprint } from "@/lib/workbench/fingerprint";
import { WorkbenchShell, type WorkbenchMode, type SessionState } from "./app-shell";
import { InputPanel } from "./input-panel";
import { ContractTree } from "./contract-tree";
import { DiffResults } from "./diff-results";
import { ChangeInspector, ExportPanel, RawJsonDrawer } from "./inspector";
import { Onboarding, readOnboardingDismissed, writeOnboardingDismissed } from "./onboarding";
import { ImportSheet } from "../contract-atlas/import-sheet";
import { CloudAccessPrompt } from "../contract-atlas/cloud-access-prompt";
import { CommandPalette, type Command } from "../contract-atlas/command-palette";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/banner";
import { Tabs } from "@/components/ui/tabs";
import { ToastRegion, toast } from "@/components/ui/toast";
import { Skeleton, SkeletonLines } from "@/components/ui/skeleton";

type PaneKey = "inputs" | "contract" | "drift";

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

function samplesToDraft(snapshot: ContractSnapshot | null): string {
  if (!snapshot || snapshot.samples.length === 0) return "";
  const payload = snapshot.samples.length === 1 ? snapshot.samples[0].value : snapshot.samples.map((sample) => sample.value);
  return JSON.stringify(payload, null, 2);
}

export default function ContractAtlasClient() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [snapshots, setSnapshots] = useState<ContractSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ message: string; retry: (() => void) | null } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [importSide, setImportSide] = useState<"before" | "after">("before");
  const [mode, setMode] = useState<WorkbenchMode>("local");
  const [modePreferenceReady, setModePreferenceReady] = useState(false);
  const [cloudPromptOpen, setCloudPromptOpen] = useState(false);
  const [pane, setPane] = useState<PaneKey>("inputs");
  const [draftSide, setDraftSide] = useState<"before" | "after">("before");
  const [draft, setDraft] = useState("");
  const [onboardingDismissed, setOnboardingDismissed] = useState(true);
  const [savedDiff, setSavedDiff] = useState<{
    id: string;
    workspaceId: string;
    baselineSnapshotId: string;
    candidateSnapshotId: string;
    direction: ContractDirection;
    summary: { breaking: number; warning: number; safe: number; info: number; total: number };
    changes: import("@/lib/contract/types").ContractChange[];
  } | null>(null);
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
  // Subscribed (not read via getState) so aria-pressed stays in sync with the store.
  const filters = useWorkspaceUIStore((state) => state.filters);
  const toggleSeverity = useWorkspaceUIStore((state) => state.toggleSeverity);
  const setQuery = useWorkspaceUIStore((state) => state.setQuery);
  const resetFilters = useWorkspaceUIStore((state) => state.resetFilters);

  const openImport = useCallback((side: "before" | "after") => { setImportSide(side); setImportOpen(true); }, [setImportOpen]);
  const chooseMode = useCallback((nextMode: WorkbenchMode) => {
    if (nextMode === "cloud" && sessionStatus === "loading") {
      toast.info("Checking sign-in status…");
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
  }, [sessionStatus]);

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

  useEffect(() => { setOnboardingDismissed(readOnboardingDismissed(browserPreferenceStorage())); }, []);

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
      setError({ message: reason instanceof Error ? reason.message : "Local browser storage is unavailable.", retry: () => void refresh() });
    } finally {
      setLoading(false);
    }
  }, [mode, modePreferenceReady, selectWorkspace, setActiveWorkspace]);

  useEffect(() => { void refresh(); }, [refresh]);

  const active = workspaces.find((workspace) => workspace.id === activeId) ?? null;
  const baseline = snapshots.find((snapshot) => snapshot.id === active?.baselineSnapshotId) ?? null;
  const candidate = snapshots.find((snapshot) => snapshot.id === active?.candidateSnapshotId) ?? null;
  const hasComparison = Boolean(baseline && candidate);

  // Editing a draft never mutates stored snapshots: the draft only becomes a
  // snapshot through the explicit "Set as …" action.
  useEffect(() => {
    setDraft(samplesToDraft(draftSide === "before" ? baseline : candidate));
  }, [activeId, draftSide, baseline, candidate]);

  // Heavy recomputation runs off the debounced draft; the editor stays immediate.
  const debouncedDraft = useDebouncedValue(draft, 250);
  const recomputing = debouncedDraft !== draft;

  const localComparison = useMemo(() => {
    if (mode === "cloud") return { changes: [], error: null as string | null };
    try {
      return {
        changes: hasComparison && active ? compareContracts(baseline!.contract, candidate!.contract, active.direction) : [],
        error: null as string | null,
      };
    } catch (reason) {
      return { changes: [], error: reason instanceof OpenApiComparisonError ? reason.message : "Unable to compare these contracts." };
    }
  }, [mode, hasComparison, baseline, candidate, active]);

  useEffect(() => {
    if (mode === "local" && localComparison.error) setError({ message: localComparison.error, retry: null });
  }, [mode, localComparison.error]);

  const localDiff = useMemo(
    () => (hasComparison && baseline && candidate && active ? buildDiff(baseline.id, candidate.id, active.direction, localComparison.changes) : null),
    [hasComparison, baseline, candidate, active, localComparison.changes],
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
      .then((result) => {
        if (cancelled) return;
        setSavedDiff({ ...result, workspaceId: active.id, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id, direction: active.direction });
        setSavedDiffStatus("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setSavedDiffStatus("error");
        setError({ message: reason instanceof Error ? reason.message : "Unable to load the saved comparison.", retry: null });
      });
    return () => { cancelled = true; };
  }, [mode, active, baseline, candidate]);

  const savedDiffMatches = Boolean(savedDiff)
    && savedDiff!.workspaceId === active?.id
    && savedDiff!.baselineSnapshotId === baseline?.id
    && savedDiff!.candidateSnapshotId === candidate?.id
    && savedDiff!.direction === active?.direction;
  // Memoised because it feeds the ⌘E export callback and the export panel;
  // rebuilding this object every render would invalidate both.
  const changes = useMemo(
    () => (mode === "cloud" ? (savedDiffMatches ? savedDiff!.changes : []) : localComparison.changes),
    [mode, savedDiffMatches, savedDiff, localComparison.changes],
  );
  const diff = useMemo(
    () => (mode === "cloud"
      ? (savedDiffMatches && localDiff ? { ...localDiff, summary: savedDiff!.summary, changes: savedDiff!.changes } : null)
      : localDiff),
    [mode, savedDiffMatches, savedDiff, localDiff],
  );
  const counts = diff?.summary ?? { breaking: 0, warning: 0, safe: 0, info: 0, total: 0 };
  const selected = changes.find((change) => change.id === selectedId) ?? changes.find((change) => change.pointer === activePointer) ?? null;

  const copy = useCallback(async (text: string, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label);
    } catch {
      toast.error("Clipboard permission is unavailable in this browser. Select the text and copy it manually.");
    }
  }, []);

  const applyDraft = useCallback(async (artifact: ImportArtifact, side: "before" | "after") => {
    setPendingAction("import");
    try {
      let workspace = active;
      if (!workspace) {
        workspace = mode === "cloud" ? await createCloudWorkspace("Untitled Contract", "response") : createWorkspace("Untitled Contract");
        if (mode === "local") await saveWorkspace(workspace);
        setWorkspaces((current) => [workspace!, ...current]);
        selectWorkspace(workspace.id);
      }
      const label = `${new Date().toISOString().slice(0, 10)} ${side === "before" ? "baseline" : "candidate"}`;
      const snapshotResult = mode === "cloud"
        ? artifact.format === "openapi"
          ? await createCloudOpenApiSnapshot(workspace.id, label, JSON.stringify(artifact.contract.document), null, side === "before" ? "baseline" : "candidate")
          : await createCloudSnapshot(workspace.id, label, artifact.samples, null, side === "before" ? "baseline" : "candidate")
        : null;
      const snapshot = snapshotResult?.snapshot ?? (artifact.format === "openapi"
        ? await createOpenApiSnapshot(workspace.id, artifact.contract, label, null)
        : await createSnapshot(workspace.id, artifact.samples, label, null));
      const updated: Workspace = {
        ...workspace,
        [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: snapshot.id,
        updatedAt: snapshotResult?.workspace.updatedAt ?? new Date().toISOString(),
      };
      if (mode === "local") await saveWorkspace(updated);
      setSnapshots((current) => mode === "cloud" ? [...current.filter((item) => item.id !== snapshot.id), snapshot] : [...current, snapshot]);
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      selectChange(null, null);
      toast.success(`${side === "before" ? "Baseline" : "Candidate"} set — ${snapshotScope(snapshot)}`);
      setPane(side === "before" ? "contract" : "drift");
    } catch (reason) {
      setError({ message: reason instanceof Error ? reason.message : "Unable to save this snapshot.", retry: () => void applyDraft(artifact, side) });
    } finally {
      setPendingAction(null);
    }
  }, [active, mode, selectChange, selectWorkspace]);

  const loadDemo = useCallback(async () => {
    if (pendingAction) return;
    if (active?.baselineSnapshotId || active?.candidateSnapshotId) {
      if (!window.confirm("Load the sample payloads into this workspace and replace its active baseline and candidate? Existing snapshots remain in history.")) return;
    }
    setPendingAction("demo");
    try {
      let workspace = active;
      if (!workspace) {
        workspace = mode === "cloud" ? await createCloudWorkspace("Sample contract workspace", "event") : createWorkspace("Sample contract workspace", "event");
        if (mode === "local") await saveWorkspace(workspace);
      }
      if (mode === "cloud") {
        const demo = getDemoSamples();
        const baselineResult = await createCloudSnapshot(workspace.id, "2026-09 baseline", demo.baseline, "order-shipped-v1.json", "baseline");
        const candidateResult = await createCloudSnapshot(workspace.id, "2026-10 candidate", demo.candidate, "order-shipped-v2.json", "candidate");
        const updated = { ...workspace, ...candidateResult.workspace };
        setWorkspaces((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        setSnapshots((current) => [...current.filter((item) => item.id !== baselineResult.snapshot.id && item.id !== candidateResult.snapshot.id), baselineResult.snapshot, candidateResult.snapshot]);
        selectWorkspace(updated.id);
      } else {
        const result = await importDemoFixture(workspace);
        setSnapshots((current) => [...current.filter((snapshot) => ![result.baseline.id, result.candidate.id].includes(snapshot.id)), result.baseline, result.candidate]);
        setWorkspaces((current) => [result.workspace, ...current.filter((item) => item.id !== result.workspace.id)]);
        selectWorkspace(result.workspace.id);
      }
      selectChange(null, null);
      setPane("drift");
      toast.success("Sample payloads loaded — a webhook migration with removed fields and newly required fields.");
    } catch (reason) {
      if (mode === "cloud") await refresh();
      setError({ message: reason instanceof Error ? reason.message : "Unable to load the sample payloads.", retry: () => void loadDemo() });
    } finally {
      setPendingAction(null);
    }
  }, [active, mode, pendingAction, refresh, selectChange, selectWorkspace]);

  /** Loads the sample pair into the editor for the side currently being edited. */
  const loadSampleIntoDraft = useCallback(() => {
    const demo = getDemoSamples();
    const samples = draftSide === "before" ? demo.baseline : demo.candidate;
    setDraft(JSON.stringify(samples.length === 1 ? samples[0].value : samples.map((sample) => sample.value), null, 2));
    toast.info(`Loaded the ${draftSide === "before" ? "baseline" : "candidate"} sample into the editor. Choose “Set as …” to save it.`);
  }, [draftSide]);

  async function onEditorFile(file: File) {
    try {
      const text = await file.text();
      setDraft(text);
      const result = parseImportArtifact(text, { yaml: /\.ya?ml$/i.test(file.name), source: "file" });
      if (!result.ok) toast.error(result.message);
      else toast.success(`${file.name} loaded into the editor. Choose “Set as …” to save it.`);
    } catch {
      toast.error(`Unable to read “${file.name}”.`);
    }
  }

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
      setError({ message: reason instanceof Error ? reason.message : `Unable to create the ${mode} workspace.`, retry: () => void newWorkspace() });
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
      setError({ message: reason instanceof Error ? reason.message : "Unable to rename this workspace.", retry: null });
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
      toast.success("Workspace deleted");
    } catch (reason) {
      setError({ message: reason instanceof Error ? reason.message : "Unable to delete this workspace.", retry: () => void removeWorkspace() });
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
      toast.success("Baseline and candidate swapped");
    } catch (reason) {
      setError({ message: reason instanceof Error ? reason.message : "Unable to swap snapshots.", retry: () => void swapSnapshots() });
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
      setError({ message: reason instanceof Error ? reason.message : "Unable to change this contract direction.", retry: null });
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
      setError({ message: reason instanceof Error ? reason.message : "Unable to rename this snapshot.", retry: null });
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
      toast.success("Snapshot deleted");
    } catch (reason) {
      setError({ message: reason instanceof Error ? reason.message : "Unable to delete this snapshot.", retry: () => void deleteSide(side) });
      await refresh();
    } finally {
      setPendingAction(null);
    }
  }, [active, baseline, candidate, mode, pendingAction, refresh, selectChange]);

  function exportWorkspace() {
    if (!active || pendingAction) return;
    setPendingAction("export");
    try {
      download("driftmap-workspace.json", buildWorkspaceExport(active, baseline, candidate), "application/json");
      toast.success("Workspace backup downloaded");
    } finally {
      setPendingAction(null);
    }
  }

  /** Retry the last failure when the operation is repeatable. */
  const retry = error?.retry ?? null;

  /** Same action as the export panel's report download, for the ⌘/Ctrl+E shortcut. */
  const exportMarkdownReport = useCallback(() => {
    if (!active || !baseline || !candidate || !diff) {
      setError({ message: "This workspace does not have both snapshots yet, so there is no report to export.", retry: null });
      return;
    }
    download("driftmap-report.md", buildMarkdownReport(active, baseline, candidate, diff), "text/markdown;charset=utf-8");
    toast.success("Markdown report downloaded");
  }, [active, baseline, candidate, diff]);

  const commands: Command[] = [
    { id: "import-baseline", label: "Import baseline", hint: "Ctrl O", icon: FilePlus2, run: () => openImport("before") },
    { id: "import-candidate", label: "Import candidate", icon: FilePlus2, run: () => openImport("after") },
    { id: "new-workspace", label: "New workspace", icon: FolderPlus, run: () => void newWorkspace() },
    { id: "swap", label: "Swap baseline and candidate", icon: Repeat, run: () => void swapSnapshots() },
    { id: "rename", label: "Rename workspace", icon: Pencil, run: () => void renameWorkspace() },
    { id: "export-report", label: "Download Markdown report", hint: "Ctrl E", icon: FileText, run: exportMarkdownReport },
    { id: "export-workspace", label: "Backup workspace", icon: Download, run: () => exportWorkspace() },
    { id: "raw-json", label: "Toggle raw source", icon: FileJson, run: () => setRawOpen(!rawOpen) },
    { id: "clear-filters", label: "Clear filters", icon: Search, run: () => resetFilters() },
    { id: "load-sample", label: "Load sample pair", icon: ArrowLeftRight, run: () => void loadDemo() },
  ];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target) && (["INPUT", "TEXTAREA", "SELECT"].includes(target!.tagName) || target!.isContentEditable);
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(!useWorkspaceUIStore.getState().isCommandPaletteOpen);
      } else if (!editing && modifier && event.key.toLowerCase() === "o") {
        event.preventDefault();
        openImport("before");
      } else if (!editing && modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        exportMarkdownReport();
      } else if (event.key === "Escape") {
        if (useWorkspaceUIStore.getState().isCommandPaletteOpen) setPaletteOpen(false);
        else if (useWorkspaceUIStore.getState().isImportSheetOpen) setImportOpen(false);
        else if (useWorkspaceUIStore.getState().isRawJsonDrawerOpen) setRawOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportMarkdownReport, openImport, setImportOpen, setPaletteOpen, setRawOpen]);

  if (loading) {
    // The shell renders immediately with real chrome (sidebar, mode switch,
    // theme, account) so only the data regions wait. The placeholder below
    // mirrors the final layout's dimensions to avoid a shift when it resolves.
    return (
      <WorkbenchShell
        workspaces={workspaces}
        snapshots={snapshots}
        active={null}
        mode={mode}
        sessionStatus={sessionStatus as SessionState}
        account={session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : null}
        pending
        onModeChange={chooseMode}
        onSelectWorkspace={selectWorkspace}
        onNewWorkspace={() => void newWorkspace()}
        onRenameWorkspace={() => void renameWorkspace()}
        onDeleteWorkspace={() => void removeWorkspace()}
        onSwap={() => void swapSnapshots()}
        onDirection={(direction) => void changeDirection(direction)}
        onSelectSnapshot={() => setRawOpen(true)}
        onImport={openImport}
      >
        <WorkbenchBodySkeleton mode={mode} />
      </WorkbenchShell>
    );
  }

  const contractCount = (baseline?.contract.nodes.length ?? 0) + (candidate?.contract.nodes.length ?? 0);

  return (
    <>
      <WorkbenchShell
        workspaces={workspaces}
        snapshots={snapshots}
        active={active}
        mode={mode}
        sessionStatus={sessionStatus as SessionState}
        account={session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : null}
        pending={pendingAction !== null || loading}
        onModeChange={chooseMode}
        onSelectWorkspace={selectWorkspace}
        onNewWorkspace={() => void newWorkspace()}
        onRenameWorkspace={() => void renameWorkspace()}
        onDeleteWorkspace={() => void removeWorkspace()}
        onSwap={() => void swapSnapshots()}
        onDirection={(direction) => void changeDirection(direction)}
        onSelectSnapshot={(side, snapshotId) => {
          const snapshot = snapshots.find((item) => item.id === snapshotId);
          if (!snapshot) return;
          if (snapshot.id !== (side === "before" ? active?.baselineSnapshotId : active?.candidateSnapshotId)) {
            toast.info(`“${snapshot.versionLabel}” is stored in this workspace but is not the active ${side === "before" ? "baseline" : "candidate"}. Use Swap sides or set it as a side from the editor.`);
          }
          setRawOpen(true);
        }}
        onImport={openImport}
      >
        {loading ? <WorkbenchBodySkeleton mode={mode} /> : (
        <div className="ca-body">
          {error && (
            <Banner
              tone="error"
              title="Something went wrong"
              actions={
                <>
                  {retry && <Button size="sm" onClick={retry}>Retry</Button>}
                  <Button size="sm" variant="quiet" onClick={() => setError(null)}>Dismiss</Button>
                </>
              }
            >
              {error.message}
            </Banner>
          )}

          {!hasComparison && !onboardingDismissed && (
            <Onboarding
              mode={mode}
              onImport={openImport}
              onLoadSample={() => void loadDemo()}
              onDismiss={() => { setOnboardingDismissed(true); writeOnboardingDismissed(browserPreferenceStorage()); }}
            />
          )}

          <div className="ca-toolbar">
            <nav className="dm-breadcrumb" aria-label="Breadcrumb">
              <Link href="/">DriftMap</Link>
              <span aria-hidden="true">/</span>
              <span className="ca-overline">Workbench</span>
              <span aria-hidden="true">/</span>
              <strong aria-current="page">{active?.name ?? "No workspace"}</strong>
            </nav>
            <div className="dm-toolbar-actions">
              <Button disabled={pendingAction !== null} onClick={() => openImport("before")}>Import baseline</Button>
              <Button disabled={pendingAction !== null} onClick={() => openImport("after")}>Import candidate</Button>
              <Button variant="quiet" disabled={pendingAction !== null} onClick={() => void loadDemo()}>Load sample pair</Button>
            </div>
          </div>

          {!hasComparison ? (
            <section className="ca-pane" aria-label="Comparison status">
              <div className="ca-pane-heading">
                <span className="ca-overline">Comparison</span>
                <strong>Waiting for both sides</strong>
              </div>
              <div className="ca-pane-body">
                <p className="ca-muted">
                  {baseline ? "The baseline is set. Import a candidate payload to see classified drift." : candidate ? "The candidate is set. Import a baseline payload to compare against." : "Import a baseline and a candidate payload to see classified drift."}
                </p>
                <div className="ca-input-actions">
                  <Button variant="primary" onClick={() => openImport(baseline ? "after" : "before")}>
                    Import {baseline ? "candidate" : "baseline"}
                  </Button>
                  <Button variant="quiet" onClick={() => void loadDemo()}>Load sample pair</Button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <div className="ca-workspace-title">
                <div>
                  <span className="ca-overline">{mode === "cloud" ? "Cloud workspace" : "Local workspace"}</span>
                  <h1>{active?.name ?? "Untitled workspace"}</h1>
                </div>
                <div className="ca-compare-meta">
                  <span className="dm-version-pill is-baseline"><ArrowLeftRight size={11} aria-hidden="true" />Baseline: {baseline!.versionLabel} · {snapshotScope(baseline!)}</span>
                  <span className="dm-version-pill is-candidate"><ArrowLeftRight size={11} aria-hidden="true" />Candidate: {candidate!.versionLabel} · {snapshotScope(candidate!)}</span>
                  <Button size="sm" variant="quiet" disabled={pendingAction !== null} onClick={() => void swapSnapshots()}>
                    <ArrowLeftRight size={13} aria-hidden="true" /> Swap
                  </Button>
                </div>
              </div>

              {filters.severities.length === 0 && counts.total > 0 && (
                <Banner tone="info" actions={<Button size="sm" variant="quiet" onClick={resetFilters}>Show all</Button>}>
                  No severity is selected, so no findings are listed. {counts.total} findings are available.
                </Banner>
              )}

              <Tabs
                label="Workbench panes"
                idPrefix="ca-pane"
                value={pane}
                onChange={setPane}
                className="ca-mobile-tabs"
                items={[
                  { value: "inputs", label: "Inputs" },
                  { value: "contract", label: "Contract", count: contractCount },
                  { value: "drift", label: "Drift", count: counts.total },
                ]}
              />

              <div className="ca-split">
                <div className="ca-pane-region" data-active={pane === "inputs"} role="tabpanel" id="ca-pane-panel-inputs" aria-labelledby="ca-pane-tab-inputs">
                  <InputPanel
                    side={draftSide}
                    draft={draft}
                    mode={mode}
                    baseline={baseline}
                    candidate={candidate}
                    pending={pendingAction === "import"}
                    onSideChange={setDraftSide}
                    onDraftChange={setDraft}
                    onApply={(artifact) => void applyDraft(artifact, draftSide)}
                    onFile={(file) => void onEditorFile(file)}
                    onLoadSample={loadSampleIntoDraft}
                  />
                </div>

                <div className="ca-pane-region ca-stack" data-active={pane === "contract"} role="tabpanel" id="ca-pane-panel-contract" aria-labelledby="ca-pane-tab-contract">
                  <ContractTree
                    title="Baseline"
                    side="before"
                    snapshot={baseline}
                    ghostPointers={ghostPointers(candidate, baseline)}
                    changes={changes}
                    fingerprint={snapshotFingerprint(baseline)}
                    pending={pendingAction !== null}
                    selectedPointer={activePointer}
                    onSelectPointer={(pointer, change) => selectChange(change?.id ?? null, pointer)}
                    onRenameSnapshot={(snapshot, label) => void renameLabel(snapshot, label)}
                    onDeleteSnapshot={(side) => void deleteSide(side)}
                    onReplaceSnapshot={openImport}
                    onCopyFingerprint={(value) => void copy(value, "Fingerprint copied")}
                  />
                  <ContractTree
                    title="Candidate"
                    side="after"
                    snapshot={candidate}
                    ghostPointers={ghostPointers(baseline, candidate)}
                    changes={changes}
                    fingerprint={snapshotFingerprint(candidate)}
                    pending={pendingAction !== null}
                    selectedPointer={activePointer}
                    onSelectPointer={(pointer, change) => selectChange(change?.id ?? null, pointer)}
                    onRenameSnapshot={(snapshot, label) => void renameLabel(snapshot, label)}
                    onDeleteSnapshot={(side) => void deleteSide(side)}
                    onReplaceSnapshot={openImport}
                    onCopyFingerprint={(value) => void copy(value, "Fingerprint copied")}
                  />
                </div>

                <div className="ca-pane-region" data-active={pane === "drift"} role="tabpanel" id="ca-pane-panel-drift" aria-labelledby="ca-pane-tab-drift">
                  <DiffResults
                    changes={changes}
                    counts={counts}
                    direction={active?.direction ?? "event"}
                    severities={filters.severities}
                    query={filters.query}
                    recomputing={recomputing || (mode === "cloud" && savedDiffStatus === "loading")}
                    selectedChangeId={selectedId}
                    hasSnapshots={hasComparison}
                    onToggleSeverity={toggleSeverity}
                    onQueryChange={setQuery}
                    onResetFilters={resetFilters}
                    onSelectChange={(change) => { selectChange(change.id, change.pointer); setPane("drift"); }}
                    onLoadSample={() => void loadDemo()}
                    onImport={openImport}
                  />
                </div>
              </div>

              <ChangeInspector change={selected} direction={active?.direction ?? "event"} onCopy={(text, label) => void copy(text, label)} />

              <section className="ca-pane" aria-label="Export">
                <div className="ca-pane-heading">
                  <span className="ca-overline">Export</span>
                  <strong>Share the review, or back up this workspace</strong>
                </div>
                <div className="ca-pane-body">
                  <ExportPanel
                    workspace={active}
                    baseline={baseline}
                    candidate={candidate}
                    diff={diff}
                    pending={pendingAction !== null}
                    onCopy={(text, label) => void copy(text, label)}
                    onDownload={(filename, content, type, label) => { download(filename, content, type); toast.success(label); }}
                    onError={(message) => setError({ message, retry: null })}
                  />
                </div>
              </section>

              {unchanged.length > 0 && (
                <section className="ca-pane" aria-label="Unchanged paths">
                  <div className="ca-pane-heading">
                    <span className="ca-overline">Unchanged</span>
                    <strong>{unchanged.length} paths identical on both sides</strong>
                  </div>
                  <div className="ca-change-list" style={{ maxHeight: 220 }}>
                    {unchanged.slice(0, 150).map((node) => (
                      <div className="ca-unchanged-row" key={node.pointer}>
                        <code>{node.pointer}</code>
                        <span className="ui-badge ui-badge-type" data-kind={node.kinds[0]}>{node.kinds.join(" | ")}</span>
                        <span className="ui-badge ui-badge-required" data-state={node.required ? "required" : "optional"}>
                          {node.required ? "required" : "optional"}
                        </span>
                      </div>
                    ))}
                    {unchanged.length > 150 && <p className="ca-unchanged-note">Showing the first 150 of {unchanged.length} unchanged paths.</p>}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        )}

        <footer className="ca-footer">
          <span>
            {mode === "cloud"
              ? "Cloud mode · snapshots are saved to your account"
              : "Local mode: data stays in this browser · not synced to cloud"}
          </span>
          <button type="button" onClick={() => setRawOpen(!rawOpen)}>
            <FileJson size={13} aria-hidden="true" />{rawOpen ? "Hide raw source" : "View raw source"}
          </button>
          <button type="button" disabled={pendingAction !== null} onClick={exportWorkspace}>
            <Download size={13} aria-hidden="true" />Back up workspace
          </button>
          <button type="button" onClick={() => setPaletteOpen(true)}>
            <FileText size={13} aria-hidden="true" />Commands ⌘K
          </button>
          <span className="ca-shortcut-hint">Ctrl/⌘ K commands · Ctrl/⌘ O import · Ctrl/⌘ E export report</span>
        </footer>
      </WorkbenchShell>

      {rawOpen && <RawJsonDrawer baseline={baseline} candidate={candidate} onClose={() => setRawOpen(false)} />}
      {cloudPromptOpen && <CloudAccessPrompt onStayLocal={() => { writeWorkbenchMode(browserPreferenceStorage(), "local"); setCloudPromptOpen(false); setMode("local"); }} />}
      {importOpen && (
        <ImportSheet
          side={importSide}
          saving={pendingAction === "import"}
          onImport={async (artifact, _label, _fileName, side) => { await applyDraft(artifact, side); setImportOpen(false); }}
        />
      )}
      {paletteOpen && <CommandPalette commands={commands} onClose={() => setPaletteOpen(false)} />}
      <ToastRegion />
    </>
  );
}

/**
 * Loading placeholder for the workbench body. It reuses the real pane classes
 * and grid so the page does not reflow when data arrives, and announces itself
 * once via a polite live region.
 */
function WorkbenchBodySkeleton({ mode }: { mode: WorkbenchMode }) {
  return (
    <div className="ca-body" aria-busy="true">
      <p className="sr-only" role="status" aria-live="polite">
        {mode === "cloud" ? "Loading cloud workspaces…" : "Opening the local workspace…"}
      </p>

      <div className="ca-toolbar" aria-hidden="true">
        <Skeleton width={280} height={14} />
        <div className="dm-toolbar-actions">
          <Skeleton width={120} height={28} />
          <Skeleton width={132} height={28} />
          <Skeleton width={100} height={28} />
        </div>
      </div>

      <div className="ca-workspace-title" aria-hidden="true">
        <div style={{ width: "min(100%, 320px)" }}>
          <Skeleton width={90} height={10} />
          <Skeleton width="80%" height={24} style={{ marginTop: 8 }} />
        </div>
        <div className="ca-compare-meta">
          <Skeleton width={190} height={24} radius="999px" />
          <Skeleton width={190} height={24} radius="999px" />
        </div>
      </div>

      <div className="dm-summary" aria-hidden="true">
        {["breaking", "warning", "safe", "info"].map((severity) => (
          <div className="dm-summary-card" key={severity}>
            <Skeleton width={28} height={22} />
            <Skeleton width={72} height={13} />
          </div>
        ))}
      </div>

      <div className="ca-split" aria-hidden="true">
        {[0, 1].map((column) => (
          <div className="ca-pane" key={column}>
            <div className="ca-pane-heading">
              <Skeleton width={110} height={10} />
              <Skeleton width={160} height={14} />
            </div>
            <div className="ca-pane-body">
              <SkeletonLines lines={6} gap={10} />
            </div>
          </div>
        ))}
      </div>

      <div className="ca-pane" aria-hidden="true">
        <div className="ca-pane-heading">
          <Skeleton width={80} height={10} />
          <Skeleton width={220} height={14} />
        </div>
        <div className="ca-pane-body">
          <SkeletonLines lines={4} gap={10} />
        </div>
      </div>
    </div>
  );
}
