"use client";

import type { Workspace } from "@/lib/contract/types";
import { getProCheckoutUrl } from "@/lib/client/pro-checkout";
import type { ExampleDiffPresetId } from "@/lib/workbench/example-presets";

/** Workbench actions and workspace controls, kept separate from comparison state. */
export interface WorkbenchToolbarProps {
  workspaces: readonly Workspace[];
  active: Workspace | null;
  mode: "local" | "cloud";
  onChangeMode: (mode: "local" | "cloud") => void;
  onSelectWorkspace: (id: string) => void;
  onOpenDrawer: () => void;
  onFormatJSON: () => void;
  onInferAndCompare: () => void;
  streaming: boolean;
  onToggleStreaming: () => void;
  payloadBytes: number;
  onCopyMarkdown: () => void;
  onExportCI: () => void;
  onExportJSON: () => void;
  onShareReview: () => void;
  sharingReview: boolean;
  pending: boolean;
  onLoadExampleDiff: (preset: ExampleDiffPresetId) => void;
  cloudStatus: string | null;
  onSignIn: () => void;
}

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const secondaryActionClass = "min-h-9 px-2.5 rounded-lg text-xs font-mono inline-flex items-center gap-1.5 text-[#C3C4CC] hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] transition-colors disabled:opacity-50";

