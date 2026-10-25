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

export interface WorkspaceExportOptions {
  /**
   * Strip payload evidence from the export: sample values are omitted, the
   * inferred contract's observed examples are cleared, and OpenAPI documents
   * are replaced by a redaction notice. Samples may contain PII, so exports
   * produced in cloud mode default to redacted. Local-mode exports keep full
   * fidelity unless the caller opts in.
   */
  redactSamples?: boolean;
}

/**
 * Removes sample evidence from one snapshot. The `value` key is dropped rather
 * than nulled so the shape stays self-describing; a top-level
 * `sampleValuesRedacted: true` flag on the export marks the mode.
 */
function redactSnapshot(snapshot: ContractSnapshot | null) {
  if (!snapshot) return null;
  const contract = "kind" in snapshot.contract && snapshot.contract.kind === "openapi"
    ? { ...snapshot.contract, document: { redacted: true, note: "The OpenAPI document was omitted from this redacted export." } }
    : { ...snapshot.contract, nodes: snapshot.contract.nodes.map((node) => ({ ...node, examples: [] })) };
  return { ...snapshot, contract, samples: snapshot.samples.map(({ value: _value, ...sample }) => sample) };
}

export function buildWorkspaceExport(
  workspace: Workspace,
  baseline: ContractSnapshot | null,
  candidate: ContractSnapshot | null,
  options: WorkspaceExportOptions = {},
): string {
  const redacted = options.redactSamples === true;
  return JSON.stringify({
    format: "contract-atlas-workspace",
    version: 1,
    exportedAt: new Date().toISOString(),
    sampleWarnings: sampleWarningsForSnapshots(baseline, candidate),
    ...(redacted ? { sampleValuesRedacted: true } : {}),
    workspace,
    baseline: redacted ? redactSnapshot(baseline) : baseline,
    candidate: redacted ? redactSnapshot(candidate) : candidate,
  }, null, 2);
}
