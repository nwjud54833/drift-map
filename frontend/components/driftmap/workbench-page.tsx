"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Images } from "lucide-react";
import type { ChangeSeverity, ContractDirection, ContractSnapshot, ImportArtifact, Workspace } from "@/lib/contract/types";
import { buildDiff, compareContracts } from "@/lib/contract/compare";
import { OpenApiComparisonError } from "@/lib/contract/openapi";
import { buildMarkdownReport, buildWorkspaceExport } from "@/lib/contract/export";
import { sampleWarningsForSnapshots } from "@/lib/contract/sample-warnings";
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
  loadWorkbench,
  renameSnapshot,
  saveWorkspace,
} from "@/lib/db/contract-atlas-db";
import { buildSnapshotTimeline, toFindings, type Finding } from "@/lib/driftmap/presentation";
import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import { useRegisteredCommands } from "@/lib/driftmap/command-registry";
import { browserPreferenceStorage, readActiveWorkspaceId, readWorkbenchMode, writeActiveWorkspaceId, writeWorkbenchMode } from "@/lib/workbench/preferences";
import { parseImportArtifact } from "@/lib/workbench/import-artifact";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";
import { toast, ToastRegion } from "@/components/ui/toast";
import { WorkbenchInputPane, type WorkbenchInputHandle } from "./workbench-input-pane";
import { WorkbenchCenter, type WorkbenchCenterHandle } from "./workbench-center";
import { WorkbenchInspector } from "./workbench-inspector";
import { WorkbenchToolbar } from "./workbench-toolbar";
import { WorkbenchDrawer } from "./workbench-drawer";
import { WorkbenchEmptyState } from "./workbench-empty-state";
import { CIExportModal, type CIExportCredentials } from "./ci-export-modal";
import { ReviewLinkModal } from "./review-link-modal";
import { buildReviewPayload, decodeReviewState, encodeReviewState, parseReviewPayload, type ReviewPreview } from "@/lib/workbench/review-link";
import { getExampleDiffPreset, type ExampleDiffPresetId } from "@/lib/workbench/example-presets";

type WorkbenchMode = "local" | "cloud";

const LIVE_TRAFFIC_INTERVAL_MS = 1350;

/**
 * `/workbench` — the functional local-first Contract Atlas workbench, rendered
 * in the Obsidian v2.5 "Spatial" layout.
 *
 * The data layer is unchanged: Dexie IndexedDB in local mode, the authenticated
 * cloud API in cloud mode, the same snapshot/diff persistence, and the same
 * `compareContracts` engine. What changed is presentation — a single sub-toolbar,
 * a three-pane body, the commit timeline scrubber, the Diff Radar, the table and
 * 3D force-graph views, and the deep finding inspector.
 */
