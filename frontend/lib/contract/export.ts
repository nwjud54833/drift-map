import type { ContractDiff, ContractDirection, ContractSnapshot, Workspace } from "./types";
import { sampleWarningsForCounts, sampleWarningsForSnapshots } from "./sample-warnings";

export interface MarkdownReportInput {
  workspaceName: string;
  baselineLabel: string;
  candidateLabel: string;
  direction: ContractDirection;
  /**
   * Sample count for each side, or `null` when that side is an OpenAPI
   * document (mirrors `sampleWarningsForSnapshots`: no sample-count warnings
   * apply to a declaration-only side).
   */
  baselineSamples: number | null;
  candidateSamples: number | null;
  diff: ContractDiff;
}

/**
 * Pure Markdown report: no Workspace or storage objects, so the CLI and any
 * other caller can produce the exact document the workbench produces from a
 * diff plus display labels.
 */
export function buildMarkdownReportFromDiff(input: MarkdownReportInput): string {
  const sampleWarnings = sampleWarningsForCounts(input.baselineSamples ?? 0, input.candidateSamples ?? 0);
  const warningRows = sampleWarnings.map((warning) => `- **${warning.code}:** ${warning.message}`).join("\n");
  const rows = input.diff.changes.map((change) => {
    const before = change.before ? `${change.before.kinds.join(" | ")} (${change.before.required ? "required" : "optional"})` : "missing";
    const after = change.after ? `${change.after.kinds.join(" | ")} (${change.after.required ? "required" : "optional"})` : "missing";
    return `### ${change.severity.toUpperCase()} · \`${change.pointer}\`\n\n- **Change:** ${change.kind}\n- **Before:** ${before}\n- **After:** ${after}\n- **Why:** ${change.explanation}\n`;
  }).join("\n");
  return `# Contract Drift Report\n\n**Workspace:** ${input.workspaceName}\n\n**Baseline:** ${input.baselineLabel}\n\n**Candidate:** ${input.candidateLabel}\n\n**Direction:** ${input.direction}\n\n## Summary\n\n${input.diff.summary.breaking} breaking · ${input.diff.summary.warning} warning · ${input.diff.summary.safe} safe · ${input.diff.summary.info} info\n\n<!-- sampleWarnings: ${JSON.stringify(sampleWarnings)} -->\n\n${sampleWarnings.length ? `## Sample warnings\n\n${warningRows}\n\n` : ""}## Changes\n\n${rows || "No structural drift detected.\n"}\n> Sample inference is evidence, not proof of the producer's formal schema. Requiredness is based on the samples provided and may not reflect the real API.\n`;
}

function sampleCountOf(snapshot: ContractSnapshot | null): number | null {
  if (!snapshot) return null;
  if ("kind" in snapshot.contract && snapshot.contract.kind === "openapi") return null;
  return snapshot.samples.length;
}

export function buildMarkdownReport(workspace: Workspace, baseline: ContractSnapshot, candidate: ContractSnapshot, diff: ContractDiff): string {
  return buildMarkdownReportFromDiff({
    workspaceName: workspace.name,
    baselineLabel: baseline.versionLabel,
    candidateLabel: candidate.versionLabel,
    direction: workspace.direction,
    baselineSamples: sampleCountOf(baseline),
    candidateSamples: sampleCountOf(candidate),
    diff,
  });
}

export function buildWorkspaceExport(workspace: Workspace, baseline: ContractSnapshot | null, candidate: ContractSnapshot | null): string {
  return JSON.stringify({
    format: "contract-atlas-workspace",
    version: 1,
    exportedAt: new Date().toISOString(),
    sampleWarnings: sampleWarningsForSnapshots(baseline, candidate),
    workspace,
    baseline,
    candidate,
  }, null, 2);
}
