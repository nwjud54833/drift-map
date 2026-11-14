import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

afterEach(() => vi.unstubAllEnvs());

describe("Content Security Policy", () => {
  it("uses a fresh nonce and restricts executable content to the app", () => {
    const first = middleware(new NextRequest("https://driftmap.test/"));
    const second = middleware(new NextRequest("https://driftmap.test/"));
    const firstPolicy = first.headers.get("Content-Security-Policy");
    const secondPolicy = second.headers.get("Content-Security-Policy");

    expect(firstPolicy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]+=*' 'strict-dynamic'/);
    expect(secondPolicy).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]+=*' 'strict-dynamic'/);
    expect(firstPolicy).not.toBe(secondPolicy);
    expect(firstPolicy).toContain("object-src 'none'");
    expect(firstPolicy).toContain("base-uri 'self'");
    expect(firstPolicy).toContain("frame-ancestors 'none'");
    expect(firstPolicy).not.toContain("unsafe-eval");
  });

  it("permits eval only for the dev server, never for a production build", () => {
    vi.stubEnv("NODE_ENV", "development");
    const development = middleware(new NextRequest("https://driftmap.test/")).headers.get("Content-Security-Policy");
    // Next's React Refresh evaluates strings; without this the dev server throws
    // an uncaught EvalError and hydration — and every `ssr: false` component — dies.
    expect(development).toContain("'unsafe-eval'");

    vi.stubEnv("NODE_ENV", "production");
    const production = middleware(new NextRequest("https://driftmap.test/")).headers.get("Content-Security-Policy");
    expect(production).not.toContain("unsafe-eval");
    expect(production).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/]+=*' 'strict-dynamic';/);
  });
});
