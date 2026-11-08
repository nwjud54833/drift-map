import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const workspaceFindFirstMock = vi.hoisted(() => vi.fn());
const txMock = vi.hoisted(() => ({
  workspace: { findFirst: vi.fn(), update: vi.fn() },
  contractSnapshot: { create: vi.fn() },
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { workspace: { findFirst: workspaceFindFirstMock }, $transaction: vi.fn((callback) => callback(txMock)) },
}));

import { GET } from "@/app/api/v1/workspaces/[workspaceId]/baseline/route";
import { POST as promoteBaseline } from "@/app/api/v1/workspaces/[workspaceId]/baseline/route";
import { POST as createToken } from "@/app/api/v1/workspaces/[workspaceId]/baseline/token/route";
import { GET as getBadge } from "@/app/api/v1/workspaces/[workspaceId]/badge/route";
import { createBaselineReadToken, createBaselineToken } from "@/lib/server/baseline-token";
import { decodeBaselinePromotionNotes, encodeBaselinePromotionNotes } from "@/lib/server/baseline-audit";
import { GET as getWorkspaceReview } from "@/app/api/v1/workspaces/[workspaceId]/review/route";

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

  it("accepts a read token embedded in the copied baseline URL", async () => {
    workspaceFindFirstMock.mockResolvedValue(workspaceResult);
    const issued = createBaselineReadToken("user-a", workspaceId)!;
    const request = new Request(`https://driftmap.in/api/v1/workspaces/${workspaceId}/baseline?token=${issued.token}`);
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
    expect(authMock).not.toHaveBeenCalled();
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

describe("GET signed read-only workspace review", () => {
  it("returns the two snapshots only for a review-scoped token", async () => {
    const candidateSnapshotId = "f47ac10b-58cc-4372-a567-0e02b2c3d480";
    const issued = createBaselineToken("user-1", workspaceId, "review", Date.now(), undefined, { baselineSnapshotId: workspaceResult.baselineSnapshot.id, candidateSnapshotId });
    if (!issued) throw new Error("Token not issued");
    workspaceFindFirstMock.mockResolvedValue({
      ...workspaceResult,
      snapshots: [
        workspaceResult.baselineSnapshot,
        { ...workspaceResult.baselineSnapshot, id: candidateSnapshotId, versionLabel: "v2", samples: [{ value: { id: 2 } }] },
      ],
    });
    const reviewContext = { params: Promise.resolve({ workspaceId }) };
    const response = await getWorkspaceReview(new Request("https://driftmap.in/api/review", { headers: { authorization: `Bearer ${issued.token}` } }), reviewContext);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.review).toMatchObject({
      version: 1,
      workspace: { id: workspaceId, name: "Orders", direction: "response" },
      baseline: { versionLabel: "v1", document: { id: "order-1" } },
      candidate: { versionLabel: "v2", document: { id: 2 } },
    });
  });

  it("rejects baseline read tokens", async () => {
    const issued = createBaselineToken("user-1", workspaceId, "read");
    if (!issued) throw new Error("Token not issued");
    const response = await getWorkspaceReview(new Request("https://driftmap.in/api/review", { headers: { authorization: `Bearer ${issued.token}` } }), context);
    expect(response.status).toBe(401);
  });
});

describe("POST workspace baseline token", () => {
  it("issues a workspace-scoped read token only to its owner", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    workspaceFindFirstMock.mockResolvedValue({ id: workspaceId, baselineSnapshot: workspaceResult.baselineSnapshot });
    const response = await createToken(new Request("https://driftmap.in/api/v1/workspaces", { method: "POST" }), context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.token).toEqual(expect.any(String));
    expect(body.expiresAt).toEqual(expect.any(Number));
    expect(body.baseline).toMatchObject({ revision: "v1", pathCount: 0, lastPromotedAt: null });
  });

  it("issues a scoped promotion token only to the authenticated workspace owner", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    workspaceFindFirstMock.mockResolvedValue({ id: workspaceId, baselineSnapshot: workspaceResult.baselineSnapshot });
    const response = await createToken(new Request("https://driftmap.in/api/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "promote" }) }), context);
    expect(response.status).toBe(200);
    const { token } = await response.json();
    expect(token).toEqual(expect.any(String));
    expect(createBaselineToken("user-a", workspaceId, "read")).not.toBeNull();
  });

  it("issues an independent badge-only token and returns promotion audit metadata", async () => {
    authMock.mockResolvedValue({ user: { id: "user-a" } });
    const auditNotes = encodeBaselinePromotionNotes({ promotedAt: "2026-11-09T05:30:00.000Z", commitSha: "abcdef1234567", actor: "ci-bot", pathCount: 12 });
    workspaceFindFirstMock.mockResolvedValue({ id: workspaceId, baselineSnapshot: { ...workspaceResult.baselineSnapshot, notes: auditNotes, contract: { ...workspaceResult.baselineSnapshot.contract, nodes: Array.from({ length: 12 }) } } });
    const response = await createToken(new Request("https://driftmap.in/api/token", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "badge" }) }), context);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.baseline).toEqual({ revision: "v1", pathCount: 12, lastPromotedAt: "2026-11-09T05:30:00.000Z", commitSha: "abcdef1234567", actor: "ci-bot" });
    expect(body.token).toEqual(expect.any(String));
  });
});

