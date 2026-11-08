import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const workspaceFindFirstMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { workspace: { findFirst: workspaceFindFirstMock } },
}));

import { GET } from "@/app/api/v1/workspaces/[workspaceId]/baseline/route";
import { POST as createToken } from "@/app/api/v1/workspaces/[workspaceId]/baseline/token/route";
import { createBaselineReadToken } from "@/lib/server/baseline-token";

const workspaceId = "6f9619ff-8b86-4d3a-a5a5-6d2a7e5b6c10";
const context = { params: Promise.resolve({ workspaceId }) };
const workspaceResult = {
  id: workspaceId,
  name: "Orders",
  direction: "response",
  baselineSnapshot: {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    versionLabel: "v1",
    contract: { rootKinds: ["object"], nodes: [], fingerprint: "fp", generatedAt: "2026-11-01T00:00:00.000Z", inferenceVersion: 1 },
    samples: [{ value: { id: "order-1" } }],
  },
};

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "test-secret-with-at-least-32-characters");
  vi.clearAllMocks();
});

afterEach(() => vi.unstubAllEnvs());

describe("GET workspace baseline", () => {
  it("requires authentication when no read token is supplied", async () => {
    authMock.mockResolvedValue(null);
    const response = await GET(new Request("https://driftmap.in/api/v1/workspaces"), context);
    expect(response.status).toBe(401);
    expect(workspaceFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns only the owner's selected baseline without caching", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    workspaceFindFirstMock.mockResolvedValue(workspaceResult);
    const response = await GET(new Request("https://driftmap.in/api/v1/workspaces"), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({
      baseline: {
        workspaceId,
        workspaceName: "Orders",
        direction: "response",
        snapshotId: workspaceResult.baselineSnapshot.id,
        versionLabel: "v1",
        contract: workspaceResult.baselineSnapshot.contract,
        samples: [{ id: "order-1" }],
      },
    });
    expect(workspaceFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: workspaceId, userId: "user-a" } }));
  });

  it("accepts an unexpired token scoped to the requested workspace", async () => {
    workspaceFindFirstMock.mockResolvedValue(workspaceResult);
    const issued = createBaselineReadToken("user-a", workspaceId)!;
    const request = new Request("https://driftmap.in/api/v1/workspaces", { headers: { authorization: `Bearer ${issued.token}` } });
    const response = await GET(request, context);

    expect(response.status).toBe(200);
    expect(authMock).not.toHaveBeenCalled();
    expect(workspaceFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: workspaceId, userId: "user-a" } }));
  });

  it("rejects invalid and cross-workspace tokens before querying", async () => {
    const request = new Request("https://driftmap.in/api/v1/workspaces", { headers: { authorization: "Bearer forged.token.value" } });
    const response = await GET(request, context);
    expect(response.status).toBe(401);
    expect(workspaceFindFirstMock).not.toHaveBeenCalled();
  });

  it("returns not found when a workspace has no selected baseline", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    workspaceFindFirstMock.mockResolvedValue({ ...workspaceResult, baselineSnapshot: null });
    const response = await GET(new Request("https://driftmap.in/api/v1/workspaces"), context);
    expect(response.status).toBe(404);
  });
});

describe("POST workspace baseline token", () => {
  it("issues a workspace-scoped read token only to its owner", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    workspaceFindFirstMock.mockResolvedValue({ id: workspaceId, baselineSnapshotId: workspaceResult.baselineSnapshot.id });
    const response = await createToken(new Request("https://driftmap.in/api/v1/workspaces", { method: "POST" }), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.expiresAt).toEqual(expect.any(Number));
  });
});
