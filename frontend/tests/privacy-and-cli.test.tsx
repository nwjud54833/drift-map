import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage from "@/app/privacy/page";
import { CliInstallSnippet, DRIFTMAP_CLI_COMMAND } from "@/components/driftmap/cli-install-snippet";
import { SiteFooter } from "@/components/driftmap/landing-sections";

describe("privacy policy and CLI hero snippet", () => {
  it("renders the local-first, OAuth, synced data, and deletion policy sections", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("IndexedDB");
    expect(html).toContain("Google OAuth");
    expect(html).toContain("Neon PostgreSQL");
    expect(html).toContain("request deletion");
  });

  it("renders the npx command and one-click copy control", () => {
    const html = renderToStaticMarkup(<CliInstallSnippet />);
    expect(DRIFTMAP_CLI_COMMAND).toBe("npx driftmap diff --baseline main.json --candidate candidate.json");
    expect(html).toContain(DRIFTMAP_CLI_COMMAND);
    expect(html).toContain('aria-label="Copy CLI command"');
  });

  it("links the landing footer to the privacy policy", () => {
    const html = renderToStaticMarkup(<SiteFooter onOpenWorkbench={() => undefined} onLaunchGraph={() => undefined} />);
    expect(html).toContain('href="/privacy"');
    expect(html).toContain(">Privacy</a>");
  });
});
