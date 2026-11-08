import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CIExportModal, DRIFTMAP_GITHUB_WORKFLOW } from "@/components/driftmap/ci-export-modal";

describe("Workbench CI export", () => {
  it("renders the signed baseline URL, promotion secret, and pinned workflow snippet", () => {
    const markup = renderToStaticMarkup(<CIExportModal credentials={{
      baselineUrl: "https://driftmap.in/api/v1/workspaces/00000000-0000-4000-8000-000000000001/baseline?token=read.signed.value",
      promoteToken: "promote.signed.value",
      badgeMarkdown: "![DriftMap contract path count](https://driftmap.in/api/v1/workspaces/00000000-0000-4000-8000-000000000001/badge?token=badge.signed.value)",
      revision: "main 2026-11-09",
      pathCount: 12,
      lastPromotedAt: "2026-11-09T05:30:00.000Z",
      commitSha: "abcdef1234567",
      actor: "ci-bot",
      expiresAt: 1_800_000_000,
    }} onClose={() => undefined} />);
    expect(markup).toContain("Use this baseline in GitHub Actions");
    expect(markup).toContain("DRIFTMAP_BASELINE_URL");
    expect(markup).toContain("DRIFTMAP_PROMOTE_TOKEN");
    expect(markup).toContain("Copy README Badge Markdown");
    expect(markup).toContain("badge.signed.value");
    expect(markup).toContain("12 paths");
    expect(markup).toContain("abcdef123456");
    expect(markup).toContain("read.signed.value");
    expect(markup).toContain("promote.signed.value");
    expect(markup).toContain("nwjud54833/drift-map@v2.5.11");
    expect(DRIFTMAP_GITHUB_WORKFLOW).toContain("secrets.DRIFTMAP_BASELINE_URL");
    expect(DRIFTMAP_GITHUB_WORKFLOW).toContain("promote-on-push: true");
  });
});
