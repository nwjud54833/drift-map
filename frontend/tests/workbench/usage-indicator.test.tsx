import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchToolbar, type WorkbenchToolbarProps } from "@/components/driftmap/workbench-toolbar";

const props: WorkbenchToolbarProps = {
  workspaces: [],
  active: null,
  mode: "local",
  onChangeMode: () => undefined,
  onSelectWorkspace: () => undefined,
  onOpenDrawer: () => undefined,
  onFormatJSON: () => undefined,
  onInferAndCompare: () => undefined,
  streaming: false,
  onToggleStreaming: () => undefined,
  payloadBytes: 0,
  onCopyMarkdown: () => undefined,
  onExportCI: () => undefined,
  onExportJSON: () => undefined,
  onShareReview: () => undefined,
  sharingReview: false,
  pending: false,
  onLoadExampleDiff: () => undefined,
  cloudStatus: null,
  onSignIn: () => undefined,
  usageDisplay: { state: "hidden" },
};

function renderUsage(usageDisplay: WorkbenchToolbarProps["usageDisplay"]) {
  return renderToStaticMarkup(<WorkbenchToolbar {...props} usageDisplay={usageDisplay} />);
}

describe("Workbench cloud usage indicator", () => {
  it("hides when the user is signed out", () => {
    expect(renderUsage({ state: "hidden" })).not.toContain("cloud runs used this month");
  });

  it("shows loading and error states", () => {
    expect(renderUsage({ state: "loading" })).toContain("Loading cloud usage…");
    expect(renderUsage({ state: "error" })).toContain("Cloud usage unavailable");
  });

  it("shows the monthly count and clarifies that only cloud comparisons count", () => {
    const html = renderUsage({ state: "ready", cloudRuns: 7, limit: 50 });
    expect(html).toContain("7 of 50 cloud runs used this month");
    expect(html).toContain("Only server-side Cloud mode comparisons use a cloud run. Local browser diffs are unlimited.");
  });
});
