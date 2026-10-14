"use client";

import type { ContractSnapshot } from "@/lib/contract/types";

/**
 * Empty state for the workbench body.
 *
 * The Obsidian three-pane layout always renders the editors, so this banner
 * explains what is still missing and offers the three real ways to fill the gap:
 * the bundled sample pair, the workspace browser, or the editors themselves.
 */
export function WorkbenchEmptyState({
  baseline,
  candidate,
  onLoadSamplePair,
  onImportBaseline,
  onOpenDrawer,
}: {
  baseline: ContractSnapshot | null;
  candidate: ContractSnapshot | null;
  onLoadSamplePair: () => void;
  onImportBaseline: () => void;
  onOpenDrawer: () => void;
}) {
  const message = baseline && !candidate
    ? "The baseline is set. Paste a candidate payload into the lower editor and choose “Set as candidate”."
    : candidate && !baseline
      ? "The candidate is set. Paste a baseline payload into the upper editor and choose “Set as baseline”."
      : "Paste a baseline and a candidate payload into the two editors and choose “Set as …” on each, or load the bundled sample pair.";

  return (
    <section className="border-b border-white/[0.08] bg-[#070709]" aria-label="Comparison status">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E] mb-1">Waiting for both sides</div>
          <p className="text-sm text-[#9496A1] max-w-2xl leading-relaxed">{message}</p>
          <p className="text-[11px] font-mono text-[#5E606E] mt-2">
            Imports are capped at 2 MB per document. OpenAPI 3.0 JSON and YAML are supported; external $ref URLs are rejected.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button type="button" onClick={onLoadSamplePair} className="btn-geist-primary px-4 py-2 rounded-lg text-xs">
            Load the sample pair
          </button>
          <button type="button" onClick={onImportBaseline} className="btn-geist-secondary px-4 py-2 rounded-lg text-xs font-mono">
            Use the baseline editor
          </button>
          <button type="button" onClick={onOpenDrawer} className="btn-geist-secondary px-4 py-2 rounded-lg text-xs font-mono">
            Browse workspaces
          </button>
        </div>
      </div>
    </section>
  );
}
