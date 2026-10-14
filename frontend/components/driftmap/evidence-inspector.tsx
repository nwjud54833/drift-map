"use client";

import { useMemo } from "react";
import { astDiffInputFor, buildSplitAstDiffHTML } from "@/lib/driftmap/ast-diff";
import { presencePercent, type Finding, type TimelineRevision } from "@/lib/driftmap/presentation";
import { severityPillClass } from "@/lib/driftmap/rules";

/**
 * Selected-path evidence panel for the hero stage.
 *
 * Ported from the reference build's `renderHeroInspector`: the side-by-side
 * contract evidence boxes, the Split JSON AST Diff slice, and the compatibility
 * rule citation. Every value is the engine's own evidence — the AST slice in
 * particular is built from the real pointer and the engine's recorded examples.
 */
export function EvidenceInspector({
  finding,
  revision,
  index,
  total,
  onOpenInWorkbench,
}: {
  finding: Finding | null;
  revision: TimelineRevision | null;
  index: number;
  total: number;
  onOpenInWorkbench: () => void;
}) {
  const candidateVersion = revision?.version ?? "v2.0-rc1";

  const astHtml = useMemo(() => {
    if (!finding) return "";
    return buildSplitAstDiffHTML(astDiffInputFor(finding.change, candidateVersion));
  }, [finding, candidateVersion]);

  if (!finding) {
    return (
      <div id="hero-inspector-panel" className="lg:col-span-5 p-5 sm:p-6 bg-[#0A0A0D] flex flex-col justify-between relative z-10">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E]">SELECTED PATH EVIDENCE</span>
          <p className="mt-2 text-xs font-mono text-[#5E606E]">
            No structural drift exists between these two revisions, so there is no finding to inspect.
          </p>
        </div>
        <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
          <span className="text-[#5E606E]">0 findings · contracts are identical</span>
          <button type="button" onClick={onOpenInWorkbench} className="text-white hover:text-emerald-400 transition-colors">
            Open in Workbench →
          </button>
        </div>
      </div>
    );
  }

  const percent = presencePercent(finding);

  return (
    <div id="hero-inspector-panel" className="lg:col-span-5 p-5 sm:p-6 bg-[#0A0A0D] flex flex-col justify-between relative z-10">
      <div>
        <div className="flex items-center justify-between gap-2 pb-3 mb-3.5 border-b border-white/[0.07]">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E]">SELECTED PATH EVIDENCE</span>
            <h3 className="font-mono text-base font-semibold text-white mt-0.5 break-all">{finding.pointer}</h3>
          </div>
          <span className={`${severityPillClass(finding.severity)} px-2.5 py-0.5 rounded-full text-xs font-mono shrink-0`}>
            {finding.driftLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3.5 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-[#050507] border border-white/[0.06] min-w-0">
            <div className="text-[10px] text-[#5E606E] mb-0.5">BASELINE (v1)</div>
            <div className="text-white font-medium mb-0.5 truncate">{finding.baseSummary}</div>
            <div className="text-[11px] text-[#9496A1] truncate">
              {finding.baseSample ? (
                <>Sample: <code className="text-emerald-300">{finding.baseSample}</code></>
              ) : (
                <span className="text-[#5E606E]">No sample recorded</span>
              )}
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-[#050507] border border-white/[0.06] min-w-0">
            <div className="text-[10px] text-[#5E606E] mb-0.5">CANDIDATE ({candidateVersion})</div>
            <div className="text-white font-medium mb-0.5 truncate">{finding.candSummary}</div>
            <div className="text-[11px] text-[#9496A1] truncate">
              {finding.candSample ? (
                <>Sample: <code className="text-amber-300">{finding.candSample}</code></>
              ) : (
                <span className="text-[#5E606E]">No sample recorded</span>
              )}
            </div>
          </div>
        </div>

        {/* `astHtml` is built by `buildSplitAstDiffHTML`, which escapes every
            interpolated pointer segment and example value. */}
        <div dangerouslySetInnerHTML={{ __html: astHtml }} />

        <div className="p-3 rounded-xl bg-[#111116] border border-white/[0.08] mb-3">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#9496A1] mb-1">
            <span>
              COMPATIBILITY RULE
              {finding.hasSampleEvidence ? ` (${percent}% presence)` : " (declared)"}
            </span>
            <span className="text-white font-medium truncate">{finding.ruleId}</span>
          </div>
          <p className="text-xs text-[#9496A1] leading-relaxed mb-2">{finding.explanation}</p>
          <p className="text-[11px] text-[#5E606E] leading-relaxed border-t border-white/[0.06] pt-2">{finding.ruleExplanation}</p>
        </div>
      </div>

      <div className="pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono">
        <span className="text-[#5E606E]">Row {index + 1} of {total} · Use ↑/↓ or J/K</span>
        <button type="button" onClick={onOpenInWorkbench} className="text-white hover:text-emerald-400 transition-colors">
          Open in Workbench →
        </button>
      </div>
    </div>
  );
}
