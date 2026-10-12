import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

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
});