describe("GET workspace contract badge", () => {
  it("serves only a static SVG to a workspace badge token", async () => {
    const issued = createBaselineToken("user-a", workspaceId, "badge")!;
    workspaceFindFirstMock.mockResolvedValue({ id: workspaceId, baselineSnapshot: { id: workspaceResult.baselineSnapshot.id, contract: workspaceResult.baselineSnapshot.contract } });
    const response = await getBadge(new Request(`https://driftmap.in/api/v1/workspaces/${workspaceId}/badge?token=${issued.token}`), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("image/svg+xml");
    expect(response.headers.get("Cache-Control")).toContain("s-maxage=300");
    expect(await response.text()).toContain("DriftMap | 0 contract paths");
    expect(workspaceFindFirstMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: workspaceId, userId: "user-a" } }));

    workspaceFindFirstMock.mockResolvedValue({ id: workspaceId, baselineSnapshot: { id: workspaceResult.baselineSnapshot.id, contract: workspaceResult.baselineSnapshot.contract } });
    const readToken = createBaselineReadToken("user-a", workspaceId)!;
    const readAuthorized = await getBadge(new Request(`https://driftmap.in/api/v1/workspaces/${workspaceId}/badge`, { headers: { authorization: `Bearer ${readToken.token}` } }), context);
    expect(readAuthorized.status).toBe(200);
  });

  it("rejects promotion tokens and never exposes a contract through badge scope", async () => {
    const issued = createBaselineToken("user-a", workspaceId, "promote")!;
    const response = await getBadge(new Request(`https://driftmap.in/api/v1/workspaces/${workspaceId}/badge?token=${issued.token}`), context);
    expect(response.status).toBe(401);
    expect(workspaceFindFirstMock).not.toHaveBeenCalled();
  });

  it("does not let badge-only credentials fetch baseline contract data", async () => {
    const issued = createBaselineToken("user-a", workspaceId, "badge")!;
    const response = await GET(new Request("https://driftmap.in/api/baseline", { headers: { authorization: `Bearer ${issued.token}` } }), context);
    expect(response.status).toBe(401);
    expect(workspaceFindFirstMock).not.toHaveBeenCalled();
  });
});

describe("POST workspace baseline promotion", () => {
  it("requires a valid scoped promotion token and atomically switches the selected baseline", async () => {
    const snapshot = { id: "f47ac10b-58cc-4372-a567-0e02b2c3d479", versionLabel: "main 2026-11-09", createdAt: new Date() };
    txMock.workspace.findFirst.mockResolvedValue({ id: workspaceId });
    txMock.contractSnapshot.create.mockResolvedValue(snapshot);
    txMock.workspace.update.mockResolvedValue({ id: workspaceId });
    const token = createBaselineToken("user-a", workspaceId, "promote")!;
    const response = await promoteBaseline(new Request(`https://driftmap.in/api/v1/workspaces/${workspaceId}/baseline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token.token}`, "content-type": "application/json" },
      body: JSON.stringify({ document: JSON.stringify({ id: "order-2", status: "shipped" }), versionLabel: snapshot.versionLabel, commitSha: "abcdef1234567", actor: "ci-bot" }),
    }), context);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "promoted", snapshot: { id: snapshot.id } });
    expect(txMock.workspace.update).toHaveBeenCalledWith({ where: { id: workspaceId }, data: { baselineSnapshotId: snapshot.id } });
    const stored = txMock.contractSnapshot.create.mock.calls[0][0].data;
    expect(decodeBaselinePromotionNotes(stored.notes)).toEqual({ promotedAt: expect.any(String), commitSha: "abcdef1234567", actor: "ci-bot", pathCount: 2 });
  });

  it("rejects read-only tokens and does not create a snapshot", async () => {
    const token = createBaselineReadToken("user-a", workspaceId)!;
    const response = await promoteBaseline(new Request("https://driftmap.in/api/baseline", {
      method: "POST", headers: { authorization: `Bearer ${token.token}` }, body: JSON.stringify({ document: "{}" }),
    }), context);
    expect(response.status).toBe(401);
    expect(txMock.contractSnapshot.create).not.toHaveBeenCalled();
  });
});
