import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import TermsPage from "@/app/terms/page";
import { LandingV4, PricingSection, SiteFooter } from "@/components/driftmap/landing-v4";
import { CliInstallSnippet, DRIFTMAP_CLI_COMMAND } from "@/components/driftmap/cli-install-snippet";

describe("privacy policy and CLI hero snippet", () => {
  it("renders the local-first, OAuth, synced data, and deletion policy sections", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("IndexedDB");
    expect(html).toContain("Google OAuth");
    expect(html).toContain("PostgreSQL database through the Neon adapter");
    expect(html).toContain("monthly count associated with your user account");
    expect(html).toContain("UTC month and number of cloud runs");
    expect(html).toContain("does not currently provide a self-service account");
  });

  it("renders the terms page", () => {
    const html = renderToStaticMarkup(<TermsPage />);
    expect(html).toContain("Terms of Service");
    expect(html).toContain("Acceptable use");
  });

  it("renders the npx command and one-click copy control", () => {
    const html = renderToStaticMarkup(<CliInstallSnippet />);
    expect(DRIFTMAP_CLI_COMMAND).toBe("npx driftmap-cli diff main.json candidate.json");
    expect(html).toContain(DRIFTMAP_CLI_COMMAND);
    expect(html).toContain('aria-label="Copy CLI command"');
  });

  it("links the landing footer to privacy and terms", () => {
    const html = renderToStaticMarkup(<SiteFooter onOpenWorkbench={() => undefined} onLaunchGraph={() => undefined} />);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain(">Privacy</a>");
    expect(html).toContain('href="/terms"');
    expect(html).toContain(">Terms</a>");
  });

  it("keeps the landing UI free of public source repository links", () => {
    const html = renderToStaticMarkup(<LandingV4 />);
    expect(html).not.toContain("Read the README");
    expect(html).not.toContain("github.com/");
    expect(html).not.toContain("MIT License");
    expect(html).toContain("Open the workbench");
    expect(html).toContain('id="capabilities"');
  });

  it("shows unlimited local diffs and the configured monthly cloud-run allowances", () => {
    const pricing = renderToStaticMarkup(<PricingSection onOpenWorkbench={() => undefined} />);
    expect(pricing).toContain("Unlimited local comparisons in your browser");
    expect(pricing).toContain("Free 50, Pro 1,000, Team 5,000");
    expect(pricing).toContain("Local browser diffs are unlimited and do not use cloud runs.");
  });
});
