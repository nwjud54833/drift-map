"use client";

import { useState } from "react";

export interface CIExportCredentials {
  baselineUrl: string;
  promoteToken: string;
  badgeMarkdown: string;
  revision: string;
  pathCount: number;
  lastPromotedAt: string | null;
  commitSha: string | null;
  actor: string | null;
  expiresAt: number;
}

export const DRIFTMAP_GITHUB_WORKFLOW = `name: DriftMap contract review

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read
  pull-requests: write

jobs:
  contract-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nwjud54833/drift-map@v2.5.10
        with:
          baseline-path: \${{ secrets.DRIFTMAP_BASELINE_URL }}
          candidate-path: samples/*.json
          fail-on: breaking
          github-token: \${{ secrets.GITHUB_TOKEN }}
          promote-on-push: true
          promote-token: \${{ secrets.DRIFTMAP_PROMOTE_TOKEN }}
          webhook-url: \${{ secrets.DRIFTMAP_WEBHOOK_URL }}
`;

async function copy(value: string, setCopied: (value: boolean) => void) {
  try { await navigator.clipboard.writeText(value); setCopied(true); }
  catch { setCopied(false); }
}

export function CIExportModal({ credentials, onClose }: { credentials: CIExportCredentials; onClose: () => void }) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedBadge, setCopiedBadge] = useState(false);
  const [copiedWorkflow, setCopiedWorkflow] = useState(false);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="ci-export-title" className="obsidian-card max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/15 p-5 shadow-2xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-sky-300">Team CI Cloud</p>
            <h2 id="ci-export-title" className="text-xl font-semibold text-white">Use this baseline in GitHub Actions</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#A4A5AE]">Save the read URL and promotion token as repository secrets. The separate badge token exposes only the status badge, not the baseline contract.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-[#A4A5AE] hover:bg-white/10 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="space-y-5">
          <div className="grid gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 sm:grid-cols-2">
            <div><p className="font-mono text-[10px] uppercase tracking-wider text-[#777985]">Current baseline revision</p><p className="mt-1 truncate font-mono text-sm text-white">{credentials.revision} · {credentials.pathCount} paths</p></div>
            <div><p className="font-mono text-[10px] uppercase tracking-wider text-[#777985]">Last promoted</p><p className="mt-1 text-sm text-white">{credentials.lastPromotedAt ? new Date(credentials.lastPromotedAt).toLocaleString() : "Not promoted by CI yet"}</p>{credentials.commitSha && <p className="mt-1 font-mono text-[10px] text-[#8C8D98]">{credentials.commitSha.slice(0, 12)}{credentials.actor ? ` · ${credentials.actor}` : ""}</p>}</div>
          </div>
          <CredentialBlock label="Secret: DRIFTMAP_BASELINE_URL" value={credentials.baselineUrl} copied={copiedUrl} onCopy={() => void copy(credentials.baselineUrl, setCopiedUrl)} />
          <CredentialBlock label="Secret: DRIFTMAP_PROMOTE_TOKEN" value={credentials.promoteToken} copied={copiedToken} onCopy={() => void copy(credentials.promoteToken, setCopiedToken)} />
          <CredentialBlock label="README badge Markdown · token is badge-only" value={credentials.badgeMarkdown} copied={copiedBadge} onCopy={() => void copy(credentials.badgeMarkdown, setCopiedBadge)} copyLabel="Copy README Badge Markdown" copiedLabel="Badge Markdown Copied" />
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <label htmlFor="driftmap-workflow" className="font-mono text-xs text-[#D4D4DA]">.github/workflows/driftmap.yml</label>
              <button type="button" onClick={() => void copy(DRIFTMAP_GITHUB_WORKFLOW, setCopiedWorkflow)} className="btn-geist-secondary rounded-md px-2.5 py-1 text-[11px] font-mono">{copiedWorkflow ? "Copied" : "Copy YAML"}</button>
            </div>
            <textarea id="driftmap-workflow" readOnly value={DRIFTMAP_GITHUB_WORKFLOW} rows={19} className="w-full resize-y rounded-xl border border-white/10 bg-[#07070A] p-3 font-mono text-xs leading-5 text-[#D4D4DA] focus:outline-none" />
          </div>
          <p className="text-[11px] leading-5 text-[#777985]">Tokens expire {new Date(credentials.expiresAt * 1000).toLocaleDateString()}. Rotate them from this panel when needed; the Secret values are shown only in this session.</p>
        </div>
      </section>
    </div>
  );
}

function CredentialBlock({ label, value, copied, onCopy, copyLabel, copiedLabel }: { label: string; value: string; copied: boolean; onCopy: () => void; copyLabel?: string; copiedLabel?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="font-mono text-xs text-[#D4D4DA]">{label}</label>
        <button type="button" onClick={onCopy} className="btn-geist-secondary rounded-md px-2.5 py-1 text-[11px] font-mono">{copied ? (copiedLabel ?? "Copied") : (copyLabel ?? "Copy")}</button>
      </div>
      <input readOnly value={value} className="w-full rounded-lg border border-white/10 bg-[#07070A] px-3 py-2 font-mono text-xs text-[#D4D4DA]" aria-label={label} />
    </div>
  );
}
