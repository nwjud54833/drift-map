import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const upsertMock = vi.hoisted(() => vi.fn());
const userUpdateMock = vi.hoisted(() => vi.fn());
const transactionMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    userProfile: { upsert: upsertMock },
    user: { update: userUpdateMock },
    $transaction: transactionMock,
  },
}));

import { POST } from "@/app/api/v1/user/profile/route";

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://driftmap.in/api/v1/user/profile", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  transactionMock.mockResolvedValue([]);
  upsertMock.mockResolvedValue({ userId: "user-1" });
  userUpdateMock.mockResolvedValue({ id: "user-1" });
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/v1/user/profile", () => {
  it("requires a signed-in user and does not touch the database anonymously", async () => {
    authMock.mockResolvedValue(null);
    const response = await POST(request({ companySize: "solo", primaryApiType: "rest", cicdTool: "github-actions" }));
    expect(response.status).toBe(401);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("validates survey categories and saves profile plus completion status", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const response = await POST(request({ companySize: "11-50", primaryApiType: "graphql", cicdTool: "gitlab-ci" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "saved" });
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user-1" },
      create: { userId: "user-1", companySize: "11-50", primaryApiType: "graphql", cicdTool: "gitlab-ci" },
    }));
    expect(userUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "user-1" }, data: { surveyCompleted: true },
    }));
    expect(transactionMock).toHaveBeenCalledOnce();
  });

  it("rejects unrecognized values and cross-origin writes", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    const invalid = await POST(request({ companySize: "all-users", primaryApiType: "rest", cicdTool: "github-actions" }));
    const crossOrigin = await POST(request(
      { companySize: "solo", primaryApiType: "rest", cicdTool: "github-actions" },
      { origin: "https://evil.example" },
    ));
    expect(invalid.status).toBe(400);
    expect(crossOrigin.status).toBe(403);
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
