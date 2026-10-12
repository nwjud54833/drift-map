import { describe, expect, it } from "vitest";
import config from "../../next.config";

describe("application security headers", () => {
  it("applies browser hardening headers to all routes", async () => {
    const rules = await config.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0].source).toBe("/:path*");
    expect(rules?.[0].headers).toEqual(expect.arrayContaining([
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=()" },
    ]));
  });
});
