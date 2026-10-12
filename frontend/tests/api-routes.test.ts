import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const findFirstMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const deleteManyMock = vi.hoisted(() => vi.fn());
const diffFindManyMock = vi.hoisted(() => vi.fn());
const diffFindFirstMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspace: { findFirst: findFirstMock, findMany: findManyMock, create: createMock, updateMany: updateManyMock, deleteMany: deleteManyMock },
    contractSnapshot: { findFirst: findFirstMock, updateMany: updateManyMock, deleteMany: deleteManyMock },
    contractDiff: { findMany: diffFindManyMock, findFirst: diffFindFirstMock },
  },
}));

import { GET as getWorkspaces, POST as postWorkspace } from "@/app/api/v1/workspaces/route";
import { GET as getWorkspace } from "@/app/api/v1/workspaces/[workspaceId]/route";
import { GET as getSnapshot, PATCH as patchSnapshot } from "@/app/api/v1/snapshots/[snapshotId]/route";

beforeEach(() => { vi.clearAllMocks(); });

describe("authenticated resource boundaries", () => {
  it("rejects unauthenticated workspace access", async () => {
    authMock.mockResolvedValue(null);
    const response = await getWorkspaces();
    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("returns JSON when session lookup fails", async () => {
    authMock.mockRejectedValue(new Error("session store unavailable"));
    const response = await getWorkspaces();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to verify your session." });
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("reports workspace persistence failures as server errors", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    createMock.mockRejectedValue(new Error("database unavailable"));
    const response = await postWorkspace(new Request("http://localhost/api/v1/workspaces", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Orders API", direction: "response" }),
    }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to create the workspace." });
  });

  it("scopes workspace reads to the server session user", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    findFirstMock.mockResolvedValue(null);
    const workspaceId = "6f9619ff-8b86-4d3a-a5a5-6d2a7e5b6c10";
    const response = await getWorkspace(new Request("http://localhost"), { params: Promise.resolve({ workspaceId }) });
    expect(response.status).toBe(404);
    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: workspaceId, userId: "user-a" } }));
  });

  it("rejects malformed resource IDs before querying Prisma", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    const workspaceResponse = await getWorkspace(new Request("http://localhost"), { params: Promise.resolve({ workspaceId: "not-a-uuid" }) });
    const snapshotResponse = await getSnapshot(new Request("http://localhost"), { params: Promise.resolve({ snapshotId: "not-a-uuid" }) });
    expect(workspaceResponse.status).toBe(400);
    expect(snapshotResponse.status).toBe(400);
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated snapshot updates before parsing", async () => {
    authMock.mockResolvedValue(null);
    const response = await patchSnapshot(new Request("http://localhost/api/v1/snapshots/snap-1", { method: "PATCH", body: JSON.stringify({ versionLabel: "v2" }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ snapshotId: "snap-1" }) });
    expect(response.status).toBe(401);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it("scopes snapshot renames to the session user and returns 404 for foreign snapshots", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    updateManyMock.mockResolvedValue({ count: 0 });
    const snapshotId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const response = await patchSnapshot(new Request(`http://localhost/api/v1/snapshots/${snapshotId}`, { method: "PATCH", body: JSON.stringify({ versionLabel: "renamed" }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ snapshotId }) });
    expect(response.status).toBe(404);
    expect(updateManyMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: snapshotId, workspace: { userId: "user-a" } } }));
  });

  it("validates snapshot rename payloads", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    const response = await patchSnapshot(new Request("http://localhost/api/v1/snapshots/snap-1", { method: "PATCH", body: JSON.stringify({ versionLabel: 42 }), headers: { "content-type": "application/json" } }), { params: Promise.resolve({ snapshotId: "snap-1" }) });
    expect(response.status).toBe(400);
    expect(updateManyMock).not.toHaveBeenCalled();
  });

});

import { GET as getDiffs, POST as postDiff } from "@/app/api/v1/diffs/route";

describe("diff endpoint boundaries", () => {
  it("rejects unauthenticated diff creation before parsing or persistence", async () => {
    authMock.mockResolvedValue(null);
    const response = await postDiff(new Request("http://localhost/api/v1/diffs", { method: "POST", body: "not-json" }));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated diff reads before querying Prisma", async () => {
    authMock.mockResolvedValue(null);
    const response = await getDiffs(new Request("http://localhost/api/v1/diffs"));
    expect(response.status).toBe(401);
    expect(diffFindManyMock).not.toHaveBeenCalled();
    expect(diffFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns a consistent JSON error when session lookup fails", async () => {
    authMock.mockRejectedValue(new Error("session lookup failed"));
    const response = await getDiffs(new Request("http://localhost/api/v1/diffs"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to verify your session." });
    expect(diffFindManyMock).not.toHaveBeenCalled();
    expect(diffFindFirstMock).not.toHaveBeenCalled();
  });

  it("scopes diff listings to the session user's workspaces", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    diffFindManyMock.mockResolvedValue([]);
    const response = await getDiffs(new Request("http://localhost/api/v1/diffs"));
    expect(response.status).toBe(200);
    expect(diffFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { workspace: { userId: "user-a" } },
    }));
  });

  it("scopes diff detail lookups to the session user and returns 404 for foreign diffs", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    diffFindFirstMock.mockResolvedValue(null);
    const workspaceId = "6f9619ff-8b86-4d3a-a5a5-6d2a7e5b6c10";
    const baselineId = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
    const candidateId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
    const response = await getDiffs(new Request(`http://localhost/api/v1/diffs?workspaceId=${workspaceId}&baselineSnapshotId=${baselineId}&candidateSnapshotId=${candidateId}&direction=request`));
    expect(response.status).toBe(404);
    expect(diffFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspace: { userId: "user-a" }, direction: "request" }),
    }));
  });

  it("rejects malformed diff detail identifiers before querying Prisma", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    const response = await getDiffs(new Request("http://localhost/api/v1/diffs?workspaceId=not-a-uuid&baselineSnapshotId=not-a-uuid&candidateSnapshotId=not-a-uuid"));
    expect(response.status).toBe(400);
    expect(diffFindFirstMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported diff directions before querying Prisma", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    const response = await getDiffs(new Request("http://localhost/api/v1/diffs?workspaceId=6f9619ff-8b86-4d3a-a5a5-6d2a7e5b6c10&baselineSnapshotId=f47ac10b-58cc-4372-a567-0e02b2c3d479&candidateSnapshotId=7c9e6679-7425-40de-944b-e07fc1f90ae7&direction=invalid"));
    expect(response.status).toBe(400);
    expect(diffFindFirstMock).not.toHaveBeenCalled();
  });
});
