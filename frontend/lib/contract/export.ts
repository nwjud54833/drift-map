import type { ContractDiff, ContractSnapshot, Workspace } from "./types";
import { sampleWarningsForSnapshots } from "./sample-warnings";

export function buildMarkdownReport(workspace: Workspace, baseline: ContractSnapshot, candidate: ContractSnapshot, diff: ContractDiff): string {
  const sampleWarnings = sampleWarningsForSnapshots(baseline, candidate);
  const warningRows = sampleWarnings.map((warning) => `- **${warning.code}:** ${warning.message}`).join("\n");
  const rows = diff.changes.map((change) => {
    const before = change.before ? `${change.before.kinds.join(" | ")} (${change.before.required ? "required" : "optional"})` : "missing";
    const after = change.after ? `${change.after.kinds.join(" | ")} (${change.after.required ? "required" : "optional"})` : "missing";
    return `### ${change.severity.toUpperCase()} · \`${change.pointer}\`\n\n- **Change:** ${change.kind}\n- **Before:** ${before}\n- **After:** ${after}\n- **Why:** ${change.explanation}\n`;
  }).join("\n");
  return `# Contract Drift Report\n\n**Workspace:** ${workspace.name}\n\n**Baseline:** ${baseline.versionLabel}\n\n**Candidate:** ${candidate.versionLabel}\n\n**Direction:** ${workspace.direction}\n\n## Summary\n\n${diff.summary.breaking} breaking · ${diff.summary.warning} warning · ${diff.summary.safe} safe · ${diff.summary.info} info\n\n<!-- sampleWarnings: ${JSON.stringify(sampleWarnings)} -->\n\n${sampleWarnings.length ? `## Sample warnings\n\n${warningRows}\n\n` : ""}## Changes\n\n${rows || "No structural drift detected.\n"}\n> Sample inference is evidence, not proof of the producer's formal schema. Requiredness is based on the samples provided and may not reflect the real API.\n`;
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
