import { beforeEach, describe, expect, it, vi } from "vitest";
import { inferContract } from "@/lib/contract/infer";
import { parsePayloadText } from "@/lib/contract/parse";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  consumeCloudRun: vi.fn(),
  getUsage: vi.fn(),
  workspaceFindFirst: vi.fn(),
  workspaceCreate: vi.fn(),
  workspaceUpdate: vi.fn(),
  snapshotCreate: vi.fn(),
  snapshotFindFirst: vi.fn(),
  diffCreate: vi.fn(),
  diffUpsert: vi.fn(),
  diffFindUnique: vi.fn(),
  changeDeleteMany: vi.fn(),
  changeCreateMany: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/plans/usage", () => ({ consumeCloudRun: mocks.consumeCloudRun, getUsage: mocks.getUsage }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspace: { findFirst: mocks.workspaceFindFirst, create: mocks.workspaceCreate, update: mocks.workspaceUpdate },
    contractSnapshot: { create: mocks.snapshotCreate, findFirst: mocks.snapshotFindFirst },
    contractDiff: { create: mocks.diffCreate, upsert: mocks.diffUpsert, findUnique: mocks.diffFindUnique },
    contractChange: { deleteMany: mocks.changeDeleteMany, createMany: mocks.changeCreateMany },
    $transaction: mocks.transaction,
  },
}));

import { POST as postDiff } from "@/app/api/v1/diffs/route";
import { GET as getUsage } from "@/app/api/v1/usage/route";

const workspaceId = "6f9619ff-8b86-4d3a-a5a5-6d2a7e5b6c10";
const baselineId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const candidateId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const freeUsage = { plan: "free" as const, monthKey: "2026-11", cloudRuns: 50, limit: 50, remaining: 0 };

function post(body: unknown) {
  return new Request("http://localhost/api/v1/diffs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function meteredPayload() {
  return {
    workspaceId,
    direction: "response",
    baseline: { label: "main", payloads: [{ id: 1 }] },
    candidate: { label: "branch", payloads: [{ id: 1, status: "ready" }] },
  };
}

const storedContract = inferContract(parsePayloadText(JSON.stringify([{ id: 1 }]), { source: "paste" }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
  mocks.consumeCloudRun.mockResolvedValue({ ok: true, usage: { ...freeUsage, cloudRuns: 1, remaining: 49 } });
  mocks.getUsage.mockResolvedValue({ ...freeUsage, cloudRuns: 3, remaining: 47 });
  mocks.workspaceFindFirst.mockResolvedValue({ id: workspaceId, direction: "response" });
  mocks.workspaceCreate.mockResolvedValue({ id: workspaceId });
  mocks.workspaceUpdate.mockResolvedValue({ id: workspaceId });
  mocks.snapshotCreate
    .mockResolvedValueOnce({ id: baselineId })
    .mockResolvedValueOnce({ id: candidateId });
  mocks.snapshotFindFirst
    .mockResolvedValueOnce({ id: baselineId, contract: storedContract })
    .mockResolvedValueOnce({ id: candidateId, contract: storedContract });
  mocks.diffCreate.mockResolvedValue({ id: "created-diff" });
  mocks.diffUpsert.mockResolvedValue({ id: "saved-diff" });
  mocks.changeDeleteMany.mockResolvedValue({ count: 0 });
  mocks.changeCreateMany.mockResolvedValue({ count: 0 });
  mocks.diffFindUnique.mockResolvedValue({ id: "saved-diff", changes: [] });
  const tx = {
    workspace: { findFirst: mocks.workspaceFindFirst, create: mocks.workspaceCreate, update: mocks.workspaceUpdate },
    contractSnapshot: { create: mocks.snapshotCreate, findFirst: mocks.snapshotFindFirst },
    contractDiff: { create: mocks.diffCreate, upsert: mocks.diffUpsert, findUnique: mocks.diffFindUnique },
    contractChange: { deleteMany: mocks.changeDeleteMany, createMany: mocks.changeCreateMany },
  };
  mocks.transaction.mockImplementation(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx));
});

describe("cloud comparison usage enforcement", () => {
  it("returns 401 when signed out before parsing or metering", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await postDiff(new Request("http://localhost/api/v1/diffs", { method: "POST", body: "invalid" }));
    expect(response.status).toBe(401);
    expect(mocks.consumeCloudRun).not.toHaveBeenCalled();
  });

  it("returns the monthly limit body for a raw-payload cloud comparison", async () => {
    mocks.consumeCloudRun.mockResolvedValue({ ok: false, usage: freeUsage });
    const response = await postDiff(post(meteredPayload()));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "usage_limit_reached",
      message: "You've used 50 of 50 cloud runs this month. Local diffs are still unlimited.",
      resetsAt: "2026-12-01T00:00:00.000Z",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a raw-payload comparison under the limit and consumes one run", async () => {
    const response = await postDiff(post(meteredPayload()));
    expect(response.status).toBe(201);
    expect((await response.json()).workspaceId).toBe(workspaceId);
    expect(mocks.consumeCloudRun).toHaveBeenCalledTimes(1);
  });

  it("also meters saved-snapshot comparisons and returns 429 at the limit", async () => {
    mocks.consumeCloudRun.mockResolvedValue({ ok: false, usage: freeUsage });
    const response = await postDiff(post({ workspaceId, baselineSnapshotId: baselineId, candidateSnapshotId: candidateId }));
    expect(response.status).toBe(429);
    expect(mocks.consumeCloudRun).toHaveBeenCalledTimes(1);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a saved-snapshot comparison under the limit and consumes one run", async () => {
    const response = await postDiff(post({ workspaceId, baselineSnapshotId: baselineId, candidateSnapshotId: candidateId }));
    expect(response.status).toBe(200);
    expect((await response.json()).diff.id).toBe("saved-diff");
    expect(mocks.consumeCloudRun).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/v1/usage", () => {
  it("requires a signed-in session", async () => {
    mocks.auth.mockResolvedValue(null);
    const response = await getUsage();
    expect(response.status).toBe(401);
    expect(mocks.getUsage).not.toHaveBeenCalled();
  });

  it("returns the authenticated user's current usage", async () => {
    const response = await getUsage();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ usage: { ...freeUsage, cloudRuns: 3, remaining: 47 } });
    expect(mocks.getUsage).toHaveBeenCalledWith("user-1");
  });
});
