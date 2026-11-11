import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Workspace } from "@/lib/contract/types";
import { PricingSection } from "@/components/driftmap/landing-v4";
import { SiteHeader } from "@/components/driftmap/site-header";
import { WorkbenchToolbar } from "@/components/driftmap/workbench-toolbar";
import { submitEarlyAccessRequest } from "@/lib/client/early-access";
import { getProCheckoutUrl } from "@/lib/client/pro-checkout";

vi.mock("next/navigation", () => ({ usePathname: () => "/workbench" }));
vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated" }) }));

afterEach(() => vi.unstubAllEnvs());

describe("Team Cloud early access conversion", () => {
  it("renders the early access form and signed-in workspace sync option", () => {
    const html = renderToStaticMarkup(<PricingSection onOpenWorkbench={() => undefined} />);

    expect(html).toContain("Request Team Cloud early access");
    expect(html).toContain('name="email"');
    expect(html).toContain('name="githubOrg"');
    expect(html).toContain('name="repositoryCount"');
    expect(html).toContain("Sign in for Cloud Workspace Sync");
    expect(html).toContain("This page does not list a price.");
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

    await expect(submitEarlyAccessRequest({ email: "bad" }, invalidFetch)).resolves.toMatchObject({ ok: false, message: expect.stringContaining("valid email") });
    await expect(submitEarlyAccessRequest({ email: "valid@example.com" }, limitedFetch)).resolves.toEqual({ ok: false, message: "Too many requests. Try again later." });
  });

  it("shows the configured secure checkout beside the waitlist and in the Workbench upgrade prompt", () => {
    vi.stubEnv("NEXT_PUBLIC_PRO_CHECKOUT_URL", "https://buy.stripe.com/test_123");
    const pricing = renderToStaticMarkup(<PricingSection onOpenWorkbench={() => undefined} />);
    expect(pricing).toContain('href="https://buy.stripe.com/test_123"');
    expect(pricing).toContain("Upgrade to Team CI Cloud");
    expect(pricing).toContain("Request Early Access");
    const toolbar = renderToStaticMarkup(<WorkbenchToolbar
      workspaces={[]} active={null} mode="local" onChangeMode={() => undefined} onSelectWorkspace={() => undefined}
      onOpenDrawer={() => undefined} onFormatJSON={() => undefined} onInferAndCompare={() => undefined}
      streaming={false} onToggleStreaming={() => undefined} payloadBytes={0} onCopyMarkdown={() => undefined}
      onExportCI={() => undefined} onExportJSON={() => undefined} onShareReview={() => undefined} sharingReview={false}
      pending={false} onLoadExampleDiff={() => undefined} cloudStatus={null} onSignIn={() => undefined}
    />);
    expect(toolbar).toContain('href="https://buy.stripe.com/test_123"');
    expect(toolbar).toContain('aria-label="Try an example"');
    expect(toolbar).toContain("Payment Webhook Drift · Breaking");
    expect(toolbar).toContain("Order Fulfillment API · Warning + Safe");
    expect(toolbar).toContain("OpenAPI 3.0 Spec Upgrade");
  });

  it("keeps Infer & Compare in the default toolbar and exposes every advanced action in its menu", () => {
    const workspace = {
      id: "workspace-1",
      name: "Orders",
      direction: "response",
      baselineSnapshotId: "baseline-1",
      candidateSnapshotId: "candidate-1",
    } as Workspace;
    const toolbar = renderToStaticMarkup(<WorkbenchToolbar
      workspaces={[workspace]} active={workspace} mode="cloud" onChangeMode={() => undefined} onSelectWorkspace={() => undefined}
      onOpenDrawer={() => undefined} onFormatJSON={() => undefined} onInferAndCompare={() => undefined}
      streaming={false} onToggleStreaming={() => undefined} payloadBytes={0} onCopyMarkdown={() => undefined}
      onExportCI={() => undefined} onExportJSON={() => undefined} onShareReview={() => undefined} sharingReview={false}
      pending={false} onLoadExampleDiff={() => undefined} cloudStatus="owner" onSignIn={() => undefined}
    />);

    expect(toolbar).toContain("Infer &amp; Compare");
    expect((toolbar.match(/btn-geist-primary/g) ?? [])).toHaveLength(1);
    expect(toolbar).toContain("Try an example");
    const menuStart = toolbar.indexOf("<details");
    const menuEnd = toolbar.indexOf("</details>", menuStart);
    const advancedMenu = toolbar.slice(menuStart, menuEnd);
    for (const item of [
      "Format JSON",
      "Simulate live traffic",
      "Copy Markdown",
      "Use in CI / GitHub Action",
      "Share Review Link",
      "Export JSON",
      "Team CI Cloud · Early Access",
    ]) {
      expect(advancedMenu).toContain(item);
    }
  });

  it("keeps header utilities in Advanced and leaves one account control", () => {
    const header = renderToStaticMarkup(<SiteHeader />);
    const menuStart = header.indexOf("<details");
    const menuEnd = header.indexOf("</details>", menuStart);
    const advancedMenu = header.slice(menuStart, menuEnd);

    for (const item of ["FX Off", "Command palette", "Tokens", "Cloud ready"]) {
      expect(advancedMenu).toContain(item);
    }
    expect(header).toContain(">Account</a>");
    expect(header).not.toContain("Open workbench");
  });

  it("does not render unsafe checkout URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_PRO_CHECKOUT_URL", "http://localhost:3000/checkout");
    expect(getProCheckoutUrl()).toBeNull();
    const html = renderToStaticMarkup(<PricingSection onOpenWorkbench={() => undefined} />);
    expect(html).not.toContain("Upgrade to Team CI Cloud");
    expect(html).toContain("Request Early Access");
  });
});
