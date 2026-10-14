import type { ContractChange, JsonKind } from "@/lib/contract/types";

/**
 * Split JSON AST diff preview.
 *
 * Ported from `buildSplitAstDiffHTML` in the Obsidian v2.5 "Spatial" reference
 * build. Where the reference synthesises five lines of fake JSON, this renders a
 * four-line slice of the *real* JSON pointer path using the engine's recorded
 * evidence: the pointer's parent object, the leaf key, and each side's observed
 * example values. It still returns markup rather than JSX because it is used by
 * both the hero table and the workbench inspector, matching the reference
 * structure exactly.
 *
 * All interpolated values are HTML-escaped: pointer segments and example values
 * come from user payloads and must never be able to inject markup.
 */

export interface AstSliceTheme {
  lineClass: string;
  valueClass: string;
  sign: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pointerSegments(pointer: string): string[] {
  return pointer.split("/").filter(Boolean);
}

/** Renders one example value the way the engine recorded it. */
export function renderExample(value: string | null): string {
  if (value === null) return "undefined (key omitted)";
  return value;
}

function lineClassFor(severity: ContractChange["severity"]): string {
  if (severity === "breaking") return "ast-line-breaking";
  if (severity === "warning") return "ast-line-warning";
  if (severity === "safe") return "ast-line-safe";
  return "ast-line-info";
}

function valueClassFor(severity: ContractChange["severity"]): string {
  if (severity === "breaking") return "text-rose-300";
  if (severity === "warning") return "text-amber-300";
  return "text-emerald-300";
}

export interface AstDiffInput {
  pointer: string;
  severity: ContractChange["severity"];
  baselineExample: string | null;
  candidateExample: string | null;
  baselineAbsent: boolean;
  candidateAbsent: boolean;
  /** True when the path was added in the candidate. */
  added: boolean;
  candidateVersion: string;
}

/**
 * Parent container line. A wildcard segment means the leaf sits inside an array,
 * which the slice renders in the reference build's `items: [ {` form.
 */
function parentLine(segments: readonly string[]): string {
  if (segments.length <= 1) return "{";
  const [head] = segments;
  const inArray = segments.includes("*");
  return inArray ? `${escapeHtml(head)}: [ {` : `${escapeHtml(head)}: {`;
}

function closeLine(segments: readonly string[]): string {
  if (segments.length <= 1) return "}";
  return segments.includes("*") ? "} ]" : "}";
}

export function buildSplitAstDiffHTML(input: AstDiffInput): string {
  const segments = pointerSegments(input.pointer);
  const leafKey = segments[segments.length - 1] ?? "$";
  const parent = parentLine(segments);
  const close = closeLine(segments);
  const lineClass = lineClassFor(input.severity);
  const valueClass = valueClassFor(input.severity);

  const baselineLine = input.baselineAbsent
    ? `<div class="px-2 py-0.5 text-[#5E606E] italic"><span class="text-[#5E606E] select-none mr-2">03</span>  // key not present</div>`
    : `<div class="px-2 py-0.5 ${lineClass} text-white"><span class="text-[#5E606E] select-none mr-2">03</span>  "${escapeHtml(leafKey)}": <span class="text-emerald-300">${escapeHtml(renderExample(input.baselineExample))}</span></div>`;

  const candidateLine = input.candidateAbsent
    ? `<div class="px-2 py-0.5 ast-line-breaking text-rose-300"><span class="text-rose-400/70 select-none mr-2">03</span>- // "${escapeHtml(leafKey)}" removed</div>`
    : `<div class="px-2 py-0.5 ${lineClass} text-white"><span class="text-[#5E606E] select-none mr-2">03</span>${input.added ? "+" : "~"} "${escapeHtml(leafKey)}": <span class="${valueClass}">${escapeHtml(renderExample(input.candidateExample))}</span></div>`;

  const number = (value: string) => `<span class="text-[#5E606E] select-none mr-2">${value}</span>`;

  return `
    <div class="rounded-xl bg-[#050507] border border-white/[0.08] overflow-hidden mb-4 font-mono text-[11px]">
      <div class="px-3 py-1.5 bg-[#0E0E13] border-b border-white/[0.07] flex items-center justify-between text-[10px] text-[#9496A1]">
        <span class="uppercase tracking-wider">SPLIT JSON AST DIFF · <code class="text-white">${escapeHtml(input.pointer)}</code></span>
        <span class="text-[#5E606E]">Line-level pointer slice</span>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07]">
        <div class="py-2 leading-relaxed overflow-x-auto">
          <div class="px-2 pb-1 text-[9px] uppercase tracking-wider text-[#5E606E]">BASELINE AST (v1)</div>
          <div class="px-2 py-0.5 text-[#5E606E]">${number("01")}{</div>
          <div class="px-2 py-0.5 text-[#9496A1]">${number("02")}  ${parent}</div>
          ${baselineLine}
          <div class="px-2 py-0.5 text-[#9496A1]">${number("04")}  ${close}</div>
        </div>
        <div class="py-2 leading-relaxed overflow-x-auto">
          <div class="px-2 pb-1 text-[9px] uppercase tracking-wider text-[#5E606E]">CANDIDATE AST (${escapeHtml(input.candidateVersion)})</div>
          <div class="px-2 py-0.5 text-[#5E606E]">${number("01")}{</div>
          <div class="px-2 py-0.5 text-[#9496A1]">${number("02")}  ${parent}</div>
          ${candidateLine}
          <div class="px-2 py-0.5 text-[#9496A1]">${number("04")}  ${close}</div>
        </div>
      </div>
    </div>
  `;
}

/** Convenience wrapper: derives the slice inputs from a `ContractChange`. */
export function astDiffInputFor(
  change: Pick<ContractChange, "pointer" | "severity" | "kind" | "before" | "after">,
  candidateVersion: string,
): AstDiffInput {
  const kindsToExample = (examples: readonly (string | number | boolean | null)[], kinds: readonly JsonKind[]): string | null => {
    if (examples.length > 0) return JSON.stringify(examples[0]);
    if (kinds.length > 0) return `<${kinds.join(" | ")}>`;
    return null;
  };
  const optionalRemoval = change.kind === "became-optional" && !change.after;
  return {
    pointer: change.pointer,
    severity: change.severity,
    baselineExample: change.before ? kindsToExample(change.before.examples, change.before.kinds) : null,
    candidateExample: change.after ? kindsToExample(change.after.examples, change.after.kinds) : null,
    baselineAbsent: !change.before,
    candidateAbsent: !change.after && !optionalRemoval,
    added: !change.before && Boolean(change.after),
    candidateVersion,
  };
}