export function WorkbenchPage() {
  const searchParams = useSearchParams();
  const reviewParam = searchParams.get("review");
  const { data: session, status: sessionStatus } = useSession();

  const centerMode = useSpatialUIStore((state) => state.centerMode);
  const setCenterMode = useSpatialUIStore((state) => state.setCenterMode);
  const drawerOpen = useSpatialUIStore((state) => state.isWorkspaceDrawerOpen);
  const setDrawerOpen = useSpatialUIStore((state) => state.setWorkspaceDrawerOpen);
  const setSimStatus = useSpatialUIStore((state) => state.setSimStatus);
  const openModal = useSpatialUIStore((state) => state.openModal);

  const [mode, setMode] = useState<WorkbenchMode>("local");
  const [modeReady, setModeReady] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [snapshots, setSnapshots] = useState<ContractSnapshot[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<"before" | "after">("before");
  const [severity, setSeverity] = useState<ChangeSeverity | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [revisionIndex, setRevisionIndex] = useState(0);
  const [streaming, setStreaming] = useState(false);
  const [streamedCandidate, setStreamedCandidate] = useState<string | null>(null);
  const [flashIndex, setFlashIndex] = useState(-1);
  const [payloadBytes, setPayloadBytes] = useState(0);
  const [savedDiff, setSavedDiff] = useState<{
    summary: { breaking: number; warning: number; safe: number; info: number; total: number };
    changes: import("@/lib/contract/types").ContractChange[];
    workspaceId: string;
    baselineSnapshotId: string;
    candidateSnapshotId: string;
    direction: ContractDirection;
  } | null>(null);
  const [savedDiffStatus, setSavedDiffStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [ciExport, setCiExport] = useState<CIExportCredentials | null>(null);
  const [ciExportLoading, setCiExportLoading] = useState(false);
  const [reviewPreview, setReviewPreview] = useState<ReviewPreview | null>(null);
  const [reviewStatus, setReviewStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [reviewShareUrl, setReviewShareUrl] = useState<string | null>(null);
  const [reviewShareExpiry, setReviewShareExpiry] = useState<number | undefined>();
  const [reviewShareLoading, setReviewShareLoading] = useState(false);

  const inputRef = useRef<WorkbenchInputHandle>(null);
  const centerRef = useRef<WorkbenchCenterHandle>(null);
  const restoredMode = useRef(false);
  const loadedMode = useRef<WorkbenchMode | null>(null);
  const trafficTick = useRef(0);

  /* ---------- Mode preference + data load ---------------------------------- */

  useEffect(() => {
    if (sessionStatus === "loading" || restoredMode.current) return;
    restoredMode.current = true;
    if (readWorkbenchMode(browserPreferenceStorage()) === "cloud" && sessionStatus === "authenticated") setMode("cloud");
    setModeReady(true);
  }, [sessionStatus]);

  const refresh = useCallback(async () => {
    if (!modeReady) return;
    if (reviewParam) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (loadedMode.current !== mode) {
        setWorkspaces([]);
        setSnapshots([]);
        setActiveId(null);
      }
      const result = mode === "cloud" ? await loadCloudWorkbench() : await loadWorkbench();
      loadedMode.current = mode;
      setWorkspaces(result.workspaces);
      setSnapshots(result.snapshots);
      const preferred = readActiveWorkspaceId(browserPreferenceStorage(), mode);
      const selected = result.workspaces.find((workspace) => workspace.id === preferred) ?? result.workspaces[0] ?? null;
      setActiveId(selected?.id ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Local browser storage is unavailable.");
    } finally {
      setLoading(false);
    }
  }, [mode, modeReady, reviewParam]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!reviewParam) {
      setReviewStatus("idle");
      setReviewPreview(null);
      return;
    }
    let cancelled = false;
    setReviewPreview(null);
    setReviewStatus("loading");
    void (async () => {
      let preview: ReviewPreview | null = null;
      if (reviewParam.startsWith("z.")) {
        preview = await decodeReviewState(reviewParam);
      } else {
        const match = /^c\.([0-9a-f-]{36})\.([A-Za-z0-9_.-]{1,4096})$/i.exec(reviewParam);
        if (match) {
          const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(match[1])}/review`, { headers: { authorization: `Bearer ${match[2]}`, accept: "application/json" }, cache: "no-store" });
          if (response.ok) {
            const body = await response.json() as { review?: unknown };
            preview = parseReviewPayload(body.review);
          }
        }
      }
      if (cancelled) return;
      setReviewPreview(preview);
      setReviewStatus(preview ? "ready" : "error");
      if (!preview) setError("This shared review link is invalid, expired, or too large to preview.");
    })().catch(() => {
      if (cancelled) return;
      setReviewStatus("error");
      setError("Unable to load this shared review link.");
    });
    return () => { cancelled = true; };
  }, [reviewParam]);

  // Deep link: /workbench?view=graph
  useEffect(() => {
    if (searchParams.get("view") === "graph") setCenterMode("graph");
  }, [searchParams, setCenterMode]);

  const isReadOnlyReview = Boolean(reviewParam);
  const active = reviewPreview?.workspace ?? (workspaces.find((workspace) => workspace.id === activeId) ?? null);
  const baseline = reviewPreview?.baseline ?? (snapshots.find((snapshot) => snapshot.id === active?.baselineSnapshotId) ?? null);
  const candidate = reviewPreview?.candidate ?? (snapshots.find((snapshot) => snapshot.id === active?.candidateSnapshotId) ?? null);
  const hasComparison = Boolean(baseline && candidate);

  const shareReview = useCallback(async () => {
    if (!active || !baseline || !candidate) {
      toast.error("Load a baseline and candidate before sharing a review.");
      return;
    }
    setReviewShareLoading(true);
    try {
      const url = new URL("/workbench", window.location.origin);
      if (mode === "cloud" && sessionStatus === "authenticated" && !active.id.startsWith("review-")) {
        const response = await fetch(`/api/v1/workspaces/${encodeURIComponent(active.id)}/baseline/token`, {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "review" }),
        });
        if (!response.ok) throw new Error("Sign in and save both workspace snapshots before creating a signed review link.");
        const issued = await response.json() as { token: string; expiresAt: number };
        url.searchParams.set("review", `c.${active.id}.${issued.token}`);
        setReviewShareExpiry(issued.expiresAt);
      } else {
        const encoded = await encodeReviewState(buildReviewPayload(active, baseline, candidate));
        url.searchParams.set("review", encoded);
        setReviewShareExpiry(undefined);
      }
      if (url.toString().length > 8_000) throw new Error("The review link exceeds the supported URL size.");
      setReviewShareUrl(url.toString());
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to prepare a review link.");
    } finally {
      setReviewShareLoading(false);
    }
  }, [active, baseline, candidate, mode, sessionStatus]);

  const openCIExport = useCallback(async () => {
    if (mode !== "cloud" || sessionStatus !== "authenticated" || !active?.baselineSnapshotId) return;
    setCiExportLoading(true);
    try {
      const endpoint = `/api/v1/workspaces/${encodeURIComponent(active.id)}/baseline/token`;
      const [readResponse, promoteResponse, badgeResponse] = await Promise.all([
        fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "read" }) }),
        fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "promote" }) }),
        fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "badge" }) }),
      ]);
      if (!readResponse.ok || !promoteResponse.ok || !badgeResponse.ok) throw new Error("Unable to issue CI tokens. Check the workspace baseline and sign-in session.");
      type TokenResponse = {
        token: string;
        expiresAt: number;
        baseline: { revision: string; pathCount: number; lastPromotedAt: string | null; commitSha: string | null; actor: string | null };
      };
      const [readToken, promoteToken, badgeToken] = await Promise.all([
        readResponse.json() as Promise<TokenResponse>,
        promoteResponse.json() as Promise<TokenResponse>,
        badgeResponse.json() as Promise<TokenResponse>,
      ]);
      const endpointUrl = `https://driftmap.in/api/v1/workspaces/${encodeURIComponent(active.id)}/baseline`;
      const url = new URL(endpointUrl);
      url.searchParams.set("token", readToken.token);
      const badgeUrl = new URL(`https://driftmap.in/api/v1/workspaces/${encodeURIComponent(active.id)}/badge`);
      badgeUrl.searchParams.set("token", badgeToken.token);
      setCiExport({
        baselineUrl: url.toString(),
        promoteToken: promoteToken.token,
        badgeMarkdown: `![DriftMap contract path count](${badgeUrl.toString()})`,
        revision: badgeToken.baseline.revision,
        pathCount: badgeToken.baseline.pathCount,
        lastPromotedAt: badgeToken.baseline.lastPromotedAt,
        commitSha: badgeToken.baseline.commitSha,
        actor: badgeToken.baseline.actor,
        expiresAt: Math.min(readToken.expiresAt, promoteToken.expiresAt, badgeToken.expiresAt),
      });
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Unable to prepare the GitHub Action configuration.");
    } finally {
      setCiExportLoading(false);
    }
  }, [active, mode, sessionStatus]);
  const direction: ContractDirection = active?.direction ?? "response";
  const sampleWarnings = useMemo(() => sampleWarningsForSnapshots(baseline, candidate), [baseline, candidate]);

  /* ---------- Comparison --------------------------------------------------- */

  const localChanges = useMemo(() => {
    if ((mode === "cloud" && !reviewPreview) || !hasComparison) return { changes: [], error: null as string | null };
    try {
      return { changes: compareContracts(baseline!.contract, candidate!.contract, direction), error: null as string | null };
    } catch (reason) {
      return {
        changes: [],
        error: reason instanceof OpenApiComparisonError ? reason.message : "Unable to compare these contracts.",
      };
    }
  }, [mode, reviewPreview, hasComparison, baseline, candidate, direction]);

  useEffect(() => {
    if (mode === "local" && localChanges.error) setError(localChanges.error);
  }, [mode, localChanges.error]);

  useEffect(() => {
    if (reviewPreview || mode !== "cloud" || !active || !baseline || !candidate) {
      setSavedDiff(null);
      setSavedDiffStatus("idle");
      return;
    }
    let cancelled = false;
    setSavedDiff(null);
    setSavedDiffStatus("loading");
    void loadOrCreateCloudDiff(active.id, baseline.id, candidate.id, direction)
      .then((result) => {
        if (cancelled) return;
        setSavedDiff({
          summary: result.summary,
          changes: result.changes,
          workspaceId: active.id,
          baselineSnapshotId: baseline.id,
          candidateSnapshotId: candidate.id,
          direction,
        });
        setSavedDiffStatus("ready");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setSavedDiffStatus("error");
        setError(reason instanceof Error ? reason.message : "Unable to load the saved comparison.");
      });
    return () => { cancelled = true; };
  }, [reviewPreview, mode, active, baseline, candidate, direction]);

  const savedDiffMatches = Boolean(savedDiff)
    && savedDiff!.workspaceId === active?.id
    && savedDiff!.baselineSnapshotId === baseline?.id
    && savedDiff!.candidateSnapshotId === candidate?.id
    && savedDiff!.direction === direction;

  const changes = useMemo(
    () => (mode === "cloud" && !reviewPreview ? (savedDiffMatches ? savedDiff!.changes : []) : localChanges.changes),
    [mode, reviewPreview, savedDiffMatches, savedDiff, localChanges.changes],
  );

  /* ---------- Timeline ----------------------------------------------------- */

  /**
   * When both sides carry payload samples, the scrubber walks the *baseline*
   * contract through the engine's own change list, so each stop is a real
   * inferred contract. Otherwise the scrubber falls back to the workspace's
   * stored snapshots, which is the honest presentation for OpenAPI documents.
   */
  const sampleRevisions = useMemo(
    () => (hasComparison ? buildSnapshotTimeline(baseline, candidate, direction) : []),
    [hasComparison, baseline, candidate, direction],
  );

  const snapshotRevisions = useMemo(
    () => (hasComparison && (reviewPreview ? 2 : snapshots.length) > 1
      ? (reviewPreview ? [reviewPreview.baseline, reviewPreview.candidate] : snapshots)
          .filter((snapshot) => snapshot.workspaceId === active?.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      : []),
    [hasComparison, snapshots, reviewPreview, active?.id],
  );

  const usingSampleTimeline = sampleRevisions.length > 1;

  useEffect(() => {
    setRevisionIndex(usingSampleTimeline ? Math.max(sampleRevisions.length - 1, 0) : Math.max(snapshotRevisions.length - 1, 0));
  }, [usingSampleTimeline, sampleRevisions.length, snapshotRevisions.length, activeId]);

  const activeRevision = usingSampleTimeline ? sampleRevisions[revisionIndex] ?? null : null;

  /**
   * Previewing a stored snapshot commits it as the candidate, so the comparison,
   * the trees and the inspector all agree about what is being shown. The
   * workspace's saved candidate is restored by picking its node again.
   */
  const scrubToRevision = useCallback(async (index: number) => {
    setRevisionIndex(index);
    if (isReadOnlyReview) return;
    if (usingSampleTimeline) {
      DriftAudioSynth.playForSeverity(activeRevisionSeverity(sampleRevisions[index]));
      return;
    }
    const snapshot = snapshotRevisions[index];
    if (!snapshot || !active) return;
    if (snapshot.id === active.candidateSnapshotId) return;
    try {
      const updated: Workspace = { ...active, candidateSnapshotId: snapshot.id, updatedAt: new Date().toISOString() };
      if (mode === "cloud") await updateCloudWorkspace(active.id, { candidateSnapshotId: snapshot.id });
      else await saveWorkspace(updated);
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to switch the candidate snapshot.");
    }
  }, [isReadOnlyReview, usingSampleTimeline, sampleRevisions, snapshotRevisions, active, mode]);

  /* ---------- Findings ----------------------------------------------------- */

  const candidateVersion = usingSampleTimeline
    ? activeRevision?.version ?? candidate?.versionLabel ?? "candidate"
    : candidate?.versionLabel ?? "candidate";

  const findings = useMemo<Finding[]>(
    () => toFindings(changes, { direction, candidateVersion }),
    [changes, direction, candidateVersion],
  );

  const visibleFindings = useMemo(() => {
    const text = query.trim().toLowerCase();
    return findings.filter((finding) => {
      if (severity !== "all" && finding.severity !== severity) return false;
      if (!text) return true;
      return `${finding.pointer} ${finding.title} ${finding.ruleId} ${finding.explanation}`.toLowerCase().includes(text);
    });
  }, [findings, severity, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [activeId, revisionIndex, severity, query]);

  const selected = visibleFindings[selectedIndex] ?? visibleFindings[0] ?? null;

  const counts = useMemo(() => {
    const tally = { breaking: 0, warning: 0, safe: 0, info: 0 };
    for (const finding of findings) tally[finding.severity] += 1;
    return tally;
  }, [findings]);

  const diff = useMemo(
    () => (hasComparison ? buildDiff(baseline!.id, candidate!.id, direction, changes) : null),
    [hasComparison, baseline, candidate, direction, changes],
  );

  /* ---------- Live traffic simulation -------------------------------------- */

  useEffect(() => {
    setSimStatus(streaming ? "streaming" : "idle");
    return () => setSimStatus("idle");
  }, [streaming, setSimStatus]);

  useEffect(() => {
    if (!streaming) {
      setStreamedCandidate(null);
      setFlashIndex(-1);
      return;
    }
    const demo = getDemoSamples().candidate;
    const interval = window.setInterval(() => {
      trafficTick.current += 1;
      const tick = trafficTick.current;
      const sample = demo[tick % demo.length];
      // A muted copy of a real payload: the tick re-renders the table and plays
      // the finding's tone, but never rewrites the stored snapshot.
      setStreamedCandidate(JSON.stringify(sample.value, null, 2));
      setFlashIndex(visibleFindings.length > 0 ? tick % visibleFindings.length : -1);
      const finding = visibleFindings[tick % Math.max(visibleFindings.length, 1)];
      if (finding) DriftAudioSynth.playForSeverity(finding.severity);
    }, LIVE_TRAFFIC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [streaming, visibleFindings]);

  /* ---------- Actions ------------------------------------------------------ */

  const applyArtifact = useCallback(async (artifact: ImportArtifact, side: "before" | "after") => {
    setPendingAction("import");
    try {
      let workspace = active;
      if (!workspace) {
        workspace = mode === "cloud" ? await createCloudWorkspace("Untitled contract", "response") : createWorkspace("Untitled contract");
        if (mode === "local") await saveWorkspace(workspace);
        setWorkspaces((current) => [workspace!, ...current]);
        setActiveId(workspace.id);
      }
      const label = `${new Date().toISOString().slice(0, 10)} ${side === "before" ? "baseline" : "candidate"}`;
      const cloudResult = mode === "cloud"
        ? artifact.format === "openapi"
          ? await createCloudOpenApiSnapshot(workspace.id, label, JSON.stringify(artifact.contract.document), null, side === "before" ? "baseline" : "candidate")
          : await createCloudSnapshot(workspace.id, label, artifact.samples, null, side === "before" ? "baseline" : "candidate")
        : null;
      const snapshot = cloudResult?.snapshot ?? (artifact.format === "openapi"
        ? await createOpenApiSnapshot(workspace.id, artifact.contract, label, null)
        : await createSnapshot(workspace.id, artifact.samples, label, null));
      const updated: Workspace = {
        ...workspace,
        [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: snapshot.id,
        updatedAt: cloudResult?.workspace.updatedAt ?? new Date().toISOString(),
      };
      if (mode === "local") await saveWorkspace(updated);
      setSnapshots((current) => (mode === "cloud"
        ? [...current.filter((item) => item.id !== snapshot.id), snapshot]
        : [...current, snapshot]));
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      const scope = "kind" in snapshot.contract && snapshot.contract.kind === "openapi"
        ? `${snapshot.contract.operations.length} operations`
        : `${snapshot.samples.length} samples`;
      toast.success(`${side === "before" ? "Baseline" : "Candidate"} set — ${scope}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this snapshot.");
    } finally {
      setPendingAction(null);
    }
  }, [active, mode]);

  const applyFromEditor = useCallback((side: "before" | "after", text: string) => {
    const result = parseImportArtifact(text);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    void applyArtifact(result.artifact, side);
  }, [applyArtifact]);

  const onEditorFile = useCallback(async (side: "before" | "after", file: File) => {
    try {
      const text = await file.text();
      const result = parseImportArtifact(text, { yaml: /\.ya?ml$/i.test(file.name), source: "file", fileName: file.name });
      if (!result.ok) toast.error(result.message);
      else await applyArtifact(result.artifact, side);
    } catch {
      toast.error(`Unable to read “${file.name}”.`);
    }
  }, [applyArtifact]);

  const loadSamplePair = useCallback(async (workspaceOverride?: Workspace | null) => {
    if (pendingAction) return;
    setPendingAction("demo");
    try {
      let workspace = workspaceOverride ?? active;
      if (!workspace) {
        workspace = mode === "cloud" ? await createCloudWorkspace("Sample contract workspace", "event") : createWorkspace("Sample contract workspace", "event");
        if (mode === "local") await saveWorkspace(workspace);
      }
      const demo = getDemoSamples();
      if (mode === "cloud") {
        const base = await createCloudSnapshot(workspace.id, "2026-09 baseline", demo.baseline, "order-shipped-v1.json", "baseline");
        const cand = await createCloudSnapshot(workspace.id, "2026-10 candidate", demo.candidate, "order-shipped-v2.json", "candidate");
        const updated = { ...workspace, ...cand.workspace };
        setWorkspaces((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        setSnapshots((current) => [...current.filter((item) => item.id !== base.snapshot.id && item.id !== cand.snapshot.id), base.snapshot, cand.snapshot]);
        setActiveId(updated.id);
      } else {
        const base = await createSnapshot(workspace.id, demo.baseline, "2026-09 baseline", "order-shipped-v1.json");
        const cand = await createSnapshot(workspace.id, demo.candidate, "2026-10 candidate", "order-shipped-v2.json");
        const updated: Workspace = { ...workspace, baselineSnapshotId: base.id, candidateSnapshotId: cand.id, updatedAt: new Date().toISOString() };
        await saveWorkspace(updated);
        setSnapshots((current) => [...current, base, cand]);
        setWorkspaces((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        setActiveId(updated.id);
      }
      toast.success("Sample payloads loaded — a webhook migration with removed fields and newly required fields.");
    } catch (reason) {
      if (mode === "cloud") await refresh();
      setError(reason instanceof Error ? reason.message : "Unable to load the sample payloads.");
    } finally {
      setPendingAction(null);
    }
  }, [active, mode, pendingAction, refresh]);

  const loadExampleDiff = useCallback(async (presetId: ExampleDiffPresetId) => {
    if (pendingAction) return;
    const preset = getExampleDiffPreset(presetId);
    const baselineArtifact = parseImportArtifact(preset.baseline, { yaml: preset.yaml, source: "fixture", fileName: `${preset.id}-baseline.${preset.yaml ? "yaml" : "json"}` });
    const candidateArtifact = parseImportArtifact(preset.candidate, { yaml: preset.yaml, source: "fixture", fileName: `${preset.id}-candidate.${preset.yaml ? "yaml" : "json"}` });
    if (!baselineArtifact.ok || !candidateArtifact.ok) {
      toast.error("The selected example could not be parsed.");
      return;
    }

    setPendingAction("example-diff");
    try {
      let workspace = active;
      if (!workspace) {
        workspace = mode === "cloud"
          ? await createCloudWorkspace(preset.name, preset.direction)
          : createWorkspace(preset.name, preset.direction);
        if (mode === "local") await saveWorkspace(workspace);
      } else if (workspace.direction !== preset.direction) {
        workspace = mode === "cloud"
          ? await updateCloudWorkspace(workspace.id, { direction: preset.direction })
          : { ...workspace, direction: preset.direction, updatedAt: new Date().toISOString() };
      }

      const persist = async (artifact: ImportArtifact, side: "baseline" | "candidate", versionLabel: string, fileName: string) => {
        if (mode === "cloud") {
          return artifact.format === "openapi"
            ? (await createCloudOpenApiSnapshot(workspace!.id, versionLabel, JSON.stringify(artifact.contract.document), fileName, side)).snapshot
            : (await createCloudSnapshot(workspace!.id, versionLabel, artifact.samples, fileName, side)).snapshot;
        }
        return artifact.format === "openapi"
          ? createOpenApiSnapshot(workspace!.id, artifact.contract, versionLabel, fileName)
          : createSnapshot(workspace!.id, artifact.samples, versionLabel, fileName);
      };

      const baselineSnapshot = await persist(baselineArtifact.artifact, "baseline", preset.baselineLabel, `${preset.id}-baseline.${preset.yaml ? "yaml" : "json"}`);
      const candidateSnapshot = await persist(candidateArtifact.artifact, "candidate", preset.candidateLabel, `${preset.id}-candidate.${preset.yaml ? "yaml" : "json"}`);
      const updated: Workspace = {
        ...workspace,
        direction: preset.direction,
        baselineSnapshotId: baselineSnapshot.id,
        candidateSnapshotId: candidateSnapshot.id,
        updatedAt: new Date().toISOString(),
      };
      if (mode === "local") await saveWorkspace(updated);
      setSnapshots((current) => [...current.filter((snapshot) => snapshot.id !== baselineSnapshot.id && snapshot.id !== candidateSnapshot.id), baselineSnapshot, candidateSnapshot]);
      setWorkspaces((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      setActiveId(updated.id);
      setSeverity("all");
      setQuery("");
      setCenterMode("table");
      toast.success(`${preset.name} loaded. Review the findings or create a read-only share link.`);
    } catch (reason) {
      if (mode === "cloud") await refresh();
      setError(reason instanceof Error ? reason.message : "Unable to load the example contract diff.");
    } finally {
      setPendingAction(null);
    }
  }, [active, mode, pendingAction, refresh, setCenterMode]);

  const newWorkspace = useCallback(async () => {
    const name = window.prompt("Workspace name", "New contract workspace");
    if (!name?.trim()) return;
    setPendingAction("workspace");
    try {
      const workspace = mode === "cloud" ? await createCloudWorkspace(name.trim(), "response") : createWorkspace(name.trim());
      if (mode === "local") await saveWorkspace(workspace);
      setWorkspaces((current) => [workspace, ...current]);
      setActiveId(workspace.id);
      setDrawerOpen(false);
      toast.success(`Created “${workspace.name}”`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to create the ${mode} workspace.`);
    } finally {
      setPendingAction(null);
    }
  }, [mode, setDrawerOpen]);

  const renameWorkspace = useCallback(async (workspace: Workspace, name: string) => {
    if (!name.trim() || name.trim() === workspace.name) return;
    setPendingAction("workspace");
    try {
      const persisted = mode === "cloud"
        ? { ...workspace, ...(await renameCloudWorkspace(workspace.id, name.trim())) }
        : { ...workspace, name: name.trim(), updatedAt: new Date().toISOString() };
      if (mode === "local") await saveWorkspace(persisted);
      setWorkspaces((current) => current.map((item) => (item.id === persisted.id ? persisted : item)));
      toast.success("Workspace renamed");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename this workspace.");
    } finally {
      setPendingAction(null);
    }
  }, [mode]);

  const removeWorkspace = useCallback(async (workspace: Workspace) => {
    if (!window.confirm(`Delete “${workspace.name}”, all of its snapshots, and all saved comparisons? This cannot be undone.`)) return;
    setPendingAction("workspace");
    try {
      if (mode === "cloud") await deleteCloudWorkspace(workspace.id);
      else await deleteWorkspace(workspace.id);
      const remaining = workspaces.filter((item) => item.id !== workspace.id);
      setSnapshots((current) => current.filter((snapshot) => snapshot.workspaceId !== workspace.id));
      setWorkspaces(remaining);
      setActiveId(remaining[0]?.id ?? null);
      toast.success("Workspace deleted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this workspace.");
    } finally {
      setPendingAction(null);
    }
  }, [mode, workspaces]);

  const swapSides = useCallback(async () => {
    if (!active) return;
    setPendingAction("swap");
    try {
      const updated: Workspace = {
        ...active,
        baselineSnapshotId: active.candidateSnapshotId,
        candidateSnapshotId: active.baselineSnapshotId,
        updatedAt: new Date().toISOString(),
      };
      if (mode === "cloud") {
        const persisted = await updateCloudWorkspace(active.id, {
          baselineSnapshotId: updated.baselineSnapshotId,
          candidateSnapshotId: updated.candidateSnapshotId,
        });
        updated.updatedAt = persisted.updatedAt;
      } else {
        await saveWorkspace(updated);
      }
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Baseline and candidate swapped");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to swap snapshots.");
    } finally {
      setPendingAction(null);
    }
  }, [active, mode]);

  const changeDirection = useCallback(async (next: ContractDirection) => {
    if (!active) return;
    try {
      const updated: Workspace = { ...active, direction: next, updatedAt: new Date().toISOString() };
      if (mode === "cloud") {
        const persisted = await updateCloudWorkspace(active.id, { direction: next });
        updated.updatedAt = persisted.updatedAt;
      } else {
        await saveWorkspace(updated);
      }
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to change this contract direction.");
    }
  }, [active, mode]);

  const deleteSnapshotSide = useCallback(async (side: "before" | "after") => {
    if (!active) return;
    const snapshot = side === "before" ? baseline : candidate;
    if (!snapshot) return;
    if (!window.confirm(`Delete the ${side === "before" ? "baseline" : "candidate"} snapshot “${snapshot.versionLabel}”? This cannot be undone.`)) return;
    setPendingAction(`delete-${side}`);
    try {
      if (mode === "cloud") {
        await updateCloudWorkspace(active.id, side === "before" ? { baselineSnapshotId: null } : { candidateSnapshotId: null });
        await deleteCloudSnapshot(snapshot.id);
      } else {
        await deleteSnapshot(snapshot.id);
      }
      const updated: Workspace = {
        ...active,
        updatedAt: new Date().toISOString(),
        [side === "before" ? "baselineSnapshotId" : "candidateSnapshotId"]: null,
      };
      if (mode === "local") await saveWorkspace(updated);
      setSnapshots((current) => current.filter((item) => item.id !== snapshot.id));
      setWorkspaces((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Snapshot deleted");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to delete this snapshot.");
      await refresh();
    } finally {
      setPendingAction(null);
    }
  }, [active, baseline, candidate, mode, refresh]);

  const renameSnapshotLabel = useCallback(async (snapshot: ContractSnapshot, label: string) => {
    try {
      if (mode === "cloud") await renameCloudSnapshot(snapshot.id, label);
      else await renameSnapshot(snapshot.id, label);
      setSnapshots((current) => current.map((item) => (item.id === snapshot.id ? { ...item, versionLabel: label } : item)));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to rename this snapshot.");
    }
  }, [mode]);

  const chooseMode = useCallback((next: WorkbenchMode) => {
    if (next === mode) return;
    if (next === "cloud" && sessionStatus !== "authenticated") {
      writeWorkbenchMode(browserPreferenceStorage(), "local");
      toast.info("Sign in to use cloud workspaces. Local mode still works offline.");
      return;
    }
    writeWorkbenchMode(browserPreferenceStorage(), next);
    setMode(next);
  }, [mode, sessionStatus]);

  const selectWorkspace = useCallback((id: string) => {
    setActiveId(id);
    writeActiveWorkspaceId(browserPreferenceStorage(), mode, id);
  }, [mode]);

  /* ---------- Exports ------------------------------------------------------ */

  const markdownReport = useMemo(
    () => (active && baseline && candidate && diff ? buildMarkdownReport(active, baseline, candidate, diff) : null),
    [active, baseline, candidate, diff],
  );

  const copyMarkdown = useCallback(async () => {
    if (!markdownReport) {
      toast.error("This workspace does not have both snapshots yet, so there is no report to copy.");
      return;
    }
    try {
      await navigator.clipboard.writeText(markdownReport);
      toast.success("Markdown report copied for a PR comment");
    } catch {
      toast.error("Clipboard permission is unavailable in this browser. Select the text and copy it manually.");
    }
  }, [markdownReport]);

  const exportWorkspaceJSON = useCallback(() => {
    if (!active) {
      toast.error("There is no active workspace to export.");
      return;
    }
    try {
      const content = buildWorkspaceExport(active, baseline, candidate);
      const blob = new Blob([content], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "driftmap-workspace-export.json";
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Exported driftmap-workspace-export.json");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to export this workspace.");
    }
  }, [active, baseline, candidate]);

  const copyPath = useCallback(async (pointer: string) => {
    try {
      await navigator.clipboard.writeText(pointer);
      toast.success("Path copied");
    } catch {
      toast.error("Clipboard permission is unavailable in this browser.");
    }
  }, []);

  const runInferAndCompare = useCallback(() => {
    const before = inputRef.current?.read("before") ?? "";
    const after = inputRef.current?.read("after") ?? "";
    if (before.trim()) applyFromEditor("before", before);
    if (after.trim()) applyFromEditor("after", after);
    DriftAudioSynth.playTick(1080);
  }, [applyFromEditor]);

  const formatEditors = useCallback(() => {
    const result = inputRef.current?.format("before") ?? inputRef.current?.format("after");
    toast[result ? "success" : "info"](result ?? "Both editors are empty or contain invalid JSON.");
  }, []);

  /* ---------- Keyboard shortcuts ------------------------------------------- */

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target) && (["INPUT", "TEXTAREA", "SELECT"].includes(target!.tagName) || target!.isContentEditable);
      if (editing) return;
      const modifier = event.ctrlKey || event.metaKey;
      if (modifier && event.key.toLowerCase() === "e") {
        event.preventDefault();
        void copyMarkdown();
      } else if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        exportWorkspaceJSON();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [copyMarkdown, exportWorkspaceJSON]);

  /* ---------- Command palette --------------------------------------------- */

  const workbenchCommands = isReadOnlyReview ? [] : [
      { id: "wb-graph", title: "Workbench: switch to 3D force graph view", category: "3D Graph", shortcut: "V G", keywords: ["3d", "graph", "force", "orbital"], run: () => setCenterMode("graph") },
      { id: "wb-table", title: "Workbench: switch to table grid view", category: "View", shortcut: "V T", keywords: ["table", "grid", "list"], run: () => setCenterMode("table") },
      { id: "wb-format", title: "Format the baseline and candidate JSON", category: "Workbench", keywords: ["format", "pretty", "json"], run: formatEditors },
      { id: "wb-infer", title: "Infer and compare the current editors", category: "Workbench", keywords: ["infer", "compare", "run", "analyse"], run: runInferAndCompare },
      { id: "wb-sample", title: "Load the sample payload pair", category: "Presets", keywords: ["sample", "demo", "fixture", "preset"], run: () => void loadSamplePair() },
      { id: "wb-swap", title: "Swap baseline and candidate", category: "Workbench", keywords: ["swap", "reverse", "sides"], run: () => void swapSides() },
      { id: "wb-copy-md", title: "Copy the PR Markdown contract report", category: "Export", shortcut: "⌘ C", keywords: ["markdown", "report", "copy", "pr"], run: () => void copyMarkdown() },
      { id: "wb-export", title: "Export the workspace as JSON", category: "Export", shortcut: "⌘ S", keywords: ["export", "json", "backup", "download"], run: exportWorkspaceJSON },
      { id: "wb-drawer", title: "Toggle the workspace and snapshot browser", category: "View", keywords: ["workspace", "snapshot", "sidebar", "drawer"], run: () => setDrawerOpen(!drawerOpen) },
      { id: "wb-filters-reset", title: "Clear the severity and path filters", category: "Filter", keywords: ["filter", "clear", "reset", "all"], run: () => { setSeverity("all"); setQuery(""); } },
      ...(["breaking", "warning", "safe", "info"] as const)
        .filter((tone) => counts[tone] > 0)
        .map((tone) => ({
          id: `wb-filter-${tone}`,
          title: `Filter findings: ${tone} only (${counts[tone]})`,
          category: "Filter",
          keywords: ["filter", tone],
          run: () => setSeverity(tone),
        })),
      { id: "wb-tokens", title: "Inspect the Obsidian CSS design tokens", category: "Theme", shortcut: "T", keywords: ["tokens", "css", "theme"], run: () => openModal("tokens") },
      { id: "wb-shortcuts", title: "Show keyboard shortcuts", category: "Help", shortcut: "?", keywords: ["keyboard", "shortcuts", "help"], run: () => openModal("shortcuts") },
  ];
  useRegisteredCommands(
    "workbench",
    workbenchCommands,
    [isReadOnlyReview, counts, drawerOpen, setCenterMode, formatEditors, runInferAndCompare, loadSamplePair, swapSides, copyMarkdown, exportWorkspaceJSON, setDrawerOpen, openModal],
  );

  const payloadBytesReported = useCallback((bytes: number) => setPayloadBytes(bytes), []);

  /* ---------- Render ------------------------------------------------------- */

  return (
    <main id="view-workbench" className="relative z-10 flex-1 flex flex-col min-w-0">
      <h1 className="sr-only">API contract workbench</h1>
      {!isReadOnlyReview && <WorkbenchToolbar
        workspaces={workspaces}
        active={active}
        mode={mode}
        onChangeMode={chooseMode}
        onSelectWorkspace={selectWorkspace}
        onOpenDrawer={() => setDrawerOpen(true)}
        onFormatJSON={formatEditors}
        onInferAndCompare={runInferAndCompare}
        streaming={streaming}
        onToggleStreaming={() => setStreaming((current) => !current)}
        payloadBytes={payloadBytes}
        onCopyMarkdown={() => void copyMarkdown()}
        onExportCI={() => void openCIExport()}
        onExportJSON={exportWorkspaceJSON}
        onShareReview={() => void shareReview()}
        sharingReview={reviewShareLoading}
        pending={pendingAction !== null || ciExportLoading}
        onLoadExampleDiff={(preset) => void loadExampleDiff(preset)}
        cloudStatus={sessionStatus === "authenticated" ? (session?.user?.email ?? "signed in") : null}
        onSignIn={() => { window.location.href = "/signin"; }}
      />}

      {isReadOnlyReview && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sky-400/20 bg-sky-400/[0.04] px-4 py-3 text-xs text-sky-100 sm:px-6" role="status">
          <span>{reviewStatus === "loading" ? "Loading shared contract review…" : reviewStatus === "error" ? "Shared review unavailable" : `Read-only review · ${active?.name ?? "Contract workspace"} · payloads are not editable`}</span>
          {reviewPreview && <span className="font-mono text-[10px] text-sky-200/70">{baseline?.versionLabel} → {candidate?.versionLabel}</span>}
        </div>
      )}

      {sampleWarnings.length > 0 && (
        <div role="status" className="px-4 sm:px-6 py-2 bg-amber-950/40 border-b border-amber-500/30 text-xs font-mono text-amber-200">
          <strong>Thin sample evidence.</strong>{" "}
          {sampleWarnings.map((warning) => warning.message).join(" ")}
        </div>
      )}

      {error && (
        <div className="px-4 sm:px-6 py-2 bg-rose-950/40 border-b border-rose-500/30 text-xs font-mono text-rose-200 flex items-center justify-between gap-3">
          <span className="min-w-0">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-rose-200 hover:text-white shrink-0">Dismiss</button>
        </div>
      )}

      {loading || reviewStatus === "loading" ? (
        <div className="flex-1 grid place-items-center p-10" aria-busy="true">
          <p className="font-mono text-xs text-[#5E606E]" role="status" aria-live="polite">
            {mode === "cloud" ? "Loading cloud workspaces…" : "Opening the local workspace…"}
          </p>
        </div>
      ) : !hasComparison ? (
        <WorkbenchEmptyState
          baseline={baseline}
          candidate={candidate}
          onLoadSamplePair={() => void loadSamplePair()}
          onImportBaseline={() => applyFromEditor("before", inputRef.current?.read("before") ?? "")}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
      ) : null}

      {/* 3-pane body stays mounted so the editors keep their drafts while the
          empty state is showing above it. */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.08]">
        <WorkbenchInputPane
          ref={inputRef}
          baseline={baseline}
          candidate={candidate}
          activeSide={activeSide}
          onActiveSideChange={setActiveSide}
          onApply={applyFromEditor}
          onFile={(side, file) => void onEditorFile(side, file)}
          streamedCandidate={streamedCandidate}
          onDraftSizeChange={payloadBytesReported}
          readOnly={isReadOnlyReview}
        />

        <WorkbenchCenter
          ref={centerRef}
          findings={findings}
          revisions={usingSampleTimeline ? sampleRevisions : snapshotRevisionStops(snapshotRevisions)}
          activeRevisionIndex={revisionIndex}
          onRevisionChange={(index) => void scrubToRevision(index)}
          candidateVersion={candidateVersion}
          mode={centerMode}
          onModeChange={setCenterMode}
          severity={severity}
          onSeverityChange={setSeverity}
          query={query}
          onQueryChange={setQuery}
          selectedIndex={selectedIndex}
          onSelectIndex={setSelectedIndex}
          flashIndex={flashIndex}
          recomputing={mode === "cloud" && savedDiffStatus === "loading"}
        />

        <WorkbenchInspector
          finding={selected}
          candidateVersion={candidateVersion}
          index={selectedIndex}
          total={visibleFindings.length}
          onCopyReport={() => void copyMarkdown()}
          onCopyPath={(pointer) => void copyPath(pointer)}
        />
      </div>

      {!isReadOnlyReview && <WorkbenchDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        workspaces={workspaces}
        snapshots={snapshots}
        active={active}
        mode={mode}
        pending={pendingAction !== null}
        onSelectWorkspace={(id) => { selectWorkspace(id); setDrawerOpen(false); }}
        onNewWorkspace={() => void newWorkspace()}
        onRenameWorkspace={(workspace, name) => void renameWorkspace(workspace, name)}
        onDeleteWorkspace={(workspace) => void removeWorkspace(workspace)}
        onSwap={() => void swapSides()}
        onDirection={(next) => void changeDirection(next)}
        onRenameSnapshot={(snapshot, label) => void renameSnapshotLabel(snapshot, label)}
        onDeleteSide={(side) => void deleteSnapshotSide(side)}
        onLoadSamplePair={() => void loadSamplePair()}
      />}

      <footer className="border-t border-white/[0.08] bg-[#0A0A0D] px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-[#5E606E]">
        <span>
          {mode === "cloud"
            ? `Cloud mode · snapshots are saved to your account${session?.user?.email ? ` (${session.user.email})` : ""}`
            : "Local mode · IndexedDB storage · cloud sync is off"}
        </span>
        <span className="flex flex-wrap items-center gap-3">
          {!isReadOnlyReview && <span>⌘K commands · ↑↓ / JK rows · ⌘C report · ⌘S export</span>}
          {!isReadOnlyReview && <button type="button" onClick={() => setDrawerOpen(true)} className="text-[#9496A1] hover:text-white transition-colors">
            Workspaces <Images size={11} className="inline" aria-hidden="true" />
          </button>}
        </span>
      </footer>

      <ToastRegion />
      {ciExport && <CIExportModal credentials={ciExport} onClose={() => setCiExport(null)} />}
      {reviewShareUrl && <ReviewLinkModal url={reviewShareUrl} expiresAt={reviewShareExpiry} onClose={() => setReviewShareUrl(null)} />}
    </main>
  );
}

function activeRevisionSeverity(revision: import("@/lib/driftmap/presentation").TimelineRevision | undefined): ChangeSeverity {
  return revision?.tone ?? "info";
}

/**
 * Adapter so a list of stored snapshots satisfies `TimelineRevision` for the
 * scrubber. Only the display fields are populated; the scrubber never reads the
 * contract payload from these stops.
 */
function snapshotRevisionStops(snapshots: readonly ContractSnapshot[]): import("@/lib/driftmap/presentation").TimelineRevision[] {
  return snapshots.map((snapshot, index) => ({
    index,
    version: snapshot.versionLabel,
    fingerprint: "snapshot",
    summary: snapshot.sourceFileName ?? "stored snapshot",
    applied: [],
    delta: [],
    changes: [],
    diff: buildDiff("", "", "response", []),
    dotClass: "bg-sky-400",
    tone: "info" as ChangeSeverity,
    baselineSamples: [],
    candidateSamples: [],
    baselineContract: snapshot.contract as never,
    candidateContract: snapshot.contract as never,
  }));
}
