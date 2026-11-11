import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { compareContracts } from "@/lib/contract/compare";
import { inferContract } from "@/lib/contract/infer";
import type { JsonObject, PayloadSample } from "@/lib/contract/types";
import { toFindings } from "@/lib/driftmap/presentation";
import { WorkbenchCenter } from "@/components/driftmap/workbench-center";
import { WorkbenchInspector } from "@/components/driftmap/workbench-inspector";
import JsonInputEditor from "@/components/workbench/json-input-editor";

function sample(id: string, value: JsonObject): PayloadSample {
  return {
    id,
    label: id,
    source: "fixture",
    capturedAt: "2026-11-11T00:00:00.000Z",
    value,
  };
}

function centerMarkup(findings: ReturnType<typeof toFindings>) {
  return renderToStaticMarkup(
    <WorkbenchCenter
      findings={findings}
      revisions={[]}
      activeRevisionIndex={0}
      onRevisionChange={() => undefined}
      candidateVersion="v2"
      mode="table"
      onModeChange={() => undefined}
      severity="all"
      onSeverityChange={() => undefined}
      query=""
      onQueryChange={() => undefined}
      selectedIndex={0}
      onSelectIndex={() => undefined}
      flashIndex={-1}
      recomputing={false}
    />,
  );
}

function mixedFindings() {
  const baseline = [sample("baseline", {
    order_id: "ord_381",
    status: "shipped",
    delivery_date: "2026-11-09",
  })];
  const candidate = [
    sample("candidate-1", {
      order_id: "ord_381",
      status: "shipped",
      delivery_date: null,
      tracking_metadata: { carrier: "DHL", url: "https://track.example/381" },
    }),
    sample("candidate-2", {
      order_id: "ord_382",
      status: "shipped",
      delivery_date: "2026-11-10",
    }),
  ];
  const changes = compareContracts(inferContract(baseline), inferContract(candidate), "response");
  return toFindings(changes, { direction: "response", candidateVersion: "v2" });
}

describe("simplified Workbench results and inspector", () => {
  it("keeps editor utility buttons compact and accessible by name and tooltip", () => {
    const html = renderToStaticMarkup(
      <JsonInputEditor id="test-editor" label="Old response" value="{}" onChange={() => undefined} />,
    );
    for (const label of ["Format JSON", "Choose file", "Clear editor"]) {
      expect(html).toContain(`aria-label="${label}"`);
      expect(html).toContain(`title="${label}"`);
    }
    expect(html).toContain("characters · 2 MB limit");
  });

  it("shows the zero-change summary and keeps the table selected by default", () => {
    const html = centerMarkup([]);
    expect(html).toContain("No changes found.");
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*>Table grid view/);
  });

  it("summarizes mixed findings using the current severity counts", () => {
    const findings = mixedFindings();
    const counts = {
      breaking: findings.filter((item) => item.severity === "breaking").length,
      warning: findings.filter((item) => item.severity === "warning").length,
      safe: findings.filter((item) => item.severity === "safe").length,
    };
    expect(counts.warning).toBeGreaterThan(0);
    expect(counts.safe).toBeGreaterThan(0);
    expect(centerMarkup(findings)).toContain(
      `${counts.breaking} breaking, ${counts.warning} warning, and ${counts.safe} safe changes found.`,
    );
  });

  it("keeps the table and force graph choices reachable from Advanced view", () => {
    const html = centerMarkup([]);
    const start = html.indexOf("<details");
    const end = html.indexOf("</details>", start);
    const advancedView = html.slice(start, end);
    expect(advancedView).toContain("Advanced view");
    expect(advancedView).toContain("Table grid view");
    expect(advancedView).toContain("3D force graph");
  });

  it("shows the simplified inspector prompt when no change is selected", () => {
    const html = renderToStaticMarkup(
      <WorkbenchInspector
        finding={null}
        candidateVersion="v2"
        index={0}
        total={0}
        onCopyReport={() => undefined}
        onCopyPath={() => undefined}
      />,
    );
    expect(html).toContain("Click a change to see what it means for your consumers.");
  });
});
