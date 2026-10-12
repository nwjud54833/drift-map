import type { ContractChange, ContractDirection, ContractSnapshot, DiffSummary, Workspace } from "@/lib/contract/types";

async function responseError(response: Response, fallback: string): Promise<string> {
  if (response.status === 401) return "Your session expired. Sign in again to use Cloud mode.";
  try {
    const result = await response.json() as { error?: unknown };
    if (typeof result.error === "string" && result.error.trim()) return result.error;
  } catch { /* Use the safe fallback for non-JSON responses. */ }
  return fallback;
}

function sourceFromDb(source: string): ContractSnapshot["samples"][number]["source"] {
  return source === "workspace_import" ? "workspace-import" : source as ContractSnapshot["samples"][number]["source"];
}

export async function loadCloudWorkbench(): Promise<{ workspaces: Workspace[]; snapshots: ContractSnapshot[] }> {
  const response = await fetch("/api/v1/workspaces", { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in to use Cloud mode." : await responseError(response, "Unable to load cloud workspaces."));
  const list = await response.json() as { workspaces: Array<Record<string, unknown>> };
  const details = await Promise.all(list.workspaces.map(async (item) => {
    const detailResponse = await fetch(`/api/v1/workspaces/${String(item.id)}`, { cache: "no-store" });
    if (!detailResponse.ok) throw new Error(await responseError(detailResponse, detailResponse.status === 404 ? "A workspace was removed while it was loading. Refresh to continue." : "Unable to load a cloud workspace."));
    return (await detailResponse.json() as { workspace: Record<string, unknown> }).workspace;
  }));
  const workspaces: Workspace[] = details.map((item) => ({
    id: String(item.id), name: String(item.name), direction: item.direction as Workspace["direction"],
    baselineSnapshotId: item.baselineSnapshotId as string | null, candidateSnapshotId: item.candidateSnapshotId as string | null,
    createdAt: String(item.createdAt), updatedAt: String(item.updatedAt),
  }));
  const snapshots: ContractSnapshot[] = details.flatMap((item) => {
    const rawSnapshots = (item.snapshots as Array<Record<string, unknown>> | undefined) ?? [];
    return rawSnapshots.map((snapshot) => {
      const rawSamples = (snapshot.samples as Array<Record<string, unknown>> | undefined) ?? [];
      return {
        id: String(snapshot.id), workspaceId: String(snapshot.workspaceId), versionLabel: String(snapshot.versionLabel),
        notes: String(snapshot.notes ?? ""), sourceFileName: snapshot.sourceFileName as string | null,
        contract: snapshot.contract as ContractSnapshot["contract"], createdAt: String(snapshot.createdAt),
        samples: rawSamples.map((sample) => ({
          id: String(sample.id), label: String(sample.label), value: sample.value as ContractSnapshot["samples"][number]["value"],
          source: sourceFromDb(String(sample.source)), capturedAt: String(sample.capturedAt),
        })),
      };
    });
  });
  return { workspaces, snapshots };
}

export async function createCloudWorkspace(name: string, direction: Workspace["direction"]): Promise<Workspace> {
  const response = await fetch("/api/v1/workspaces", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, direction }) });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in to create cloud workspaces." : "Unable to create the cloud workspace.");
  return (await response.json() as { workspace: Workspace }).workspace;
}

async function patchWorkspace(workspaceId: string, data: Record<string, unknown>): Promise<Workspace> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to use Cloud mode." : response.status === 404 ? "Cloud workspace not found." : "Unable to update the cloud workspace.");
  return (await response.json() as { workspace: Workspace }).workspace;
}

export function renameCloudWorkspace(workspaceId: string, name: string): Promise<Workspace> {
  return patchWorkspace(workspaceId, { name });
}

export function updateCloudWorkspace(workspaceId: string, data: Partial<Pick<Workspace, "direction" | "baselineSnapshotId" | "candidateSnapshotId">>): Promise<Workspace> {
  return patchWorkspace(workspaceId, data);
}

export async function deleteCloudWorkspace(workspaceId: string): Promise<void> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to use Cloud mode." : response.status === 404 ? "Cloud workspace not found." : "Unable to delete the cloud workspace.");
}

