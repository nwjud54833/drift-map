import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const findFirstMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const deleteManyMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    workspace: { findFirst: findFirstMock, findMany: findManyMock, create: createMock, updateMany: updateManyMock, deleteMany: deleteManyMock },
    contractSnapshot: { findFirst: findFirstMock, updateMany: updateManyMock, deleteMany: deleteManyMock },
  },
}));

import { GET as getWorkspaces } from "@/app/api/v1/workspaces/route";
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

import { POST as postDiff } from "@/app/api/v1/diffs/route";

describe("diff endpoint boundaries", () => {
  it("rejects unauthenticated diff creation before parsing or persistence", async () => {
    authMock.mockResolvedValue(null);
    const response = await postDiff(new Request("http://localhost/api/v1/diffs", { method: "POST", body: "not-json" }));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });
});
