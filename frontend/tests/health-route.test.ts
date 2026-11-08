import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRawMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db/prisma", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "release-commit");
    vi.stubEnv("NEXT_PUBLIC_COMMIT_SHA", "public-commit");
    queryRawMock.mockResolvedValue([{ "?column?": 1 }]);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("reports database connectivity, build metadata, and disables caching", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "ok",
      db: "connected",
      commit: "release-commit",
      version: "2.5.13",
    });
    expect(queryRawMock).toHaveBeenCalledOnce();
  });

  it("reports a sanitized degraded response when the database check fails", async () => {
    queryRawMock.mockRejectedValue(new Error("secret host and connection details"));

    const response = await GET();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      status: "degraded",
      db: "error",
      commit: "release-commit",
      version: "2.5.13",
    });
  });

  it("uses the public commit fallback and then unknown", async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;

    let response = await GET();
    expect((await response.json()).commit).toBe("public-commit");

    delete process.env.NEXT_PUBLIC_COMMIT_SHA;
    response = await GET();
    expect((await response.json()).commit).toBe("unknown");
  });
});
