"use client";

import { useState } from "react";
import { toast } from "@/components/ui/toast";

export function ReviewLinkModal({ url, expiresAt, onClose }: { url: string; expiresAt?: number; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Read-only review link copied");
    } catch {
      toast.error("Clipboard access is unavailable. Select and copy the link manually.");
    }
  }

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="review-link-title" className="obsidian-card w-full max-w-xl rounded-2xl border border-white/15 p-5 shadow-2xl sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">READ-ONLY PREVIEW</p>
            <h2 id="review-link-title" className="text-xl font-semibold text-white">Share contract review</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-[#A4A5AE] hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#A4A5AE]">Anyone with this link can inspect the baseline and candidate payloads and their diff. Share it only with people allowed to see those payloads.</p>
        <label htmlFor="driftmap-review-link" className="mt-5 mb-2 block font-mono text-xs text-[#D4D4DA]">Read-only review URL</label>
        <div className="flex gap-2">
          <input id="driftmap-review-link" readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#07070A] px-3 py-2 font-mono text-xs text-[#D4D4DA]" />
          <button type="button" onClick={() => void copyLink()} className="btn-geist-primary shrink-0 rounded-lg px-3 py-2 text-xs">{copied ? "Copied" : "Copy link"}</button>
        </div>
        {expiresAt && <p className="mt-3 text-[11px] text-[#777985]">Signed link expires {new Date(expiresAt * 1000).toLocaleString()}.</p>}
      </section>
    </div>
  );
}
