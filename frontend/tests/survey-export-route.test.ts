import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const countMock = vi.hoisted(() => vi.fn());
const groupByMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { userProfile: { count: countMock, groupBy: groupByMock } } }));

import { GET } from "@/app/api/v1/admin/survey-export/route";

beforeEach(() => {
  vi.stubEnv("DRIFTMAP_ADMIN_EMAILS", "admin@driftmap.in,ops@driftmap.in");
  vi.clearAllMocks();
  countMock.mockResolvedValue(7);
  groupByMock
    .mockResolvedValueOnce([{ companySize: "11-50", _count: { _all: 4 } }, { companySize: "solo", _count: { _all: 3 } }])
    .mockResolvedValueOnce([{ primaryApiType: "rest", _count: { _all: 5 } }, { primaryApiType: "graphql", _count: { _all: 2 } }])
    .mockResolvedValueOnce([{ cicdTool: "github-actions", _count: { _all: 6 } }, { cicdTool: "gitlab-ci", _count: { _all: 1 } }]);
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/v1/admin/survey-export", () => {
  it("returns aggregate metrics only to allowlisted admins", async () => {
    authMock.mockResolvedValue({ user: { email: "ADMIN@driftmap.in" } });
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload).toMatchObject({
      totalResponses: 7,
      companySize: { "11-50": 4, solo: 3 },
      primaryApiType: { rest: 5, graphql: 2 },
      cicdTool: { "github-actions": 6, "gitlab-ci": 1 },
    });
    expect(JSON.stringify(payload)).not.toContain("email");
    expect(groupByMock).toHaveBeenCalledTimes(3);
  });

  it("denies non-admins without querying survey data", async () => {
    authMock.mockResolvedValue({ user: { email: "visitor@example.com" } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access is required." });
    expect(countMock).not.toHaveBeenCalled();
    expect(groupByMock).not.toHaveBeenCalled();
  });
});
