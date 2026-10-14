import type { ContractChange, ContractNode, DiffSummary, JsonKind } from "@/lib/contract/types";

export const SEVERITY_ORDER = ["breaking", "warning", "safe", "info"] as const;

export function emptySummary(): DiffSummary {
  return { breaking: 0, warning: 0, safe: 0, info: 0, total: 0 };
}

export interface ChangeFilters {
  query: string;
  /** Empty array means every severity is shown. */
  severities: readonly ContractChange["severity"][];
}

/**
 * Severity + free-text filtering. Matching is case-insensitive across the
 * pointer, the change title and the engine's explanation, so a reviewer can
 * search for either a path or the wording of the rule.
 */
export function filterChanges(changes: readonly ContractChange[], filters: ChangeFilters): ContractChange[] {
  const query = filters.query.trim().toLowerCase();
  const severitySet = new Set(filters.severities);
  return changes.filter((change) => {
    if (severitySet.size > 0 && !severitySet.has(change.severity)) return false;
    if (!query) return true;
    return `${change.pointer} ${change.title} ${change.explanation}`.toLowerCase().includes(query);
  });
}

export interface ChangeGroup {
  severity: ContractChange["severity"];
  changes: ContractChange[];
}

/**
 * Groups findings by severity in the required reading order
 * breaking → warning → safe → info, dropping empty groups. Input order within a
 * group is preserved, which keeps the engine's depth-then-path ordering.
 */
export function groupChangesBySeverity(changes: readonly ContractChange[]): ChangeGroup[] {
  return SEVERITY_ORDER
    .map((severity) => ({ severity, changes: changes.filter((change) => change.severity === severity) }))
    .filter((group) => group.changes.length > 0);
}

export function summarizeChanges(changes: readonly ContractChange[]): DiffSummary {
  const summary = emptySummary();
  summary.total = changes.length;
  for (const change of changes) summary[change.severity] += 1;
  return summary;
}

/* --------------------------------------------------------------------------
 * before / after presentation
 * ------------------------------------------------------------------------ */

const MISSING = "— missing";

/** Type label for one side of a change, matching the inspector's wording. */
export function sideTypeLabel(node: ContractNode | null | undefined): string {
  return node ? node.kinds.join(" | ") : MISSING;
}

/**
 * The most specific evidence value for a side: concrete examples when the
 * engine collected them, otherwise its kind plus requiredness. Never invents a
 * value the engine did not produce.
 */
export function sideValueLabel(node: ContractNode | null | undefined): string {
  if (!node) return MISSING;
  if (node.examples.length > 0) return node.examples.map((example) => JSON.stringify(example)).join(", ");
  return `${node.kinds.join(" | ")} · ${node.required ? "required" : "optional"}`;
}

/**
 * Typical-value summary for a type union. A union such as `string | null` is
 * reported as `string, null` without claiming which value any given payload had.
 */
export function kindsLabel(kinds: readonly JsonKind[]): string {
  return kinds.length === 0 ? "unknown" : kinds.join(" | ");
}

export const EMPTY_FILTERS: ChangeFilters = { query: "", severities: [] };
