import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const findFirstMock = vi.hoisted(() => vi.fn());
const findManyMock = vi.hoisted(() => vi.fn());
const createMock = vi.hoisted(() => vi.fn());
const updateManyMock = vi.hoisted(() => vi.fn());
const deleteManyMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { workspace: { findFirst: findFirstMock, findMany: findManyMock, create: createMock, updateMany: updateManyMock, deleteMany: deleteManyMock } } }));

import { GET as getWorkspaces } from "@/app/api/v1/workspaces/route";
import { GET as getWorkspace } from "@/app/api/v1/workspaces/[workspaceId]/route";

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
    const response = await getWorkspace(new Request("http://localhost"), { params: Promise.resolve({ workspaceId: "workspace-b" }) });
    expect(response.status).toBe(404);
    expect(findFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "workspace-b", userId: "user-a" } }));
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
