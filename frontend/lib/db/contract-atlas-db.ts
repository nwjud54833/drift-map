import Dexie, { type Table } from "dexie";
import type { ContractSnapshot, ContractDirection, PayloadSample, Workspace } from "@/lib/contract/types";
import { inferContract } from "@/lib/contract/infer";
import fixture from "@/fixtures/order-shipped.fixture.json";

class ContractAtlasDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  snapshots!: Table<ContractSnapshot, string>;
  constructor() {
    super("contract-atlas");
    this.version(1).stores({ workspaces: "id, updatedAt, createdAt", snapshots: "id, workspaceId, createdAt, versionLabel" });
  }
}
export const db = new ContractAtlasDatabase();
const demoDate = "2026-10-07T09:00:00.000Z";

export async function loadWorkbench(): Promise<{ workspaces: Workspace[]; snapshots: ContractSnapshot[] }> {
  if (!(await db.workspaces.count())) await seedDemo();
  const workspaces = await db.workspaces.orderBy("updatedAt").reverse().toArray();
  const snapshots = await db.snapshots.toArray();
  for (const snapshot of snapshots) {
    if (snapshot.contract.inferenceVersion !== 1) {
      snapshot.contract = inferContract(snapshot.samples);
      await db.snapshots.put(snapshot);
    }
  }
  return { workspaces, snapshots };
}

export async function seedDemo(): Promise<void> {
  if (await db.workspaces.count()) return;
  const workspace: Workspace = { id: "ws_demo", name: "Order Webhook Migration", direction: "event", baselineSnapshotId: "snap_orders_v1", candidateSnapshotId: "snap_orders_v2", createdAt: demoDate, updatedAt: demoDate };
  const makeSnapshot = (id: string, label: string, values: typeof fixture.baseline, file: string): ContractSnapshot => {
    const samples: PayloadSample[] = values.map((value, index) => ({ id: `${id}_${index + 1}`, label: `order.shipped · ${String(value.data.order_id)}`, value, source: "fixture", capturedAt: demoDate }));
    return { id, workspaceId: workspace.id, versionLabel: label, notes: "Sample webhook payloads for a money-object migration.", sourceFileName: file, samples, contract: inferContract(samples, demoDate), createdAt: demoDate };
  };
  await db.transaction("rw", db.workspaces, db.snapshots, async () => {
    await db.workspaces.put(workspace);
    await db.snapshots.bulkPut([makeSnapshot("snap_orders_v1", "2026-09 baseline", fixture.baseline, "order-shipped-v1.json"), makeSnapshot("snap_orders_v2", "2026-10 candidate", fixture.candidate, "order-shipped-v2.json")]);
  });
}

export async function saveWorkspace(workspace: Workspace): Promise<void> { await db.workspaces.put(workspace); }
export async function saveSnapshot(snapshot: ContractSnapshot): Promise<void> { await db.snapshots.put(snapshot); }
export async function deleteWorkspace(id: string): Promise<void> { await db.transaction("rw", db.workspaces, db.snapshots, async () => { await db.snapshots.where("workspaceId").equals(id).delete(); await db.workspaces.delete(id); }); }
export async function getSnapshot(id: string | null): Promise<ContractSnapshot | null> { return id ? (await db.snapshots.get(id)) ?? null : null; }
export function createWorkspace(name: string, direction: ContractDirection = "response"): Workspace {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), name, direction, baselineSnapshotId: null, candidateSnapshotId: null, createdAt: now, updatedAt: now };
}
export async function createSnapshot(workspaceId: string, samples: PayloadSample[], versionLabel: string, sourceFileName: string | null): Promise<ContractSnapshot> {
  const snapshot: ContractSnapshot = { id: crypto.randomUUID(), workspaceId, versionLabel, notes: "", sourceFileName, samples: samples.map((sample) => ({ ...sample, id: crypto.randomUUID() })), contract: inferContract(samples), createdAt: new Date().toISOString() };
  await saveSnapshot(snapshot);
  return snapshot;
}
