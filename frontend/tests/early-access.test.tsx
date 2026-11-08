import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PricingSection } from "@/components/driftmap/landing-sections";
import { submitEarlyAccessRequest } from "@/lib/client/early-access";

describe("Team Cloud early access conversion", () => {
  it("renders the early access form and signed-in workspace sync option", () => {
    const html = renderToStaticMarkup(<PricingSection onOpenWorkbench={() => undefined} />);

    expect(html).toContain("Request Team Cloud early access");
    expect(html).toContain('name="email"');
    expect(html).toContain('name="githubOrg"');
    expect(html).toContain('name="repositoryCount"');
    expect(html).toContain("Sign in for Cloud Workspace Sync");
    expect(html).toContain("pricing and availability have not been announced");
  });

  it("submits a waitlist request and reports success immediately", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response("{\"status\":\"accepted\"}", { status: 202 }));
    const result = await submitEarlyAccessRequest({ email: "person@example.com", githubOrg: "acme", repositoryCount: 12 }, fetchMock);

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith("/api/early-access", expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "person@example.com", githubOrg: "acme", repositoryCount: 12 }),
    }));
  });

  it("provides clear validation and rate-limit feedback", async () => {
    const invalidFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 400 }));
    const limitedFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 429 }));

    await expect(submitEarlyAccessRequest({ email: "bad" }, invalidFetch)).resolves.toMatchObject({ ok: false, message: "Enter a valid email" });
    await expect(submitEarlyAccessRequest({ email: "valid@example.com" }, limitedFetch)).resolves.toEqual({ ok: false, message: "Too many requests. Try again later." });
  });
});
