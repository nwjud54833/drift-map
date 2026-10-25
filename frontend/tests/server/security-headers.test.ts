import { describe, expect, it } from "vitest";
import config from "../../next.config";

describe("application security headers", () => {
  it("applies browser hardening headers to all routes", async () => {
    const rules = await config.headers?.();
    expect(rules).toHaveLength(2);
    expect(rules?.[0].source).toBe("/:path*");
    expect(rules?.[0].headers).toEqual(expect.arrayContaining([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ]));
  });

  it("gives the standalone spatial artifact a CSP naming only its CDN origins", async () => {
    const rules = await config.headers?.();
    const artifact = rules?.find((rule) => rule.source === "/driftmap-v3-spatial.html");
    expect(artifact).toBeDefined();
    const policy = artifact?.headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";
    expect(policy).toContain("script-src 'self' https://cdn.tailwindcss.com");
    expect(policy).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(policy).toContain("font-src 'self' https://fonts.gstatic.com");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("form-action 'self'");
    // The artifact also inherits the baseline hardening headers.
    expect(artifact?.headers).toEqual(expect.arrayContaining([
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ]));
  });
});
