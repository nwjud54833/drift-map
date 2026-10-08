import type { ContractSnapshot, Workspace } from "@/lib/contract/types";

function sourceFromDb(source: string): ContractSnapshot["samples"][number]["source"] {
  return source === "workspace_import" ? "workspace-import" : source as ContractSnapshot["samples"][number]["source"];
}

export async function loadCloudWorkbench(): Promise<{ workspaces: Workspace[]; snapshots: ContractSnapshot[] }> {
  const response = await fetch("/api/v1/workspaces", { cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "Sign in to use Cloud mode." : "Unable to load cloud workspaces.");
  const list = await response.json() as { workspaces: Array<Record<string, unknown>> };
  const details = await Promise.all(list.workspaces.map(async (item) => {
    const detailResponse = await fetch(`/api/v1/workspaces/${String(item.id)}`, { cache: "no-store" });
    if (!detailResponse.ok) throw new Error("Unable to load a cloud workspace.");
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
  if (!response.ok) throw new Error("Unable to create the cloud workspace.");
  return (await response.json() as { workspace: Workspace }).workspace;
}

export async function createCloudSnapshot(workspaceId: string, versionLabel: string, samples: ContractSnapshot["samples"], sourceFileName: string | null): Promise<void> {
  const response = await fetch(`/api/v1/workspaces/${workspaceId}/snapshots`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ versionLabel, sourceFileName, payloads: samples.map((sample) => sample.value) }) });
  if (!response.ok) throw new Error("Unable to save the cloud snapshot.");
}
