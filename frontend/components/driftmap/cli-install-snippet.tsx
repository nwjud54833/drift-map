"use client";

import { useState } from "react";

export const DRIFTMAP_CLI_COMMAND = "npx driftmap diff --baseline main.json --candidate candidate.json";

export function CliInstallSnippet() {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "unavailable">("idle");

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(DRIFTMAP_CLI_COMMAND);
      setCopyState("copied");
    } catch {
      setCopyState("unavailable");
    }
  }

  return (
    <section aria-label="Install and run the DriftMap CLI" className="mx-auto max-w-2xl rounded-2xl border border-white/[0.1] bg-[#070709]/90 p-3 text-left shadow-xl shadow-black/10 backdrop-blur-md sm:p-4">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#777985]">Quick start · no global install</p>
        <span className="font-mono text-[10px] text-[#5E606E]">Node.js</span>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#0D0E13] px-3 py-2.5 sm:px-4">
        <span aria-hidden="true" className="select-none font-mono text-emerald-400">$</span>
        <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-[#E5E7EB] sm:text-xs">
          {DRIFTMAP_CLI_COMMAND}
        </code>
        <button
          type="button"
          onClick={copyCommand}
          aria-label={copyState === "copied" ? "CLI command copied" : "Copy CLI command"}
          className="shrink-0 rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-[#D4D4DA] transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {copyState === "copied" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="mt-2 min-h-4 px-1 text-[10px] text-[#777985]">
        {copyState === "copied" ? "Command copied to clipboard." : copyState === "unavailable" ? "Clipboard unavailable — select the command to copy it." : "Compare two JSON samples directly from your terminal."}
      </p>
    </section>
  );
}
