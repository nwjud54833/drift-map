import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AUTH_RATE_LIMIT, checkRateLimit, clientIpFromRequest, resetRateLimits } from "@/lib/server/rate-limit";

beforeEach(() => resetRateLimits());

describe("in-process rate limiter", () => {
  it("allows requests up to the limit and blocks the next one", () => {
    const allowed = Array.from({ length: 60 }, () => checkRateLimit("t", "user-a", 60, 60_000));
    expect(allowed.every((result) => result.allowed)).toBe(true);
    const blocked = checkRateLimit("t", "user-a", 60, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.retryAfterSeconds).toBeLessThanOrEqual(60);
  });

  it("counts separate keys independently", () => {
    for (let index = 0; index < 60; index += 1) checkRateLimit("t", "user-a", 60, 60_000);
    expect(checkRateLimit("t", "user-b", 60, 60_000).allowed).toBe(true);
    expect(checkRateLimit("other", "user-a", 60, 60_000).allowed).toBe(true);
  });

  it("opens a new window after the previous one expires", () => {
    vi.useFakeTimers();
    try {
      for (let index = 0; index < 30; index += 1) checkRateLimit("t", "user-a", 30, 60_000);
      expect(checkRateLimit("t", "user-a", 30, 60_000).allowed).toBe(false);
      vi.advanceTimersByTime(61_000);
      expect(checkRateLimit("t", "user-a", 30, 60_000).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("derives a best-effort client address from x-forwarded-for", () => {
    expect(clientIpFromRequest(new Request("http://localhost", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }))).toBe("203.0.113.7");
    expect(clientIpFromRequest(new Request("http://localhost", { headers: { "x-real-ip": "198.51.100.9" } }))).toBe("198.51.100.9");
    expect(clientIpFromRequest(new Request("http://localhost"))).toBe("unknown");
  });
});

const authPostMock = vi.hoisted(() => vi.fn(async () => new Response("ok")));
vi.mock("@/auth", () => ({ handlers: { GET: vi.fn(), POST: authPostMock } }));

import { POST as postAuth } from "@/app/api/auth/[...nextauth]/route";

describe("auth route write limiting", () => {
  beforeEach(() => {
    resetRateLimits();
    authPostMock.mockClear();
  });

  it("passes sign-in traffic through up to the per-address limit and then returns 429", async () => {
    const request = () => new Request("http://localhost/api/auth/callback/google", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.7" },
    });
    for (let index = 0; index < AUTH_RATE_LIMIT.limit; index += 1) {
      const response = await postAuth(request() as never);
      expect(response.status).toBe(200);
    }
    const blocked = await postAuth(request() as never);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
    expect(await blocked.json()).toEqual({ error: "Too many requests. Please try again shortly." });
    expect(authPostMock).toHaveBeenCalledTimes(AUTH_RATE_LIMIT.limit);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
