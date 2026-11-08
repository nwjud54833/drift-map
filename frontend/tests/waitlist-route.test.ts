import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const countMock = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { earlyAccessRequest: { count: countMock } } }));

import { GET } from "@/app/api/v1/waitlist/route";

beforeEach(() => {
  vi.stubEnv("DRIFTMAP_ADMIN_EMAILS", "admin@driftmap.in,ops@driftmap.in");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe("GET waitlist admin summary", () => {
  it("returns only an aggregate count to an allowlisted signed-in admin", async () => {
    authMock.mockResolvedValue({ user: { email: "ADMIN@driftmap.in" } });
    countMock.mockResolvedValue(42);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ waitlist: { count: 42 } });
  });

  it("does not query or expose waitlist details to non-admins", async () => {
    authMock.mockResolvedValue({ user: { email: "visitor@example.com" } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Admin access is required." });
    expect(countMock).not.toHaveBeenCalled();
  });
});
