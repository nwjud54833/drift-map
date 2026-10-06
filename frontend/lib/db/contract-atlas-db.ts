import Dexie, { type Table } from "dexie";
import type { ContractSnapshot, ContractDirection, JsonObject, PayloadSample, Workspace } from "@/lib/contract/types";
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

function asJsonObject(value: unknown): JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as JsonObject) : {};
}

function fixtureSamples(values: readonly unknown[]): PayloadSample[] {
  return values.map((entry, index) => {
    const value = asJsonObject(entry);
    const data = asJsonObject(value.data);
    const orderId = typeof data.order_id === "string" ? data.order_id : `Sample ${index + 1}`;
    return { id: `fixture_${index + 1}`, label: `order.shipped · ${orderId}`, value, source: "fixture", capturedAt: demoDate };
  });
}

export async function seedDemo(): Promise<void> {
  if (await db.workspaces.count()) return;
  const workspace: Workspace = { id: "ws_demo", name: "Order Webhook Migration", direction: "event", baselineSnapshotId: "snap_orders_v1", candidateSnapshotId: "snap_orders_v2", createdAt: demoDate, updatedAt: demoDate };
  const makeSnapshot = (id: string, label: string, values: readonly unknown[], file: string): ContractSnapshot => {
    const samples = fixtureSamples(values).map((sample, index) => ({ ...sample, id: `${id}_${index + 1}` }));
    return { id, workspaceId: workspace.id, versionLabel: label, notes: "Sample webhook payloads for a money-object migration.", sourceFileName: file, samples, contract: inferContract(samples, demoDate), createdAt: demoDate };
  };
  await db.transaction("rw", db.workspaces, db.snapshots, async () => {
    await db.workspaces.put(workspace);
    await db.snapshots.bulkPut([makeSnapshot("snap_orders_v1", "2026-09 baseline", fixture.baseline, "order-shipped-v1.json"), makeSnapshot("snap_orders_v2", "2026-10 candidate", fixture.candidate, "order-shipped-v2.json")]);
  });
}

/** Import the bundled demo payloads into an existing workspace as its baseline and candidate. */
export async function importDemoFixture(workspace: Workspace): Promise<{ workspace: Workspace; baseline: ContractSnapshot; candidate: ContractSnapshot }> {
  const baseline = await createSnapshot(workspace.id, fixtureSamples(fixture.baseline), "2026-09 baseline", "order-shipped-v1.json");
  const candidate = await createSnapshot(workspace.id, fixtureSamples(fixture.candidate), "2026-10 candidate", "order-shipped-v2.json");
  const updated: Workspace = { ...workspace, baselineSnapshotId: baseline.id, candidateSnapshotId: candidate.id, updatedAt: new Date().toISOString() };
  await saveWorkspace(updated);
  return { workspace: updated, baseline, candidate };
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

export async function renameSnapshot(id: string, versionLabel: string): Promise<void> {
  const snapshot = await db.snapshots.get(id);
  if (!snapshot) return;
  await db.snapshots.put({ ...snapshot, versionLabel });
}