export function WorkbenchToolbar({
  workspaces,
  active,
  mode,
  onChangeMode,
  onSelectWorkspace,
  onOpenDrawer,
  onFormatJSON,
  onInferAndCompare,
  streaming,
  onToggleStreaming,
  payloadBytes,
  onCopyMarkdown,
  onExportCI,
  onExportJSON,
  onShareReview,
  sharingReview,
  pending,
  onLoadExampleDiff,
  cloudStatus,
  onSignIn,
}: WorkbenchToolbarProps) {
  const overCap = payloadBytes > MAX_IMPORT_BYTES;
  const checkoutUrl = getProCheckoutUrl();

  return (
    <div className="relative z-30 bg-[#0A0A0D] border-b border-white/[0.08] px-4 sm:px-6 py-2.5">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <div className="inline-flex min-w-0 items-center rounded-lg border border-white/[0.12] bg-[#111116] p-0.5" role="group" aria-label="Workspace">
            <label htmlFor="preset-selector" className="px-2 font-mono text-xs text-[#9496A1]">Workspace</label>
            <select
              id="preset-selector"
              aria-label="Workspace"
              value={active?.id ?? ""}
              disabled={workspaces.length === 0}
              onChange={(event) => {
                if (event.target.value === "__drawer__") onOpenDrawer();
                else onSelectWorkspace(event.target.value);
              }}
              className="min-w-0 max-w-[12rem] truncate bg-transparent px-2 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-white/40 disabled:opacity-60"
            >
              {workspaces.length === 0 && <option value="">No workspaces yet</option>}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name} · {workspace.direction}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenDrawer}
              className="min-h-8 rounded-md border-l border-white/[0.1] px-2 text-[11px] font-mono text-[#C3C4CC] hover:bg-white/[0.06] hover:text-white"
              title="Browse workspaces, snapshots and samples"
              aria-label="Browse workspaces"
            >
              Browse
            </button>
          </div>

          <select
            id="preset-loader"
            value=""
            onChange={(event) => {
              if (event.target.value) onLoadExampleDiff(event.target.value as ExampleDiffPresetId);
            }}
            disabled={pending}
            className="min-h-9 max-w-full rounded-lg border border-white/[0.12] bg-[#111116] px-3 text-xs text-white focus:outline-none focus:border-white/30 disabled:opacity-50"
            aria-label="Try an example"
          >
            <option value="">Try an example…</option>
            <option value="payment-webhook">Payment Webhook Drift · Breaking</option>
            <option value="order-fulfillment">Order Fulfillment API · Warning + Safe</option>
            <option value="openapi-upgrade">OpenAPI 3.0 Spec Upgrade</option>
          </select>

          <button
            type="button"
            onClick={onInferAndCompare}
            disabled={pending}
            className="btn-geist-primary min-h-9 whitespace-nowrap px-3.5 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Infer &amp; Compare</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#050507] border border-white/[0.09] font-mono text-[11px] shrink-0" role="group" aria-label="Storage mode">
            <button
              type="button"
              onClick={() => onChangeMode("local")}
              aria-pressed={mode === "local"}
              className={`min-h-8 px-2.5 rounded-md transition-all ${mode === "local" ? "bg-white text-[#030304] font-semibold" : "text-[#9496A1] hover:text-white"}`}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("cloud")}
              aria-pressed={mode === "cloud"}
              disabled={!cloudStatus}
              title={!cloudStatus ? "Sign in to use cloud" : undefined}
              className={`min-h-8 px-2.5 rounded-md transition-all ${mode === "cloud" ? "bg-white text-[#030304] font-semibold" : "text-[#9496A1] hover:text-white"} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Cloud
            </button>
          </div>

          {!cloudStatus ? (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-[#9496A1]" role="note">
              <span>Sign in to use cloud</span>
              <button type="button" onClick={onSignIn} className="text-sky-300 underline underline-offset-2 hover:text-white">Sign in</button>
            </div>
          ) : (
            <span className="hidden sm:inline text-[10px] font-mono text-[#9496A1]" title={`Signed in: ${cloudStatus}`}>
              {mode === "cloud" ? `Cloud · ${cloudStatus}` : "Cloud available"}
            </span>
          )}

          <span
            title="Total size of both editor payloads against the 2 MB per-document import cap"
            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono border ${
              overCap ? "bg-rose-500/10 text-rose-300 border-rose-500/30" : "bg-white/[0.03] text-[#9496A1] border-white/[0.07]"
            }`}
          >
            {formatBytes(payloadBytes)} / 2.0 MB cap
          </span>

          <details className="relative shrink-0">
            <summary
              aria-label="Advanced workbench actions"
              className="min-h-9 px-3 rounded-lg text-xs font-mono inline-flex list-none cursor-pointer items-center gap-1.5 border border-white/[0.12] bg-[#111116] text-[#C3C4CC] hover:text-white hover:border-white/25 [&::-webkit-details-marker]:hidden"
            >
              Advanced
              <svg className="w-3 h-3 text-[#9496A1]" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-white/[0.12] bg-[#0A0A0D] p-2 shadow-2xl flex flex-col gap-1.5" role="group" aria-label="Advanced workbench actions">
              <button type="button" onClick={onFormatJSON} title="Pretty-print the baseline and candidate JSON" className={secondaryActionClass}>
                {"{ }"} Format JSON
              </button>
              <button type="button" onClick={onToggleStreaming} aria-pressed={streaming} className={secondaryActionClass}>
                <span className={`w-2 h-2 rounded-full ${streaming ? "bg-emerald-400 animate-ping" : "bg-[#5E606E]"}`} />
                {streaming ? "⚡ Streaming live samples…" : "⚡ Simulate live traffic"}
              </button>
              <button type="button" onClick={onCopyMarkdown} className={secondaryActionClass}>Copy Markdown</button>
              {mode === "cloud" && cloudStatus && active?.baselineSnapshotId && (
                <button type="button" onClick={onExportCI} disabled={pending} className={secondaryActionClass} aria-label="Use this workspace in CI or a GitHub Action">
                  Use in CI / GitHub Action
                </button>
              )}
              <button type="button" onClick={onShareReview} disabled={sharingReview || !active?.baselineSnapshotId || !active.candidateSnapshotId} className={secondaryActionClass}>
                {sharingReview ? "Preparing link…" : "Share Review Link"}
              </button>
              <button type="button" onClick={onExportJSON} className={secondaryActionClass}>Export JSON</button>
              <a href={checkoutUrl ?? "/#team-ci-cloud"} target={checkoutUrl ? "_blank" : undefined} rel={checkoutUrl ? "noopener noreferrer" : undefined} className="min-h-9 px-2.5 rounded-lg text-xs font-mono inline-flex items-center text-sky-200 hover:bg-white/[0.05]">
                {checkoutUrl ? "Upgrade to Team CI Cloud" : "Team CI Cloud · Early Access"}
              </a>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
