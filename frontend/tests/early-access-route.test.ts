import { beforeEach, describe, expect, it, vi } from "vitest";

const upsertMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: { earlyAccessRequest: { upsert: upsertMock } } }));

import { POST } from "@/app/api/early-access/route";

function request(body: unknown, ip: string) {
  return new Request("https://driftmap.in/api/early-access", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": ip },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  upsertMock.mockResolvedValue({ id: "request-id" });
});

describe("POST /api/early-access", () => {
  it("validates, normalizes, and stores only approved fields", async () => {
    const response = await POST(request({
      email: "  Person@Example.com ",
      githubOrg: " acme-tools ",
      repositoryCount: 12,
    }, "203.0.113.31"));

    expect(response.status).toBe(202);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "accepted" });
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { email: "person@example.com" },
      create: { email: "person@example.com", githubOrg: "acme-tools", repositoryCount: 12 },
    }));
  });

  it("rejects invalid email, org input, and unexpected fields without storing them", async () => {
    const response = await POST(request({ email: "not-an-email", githubOrg: "<img src=x>", surprise: true }, "203.0.113.32"));
    expect(response.status).toBe(400);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated submissions from an address", async () => {
    const ip = "203.0.113.33";
    for (let index = 0; index < 10; index += 1) {
      const response = await POST(request({ email: `person${index}@example.com` }, ip));
      expect(response.status).toBe(202);
    }
    const limited = await POST(request({ email: "another@example.com" }, ip));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBeTruthy();
  });

  it("returns a sanitized unavailable response when persistence fails", async () => {
    upsertMock.mockRejectedValue(new Error("database host and credential details"));
    const response = await POST(request({ email: "person@example.com" }, "203.0.113.34"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Early access requests are temporarily unavailable. Try again later." });
  });
});
