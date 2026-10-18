"use client";

import { useMemo } from "react";
import { astDiffInputFor, buildSplitAstDiffHTML } from "@/lib/driftmap/ast-diff";
import { presencePercent, type Finding } from "@/lib/driftmap/presentation";
import { severityPillClass } from "@/lib/driftmap/rules";
import { stringFormatLabel } from "@/lib/contract/formats";

/**
 * Deep finding inspector (right column).
 *
 * Ported from the reference build's `renderWorkbenchInspector`: the compatibility
 * rule citation, the Split JSON AST Diff slice, the baseline and candidate
 * contract summaries with observed values, the sample-frequency readout and the
 * consumer-impact explanation.
 */
export function WorkbenchInspector({
  finding,
  candidateVersion,
  index,
  total,
  onCopyReport,
  onCopyPath,
}: {
  finding: Finding | null;
  candidateVersion: string;
  index: number;
  total: number;
  onCopyReport: () => void;
  onCopyPath: (pointer: string) => void;
}) {
  const astHtml = useMemo(
    () => (finding ? buildSplitAstDiffHTML(astDiffInputFor(finding.change, candidateVersion)) : ""),
    [finding, candidateVersion],
  );

  if (!finding) {
    return (
      <div id="workbench-inspector" className="lg:col-span-3 bg-[#0A0A0D] p-5 flex flex-col justify-between min-w-0">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E]">FINDING INSPECTOR</span>
          <p className="mt-2 text-xs font-mono text-[#5E606E] leading-relaxed">
            Select a finding row, or a node in the 3D force graph, to inspect its evidence.
          </p>
        </div>
      </div>
    );
  }

  const percent = presencePercent(finding);

  return (
    <div id="workbench-inspector" className="lg:col-span-3 bg-[#0A0A0D] p-5 flex flex-col justify-between min-w-0">
      <div className="space-y-3.5">
        <div className="pb-3 border-b border-white/[0.08]">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E]">FINDING INSPECTOR</span>
            <span className={`${severityPillClass(finding.severity)} px-2 py-0.5 rounded-full text-[10px] font-mono shrink-0`}>
              {finding.severity.toUpperCase()}
            </span>
          </div>
          <div className="font-mono text-base font-semibold text-white break-all">{finding.pointer}</div>
          <button
            type="button"
            onClick={() => onCopyPath(finding.pointer)}
            className="mt-1 text-[10px] font-mono text-[#9496A1] hover:text-white transition-colors"
          >
            Copy path
          </button>
        </div>

        <div className="p-2.5 rounded-xl bg-[#050507] border border-white/[0.07] font-mono text-xs">
          <div className="text-[10px] text-[#5E606E] uppercase mb-0.5">Compatibility rule</div>
          <div className="text-white font-medium break-all">{finding.ruleId}</div>
          <div className="text-[10px] text-[#5E606E] mt-1">{finding.title}</div>
        </div>

        {/* `astHtml` is built by `buildSplitAstDiffHTML`, which escapes every
            interpolated pointer segment and example value. */}
        <div dangerouslySetInnerHTML={{ __html: astHtml }} />

        <div className="space-y-2 font-mono text-xs">
          <div className="p-2.5 rounded-xl bg-[#050507] border border-white/[0.07]">
            <div className="text-[10px] text-[#5E606E] uppercase mb-0.5">Baseline contract (v1)</div>
            <div className="text-white font-medium">{finding.baseSummary}</div>
            <div className="text-[11px] text-[#9496A1] mt-0.5 break-all">
              Observed: <code className="text-emerald-300">{finding.baseSample ?? "no sample recorded"}</code>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-[#050507] border border-white/[0.07]">
            <div className="text-[10px] text-[#5E606E] uppercase mb-0.5">Candidate contract ({candidateVersion})</div>
            <div className="text-white font-medium">{finding.candSummary}</div>
            <div className="text-[11px] text-[#9496A1] mt-0.5 break-all">
              Observed: <code className="text-amber-300">{finding.candSample ?? "no sample recorded"}</code>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-white/[0.05] flex items-center justify-between text-[10px] text-[#9496A1]">
              <span>{finding.hasSampleEvidence ? (finding.evidenceUnit === "items" ? "Item frequency" : "Sample frequency") : "Evidence source"}</span>
              <span className="text-white">{finding.hasSampleEvidence ? `${percent}%` : "declared"}</span>
            </div>
          </div>

          {(finding.fromFormat || finding.toFormat) && (
            <div className="p-2.5 rounded-xl bg-[#050507] border border-white/[0.07] flex items-center justify-between gap-2 text-[10px] text-[#9496A1]">
              <span className="uppercase">Detected string format</span>
              <span className="text-white text-right">{stringFormatLabel(finding.fromFormat)} → {stringFormatLabel(finding.toFormat)}</span>
            </div>
          )}
        </div>

        <div className="p-3 rounded-xl bg-[#111116] border border-white/[0.08]">
          <div className="text-[11px] font-mono uppercase tracking-wider text-white mb-1">Consumer impact</div>
          <p className="text-xs text-[#9496A1] leading-relaxed mb-2">{finding.explanation}</p>
          <p className="text-[11px] text-[#5E606E] leading-relaxed border-t border-white/[0.06] pt-2">{finding.ruleExplanation}</p>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t border-white/[0.08] space-y-2">
        <p className="text-[10px] font-mono text-[#5E606E] text-center">Finding {index + 1} of {total}</p>
        <button
          type="button"
          onClick={onCopyReport}
          className="btn-geist-secondary w-full py-2 rounded-lg text-xs font-mono flex items-center justify-center gap-2"
        >
          <span>Copy PR Markdown report</span>
        </button>
      </div>
    </div>
  );
}
