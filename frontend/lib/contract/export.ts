import type { ContractDiff, ContractSnapshot, Workspace } from "./types";

export function buildMarkdownReport(workspace: Workspace, baseline: ContractSnapshot, candidate: ContractSnapshot, diff: ContractDiff): string {
  const rows = diff.changes.map((change) => {
    const before = change.before ? `${change.before.kinds.join(" | ")} (${change.before.required ? "required" : "optional"})` : "missing";
    const after = change.after ? `${change.after.kinds.join(" | ")} (${change.after.required ? "required" : "optional"})` : "missing";
    return `### ${change.severity.toUpperCase()} · \`${change.pointer}\`\n\n- **Change:** ${change.kind}\n- **Before:** ${before}\n- **After:** ${after}\n- **Why:** ${change.explanation}\n`;
  }).join("\n");
  return `# Contract Drift Report\n\n**Workspace:** ${workspace.name}\n\n**Baseline:** ${baseline.versionLabel}\n\n**Candidate:** ${candidate.versionLabel}\n\n**Direction:** ${workspace.direction}\n\n## Summary\n\n${diff.summary.breaking} breaking · ${diff.summary.warning} warning · ${diff.summary.safe} safe · ${diff.summary.info} info\n\n## Changes\n\n${rows || "No structural drift detected.\n"}\n> Sample inference is evidence, not proof of the producer's formal schema.\n`;
}

export function buildWorkspaceExport(workspace: Workspace, baseline: ContractSnapshot | null, candidate: ContractSnapshot | null): string {
  return JSON.stringify({ format: "contract-atlas-workspace", version: 1, exportedAt: new Date().toISOString(), workspace, baseline, candidate }, null, 2);
}