export async function renameCloudSnapshot(snapshotId: string, versionLabel: string): Promise<ContractSnapshot> {
  const response = await fetch(`/api/v1/snapshots/${snapshotId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionLabel }) });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to use Cloud mode." : response.status === 404 ? "Cloud snapshot not found." : "Unable to rename the cloud snapshot.");
  return (await response.json() as { snapshot: ContractSnapshot }).snapshot;
}

export async function deleteCloudSnapshot(snapshotId: string): Promise<void> {
  const response = await fetch(`/api/v1/snapshots/${snapshotId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to use Cloud mode." : response.status === 404 ? "Cloud snapshot not found." : "Unable to delete the cloud snapshot.");
}

export async function createCloudSnapshot(workspaceId: string, versionLabel: string, samples: ContractSnapshot["samples"], sourceFileName: string | null, side: "baseline" | "candidate"): Promise<{ snapshot: ContractSnapshot; workspace: Pick<Workspace, "id" | "baselineSnapshotId" | "candidateSnapshotId" | "updatedAt"> }> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/snapshots`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionLabel, sourceFileName, side, payloads: samples.map((sample) => sample.value) }) });
  if (!response.ok) throw new Error(response.status === 401 ? "Your session expired. Sign in again to use Cloud mode." : response.status === 404 ? "Cloud workspace not found." : "Unable to save the cloud snapshot.");
  return await response.json() as { snapshot: ContractSnapshot; workspace: Pick<Workspace, "id" | "baselineSnapshotId" | "candidateSnapshotId" | "updatedAt"> };
}

export async function createCloudOpenApiSnapshot(workspaceId: string, versionLabel: string, documentText: string, sourceFileName: string | null, side: "baseline" | "candidate"): Promise<{ snapshot: ContractSnapshot; workspace: Pick<Workspace, "id" | "baselineSnapshotId" | "candidateSnapshotId" | "updatedAt"> }> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/snapshots`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionLabel, sourceFileName, side, documentText }) });
  if (!response.ok) {
    let message = "Unable to save the OpenAPI snapshot.";
    try { const result = await response.json() as { error?: string }; if (typeof result.error === "string") message = result.error; } catch { /* keep safe generic message */ }
    throw new Error(response.status === 401 ? "Your session expired. Sign in again to use Cloud mode." : response.status === 404 ? "Cloud workspace not found." : message);
  }
  return await response.json() as { snapshot: ContractSnapshot; workspace: Pick<Workspace, "id" | "baselineSnapshotId" | "candidateSnapshotId" | "updatedAt"> };
}

export async function loadOrCreateCloudDiff(workspaceId: string, baselineSnapshotId: string, candidateSnapshotId: string, direction: ContractDirection): Promise<{ id: string; summary: DiffSummary; changes: ContractChange[] }> {
  const query = new URLSearchParams({ workspaceId, baselineSnapshotId, candidateSnapshotId, direction });
  let response = await fetch(`/api/v1/diffs?${query}`, { cache: "no-store" });
  if (response.status === 404) {
    response = await fetch("/api/v1/diffs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ workspaceId, baselineSnapshotId, candidateSnapshotId }) });
  }
  if (!response.ok) {
    if (response.status === 401) throw new Error("Your session expired. Sign in again to use Cloud mode.");
    let message = "Unable to load the saved comparison.";
    try { const result = await response.json() as { error?: string }; if (typeof result.error === "string") message = result.error; } catch { /* keep generic safe message */ }
    throw new Error(message);
  }
  const result = await response.json() as { diff: { id: string; summary: DiffSummary; changes: Array<Record<string, unknown>> } };
  return {
    id: result.diff.id,
    summary: result.diff.summary,
    changes: result.diff.changes.map((row) => ({
      id: String(row.id), pointer: String(row.pointer), kind: String(row.kind).replaceAll("_", "-") as ContractChange["kind"],
      severity: row.severity as ContractChange["severity"], title: String(row.title), explanation: String(row.explanation),
      before: (row.beforeNode ?? null) as ContractChange["before"], after: (row.afterNode ?? null) as ContractChange["after"],
    })),
  };
}

