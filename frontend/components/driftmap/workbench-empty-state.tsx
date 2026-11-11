"use client";

import type { ContractSnapshot } from "@/lib/contract/types";

/**
 * Empty state for the workbench body.
 *
 * The Obsidian three-pane layout always renders the editors, so this banner
 * keeps the first comparison simple while leaving the editors mounted below.
 */
export function WorkbenchEmptyState({
  onLoadSamplePair,
}: {
  baseline: ContractSnapshot | null;
  candidate: ContractSnapshot | null;
  onLoadSamplePair: () => void;
  onImportBaseline: () => void;
  onOpenDrawer: () => void;
}) {
  return (
    <section className="border-b border-white/[0.08] bg-[#070709]" aria-label="Comparison status">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-5">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E] mb-1">Waiting for both sides</div>
          <ol className="grid grid-cols-1 gap-2 text-sm text-[#C3C4CC] sm:grid-cols-3 sm:gap-4">
            <li className="flex min-w-0 items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/[0.12] text-[10px] font-mono text-[#9496A1]">1</span>
              <span>Paste your old response or load the example.</span>
              <button type="button" onClick={onLoadSamplePair} className="btn-geist-secondary shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-mono text-[#C3C4CC]">
                Load the sample pair
              </button>
            </li>
            <li className="flex min-w-0 items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/[0.12] text-[10px] font-mono text-[#9496A1]">2</span>
              <span>Paste the new response into Candidate.</span>
            </li>
            <li className="flex min-w-0 items-center gap-2">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/[0.12] text-[10px] font-mono text-[#9496A1]">3</span>
              <span>Click <strong className="font-medium text-white">Infer &amp; Compare</strong>.</span>
            </li>
          </ol>
          <p className="mt-2 text-[10px] font-mono text-[#5E606E]">
            JSON or OpenAPI 3.0 JSON/YAML · 2 MB max per document · external $ref URLs are blocked.
          </p>
        </div>
      </div>
    </section>
  );
}
