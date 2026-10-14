"use client";

import type { Workspace } from "@/lib/contract/types";

/**
 * Workbench sub-toolbar.
 *
 * Ported from the reference build's workbench toolbar: workspace selection,
 * preset loading, `{ } Format JSON`, `Infer & Compare`, `⚡ Simulate Live
 * Traffic`, the local IndexedDB / cloud sync status, the payload size badge with
 * the 2 MB cap, `Copy Markdown` and `Export JSON`.
 *
 * Every control is wired to the existing workbench state and export functions —
 * nothing here invents data.
 */

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
  onExportJSON: () => void;
  pending: boolean;
  onLoadSamplePair: () => void;
  cloudStatus: string | null;
  onSignIn: () => void;
}

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

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
  onExportJSON,
  pending,
  onLoadSamplePair,
  cloudStatus,
  onSignIn,
}: WorkbenchToolbarProps) {
  const overCap = payloadBytes > MAX_IMPORT_BYTES;

  return (
    <div className="bg-[#0A0A0D] border-b border-white/[0.08] px-4 sm:px-6 py-2.5">
      <div className="max-w-[1440px] mx-auto flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-2 shrink-0">
            <span className={`w-2 h-2 rounded-full ${mode === "cloud" ? "bg-sky-400" : "bg-emerald-400"}`} />
            <span className="font-mono text-xs text-[#9496A1]">WORKSPACE:</span>
          </div>

          <select
            id="preset-selector"
            value={active?.id ?? ""}
            disabled={workspaces.length === 0}
            onChange={(event) => {
              if (event.target.value === "__drawer__") onOpenDrawer();
              else onSelectWorkspace(event.target.value);
            }}
            className="bg-[#111116] text-white font-mono text-xs px-3 py-1.5 rounded-lg border border-white/[0.12] focus:outline-none focus:border-white/30 max-w-[16rem] truncate"
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
            className="btn-geist-secondary px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#9496A1] hover:text-white"
            title="Browse workspaces, snapshots and samples"
          >
            Browse
          </button>

          <select
            id="preset-loader"
            value=""
            onChange={(event) => {
              if (event.target.value === "sample") onLoadSamplePair();
              else if (event.target.value === "blank") onFormatJSON();
            }}
            className="bg-[#111116] text-white font-mono text-xs px-3 py-1.5 rounded-lg border border-white/[0.12] focus:outline-none focus:border-white/30"
            aria-label="Load a preset"
          >
            <option value="">Presets…</option>
            <option value="sample">Order webhook · v1 → v2 (sample pair)</option>
            <option value="blank">Format the current editors</option>
          </select>

          <button
            type="button"
            onClick={onFormatJSON}
            title="Pretty-print the baseline and candidate JSON"
            className="btn-geist-secondary px-2.5 py-1.5 rounded-lg text-xs font-mono text-[#9496A1] hover:text-white"
          >
            {"{ }"} Format JSON
          </button>

          <button
            type="button"
            onClick={onInferAndCompare}
            disabled={pending}
            className="btn-geist-primary px-3.5 py-1.5 rounded-lg text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            <span>Infer &amp; Compare</span>
          </button>

          <button
            type="button"
            onClick={onToggleStreaming}
            aria-pressed={streaming}
            className="btn-geist-secondary px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center gap-1.5"
          >
            <span className={`w-2 h-2 rounded-full ${streaming ? "bg-emerald-400 animate-ping" : "bg-[#5E606E]"}`} />
            <span>{streaming ? "⚡ Streaming live samples…" : "⚡ Simulate live traffic"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#050507] border border-white/[0.09] font-mono text-[11px] shrink-0" role="group" aria-label="Storage mode">
            <button
              type="button"
              onClick={() => onChangeMode("local")}
              aria-pressed={mode === "local"}
              className={`px-2.5 py-1 rounded-md transition-all ${mode === "local" ? "bg-white text-[#030304] font-semibold" : "text-[#9496A1] hover:text-white"}`}
            >
              Local
            </button>
            <button
              type="button"
              onClick={() => onChangeMode("cloud")}
              aria-pressed={mode === "cloud"}
              className={`px-2.5 py-1 rounded-md transition-all ${mode === "cloud" ? "bg-white text-[#030304] font-semibold" : "text-[#9496A1] hover:text-white"}`}
            >
              Cloud
            </button>
          </div>

          {mode === "cloud" ? (
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-sky-500/10 text-sky-300 border border-sky-500/25 max-w-[16rem] truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span className="truncate">{cloudStatus ? `Cloud · ${cloudStatus}` : "Cloud · not signed in"}</span>
            </span>
          ) : (
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>IndexedDB local</span>
            </span>
          )}

          {mode === "cloud" && !cloudStatus && (
            <button type="button" onClick={onSignIn} className="text-[11px] font-mono text-sky-300 hover:text-white transition-colors">
              Sign in
            </button>
          )}

          <span
            title="Total size of both editor payloads against the 2 MB per-document import cap"
            className={`hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-mono border ${
              overCap ? "bg-rose-500/10 text-rose-300 border-rose-500/30" : "bg-white/[0.03] text-[#9496A1] border-white/[0.07]"
            }`}
          >
            {formatBytes(payloadBytes)} / 2.0 MB cap
          </span>

          <button
            type="button"
            onClick={onCopyMarkdown}
            className="btn-geist-secondary px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            <span>Copy Markdown</span>
          </button>

          <button
            type="button"
            onClick={onExportJSON}
            className="btn-geist-secondary px-3 py-1.5 rounded-lg text-xs font-mono inline-flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
}
