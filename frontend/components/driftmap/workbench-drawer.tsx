"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, FileJson, FolderTree, Pencil, Plus, Trash2, X } from "lucide-react";
import type { ContractDirection, ContractSnapshot, Workspace } from "@/lib/contract/types";

/**
 * Workspace browser drawer.
 *
 * Reuses the sidebar's information architecture — workspaces, their snapshots
 * and payload samples, contract direction, and the rename/delete controls — but
 * presents it as an overlay triggered from the sub-toolbar, which is what the
 * three-pane Obsidian layout leaves room for.
 *
 * Focus is trapped while open, Escape closes it, and focus returns to the
 * trigger, matching the previous workbench shell's behaviour.
 */

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const DIRECTIONS: ReadonlyArray<{ value: ContractDirection; label: string }> = [
  { value: "response", label: "Response payload" },
  { value: "request", label: "Request payload" },
  { value: "event", label: "Event payload" },
];

function snapshotScope(snapshot: ContractSnapshot): string {
  return "kind" in snapshot.contract && snapshot.contract.kind === "openapi"
    ? `${snapshot.contract.operations.length} ops`
    : `${snapshot.samples.length} samples`;
}

export interface WorkbenchDrawerProps {
  open: boolean;
  onClose: () => void;
  workspaces: readonly Workspace[];
  snapshots: readonly ContractSnapshot[];
  active: Workspace | null;
  mode: "local" | "cloud";
  pending: boolean;
  onSelectWorkspace: (id: string) => void;
  onNewWorkspace: () => void;
  onRenameWorkspace: (workspace: Workspace, name: string) => void;
  onDeleteWorkspace: (workspace: Workspace) => void;
  onSwap: () => void;
  onDirection: (direction: ContractDirection) => void;
  onRenameSnapshot: (snapshot: ContractSnapshot, label: string) => void;
  onDeleteSide: (side: "before" | "after") => void;
  onLoadSamplePair: () => void;
}

export function WorkbenchDrawer({
  open,
  onClose,
  workspaces,
  snapshots,
  active,
  mode,
  pending,
  onSelectWorkspace,
  onNewWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onSwap,
  onDirection,
  onRenameSnapshot,
  onDeleteSide,
  onLoadSamplePair,
}: WorkbenchDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const workspaceSnapshots = snapshots.filter((snapshot) => snapshot.workspaceId === active?.id);
  const baselineSnapshotId = active?.baselineSnapshotId ?? null;
  const candidateSnapshotId = active?.candidateSnapshotId ?? null;

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-label="Close workspace browser" onClick={onClose} />
      <div
        ref={panelRef}
        id="workbench-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Workspace browser"
        className="fixed inset-y-0 left-0 z-50 w-[min(92vw,380px)] bg-[#0A0A0D] border-r border-white/[0.1] overflow-y-auto p-5 space-y-6"
      >
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/[0.08]">
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
              {mode === "cloud" ? "CLOUD WORKSPACES" : "LOCAL WORKSPACES"}
            </span>
            <h2 className="text-base font-semibold text-white truncate">{active?.name ?? "No workspace selected"}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-[#9496A1] hover:text-white p-1 shrink-0" aria-label="Close">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <section aria-label="Workspaces">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E]">Workspaces ({workspaces.length})</h3>
            <button
              type="button"
              onClick={onNewWorkspace}
              disabled={pending}
              className="text-[#9496A1] hover:text-white inline-flex items-center gap-1 text-[11px] font-mono disabled:opacity-40"
            >
              <Plus size={12} aria-hidden="true" /> New
            </button>
          </div>

          <ul className="space-y-1">
            {workspaces.length === 0 && <li className="text-xs font-mono text-[#5E606E]">No workspaces yet.</li>}
            {workspaces.map((workspace) => {
              const isActive = workspace.id === active?.id;
              return (
                <li key={workspace.id} className="flex items-center gap-1">
                  {renamingId === workspace.id ? (
                    <form
                      className="flex-1 flex items-center"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const next = renameValue.trim();
                        setRenamingId(null);
                        if (next && next !== workspace.name) onRenameWorkspace(workspace, next);
                      }}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => setRenamingId(null)}
                        onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); setRenamingId(null); } }}
                        className="flex-1 min-w-0 px-2 py-1 rounded-md bg-[#050507] border border-white/[0.14] font-mono text-xs text-white focus:outline-none"
                        aria-label={`Rename ${workspace.name}`}
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectWorkspace(workspace.id)}
                      aria-current={isActive}
                      className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-1.5 rounded-lg font-mono text-xs text-left transition-colors ${
                        isActive ? "bg-white/[0.08] text-white border border-white/20" : "text-[#9496A1] hover:text-white border border-transparent"
                      }`}
                    >
                      <FolderTree size={13} aria-hidden="true" className="shrink-0" />
                      <span className="truncate">{workspace.name}</span>
                      <span className="ml-auto text-[10px] text-[#5E606E] shrink-0">{workspace.direction}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => { setRenamingId(workspace.id); setRenameValue(workspace.name); }}
                    className="p-1 text-[#5E606E] hover:text-white disabled:opacity-40"
                    aria-label={`Rename ${workspace.name}`}
                  >
                    <Pencil size={12} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => onDeleteWorkspace(workspace)}
                    className="p-1 text-[#5E606E] hover:text-rose-400 disabled:opacity-40"
                    aria-label={`Delete ${workspace.name}`}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {active && (
          <section aria-label="Contract direction">
            <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E] mb-2">Contract direction</h3>
            <select
              value={active.direction}
              disabled={pending}
              onChange={(event) => onDirection(event.target.value as ContractDirection)}
              className="w-full bg-[#111116] text-white font-mono text-xs px-3 py-1.5 rounded-lg border border-white/[0.12] focus:outline-none focus:border-white/30"
            >
              {DIRECTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSwap}
              disabled={pending || !baselineSnapshotId || !candidateSnapshotId}
              className="btn-geist-secondary w-full mt-2 py-1.5 rounded-lg text-xs font-mono inline-flex items-center justify-center gap-2 disabled:opacity-40"
            >
              <ArrowLeftRight size={12} aria-hidden="true" /> Swap baseline and candidate
            </button>
          </section>
        )}

        {active && (
          <section aria-label="Snapshots">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-[10px] font-mono uppercase tracking-wider text-[#5E606E]">Snapshots ({workspaceSnapshots.length})</h3>
              <button
                type="button"
                onClick={onLoadSamplePair}
                disabled={pending}
                className="text-[#9496A1] hover:text-white text-[11px] font-mono disabled:opacity-40"
              >
                Load sample pair
              </button>
            </div>

            <ul className="space-y-1.5">
              {workspaceSnapshots.length === 0 && (
                <li className="text-xs font-mono text-[#5E606E]">Import a payload to create one.</li>
              )}
              {workspaceSnapshots.map((snapshot) => {
                const side = snapshot.id === baselineSnapshotId ? "before" : snapshot.id === candidateSnapshotId ? "after" : null;
                return (
                  <li key={snapshot.id} className="rounded-lg border border-white/[0.07] bg-[#050507] px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <FileJson size={13} aria-hidden="true" className="text-[#5E606E] shrink-0" />
                      <span className="font-mono text-xs text-white truncate">{snapshot.versionLabel}</span>
                      {side && (
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full shrink-0 ${side === "before" ? "pill-info" : "pill-safe"}`}>
                          {side === "before" ? "BASELINE" : "CANDIDATE"}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] font-mono text-[#5E606E] shrink-0">{snapshotScope(snapshot)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const label = window.prompt("Snapshot label", snapshot.versionLabel);
                          if (label?.trim() && label.trim() !== snapshot.versionLabel) onRenameSnapshot(snapshot, label.trim());
                        }}
                        className="text-[10px] font-mono text-[#9496A1] hover:text-white disabled:opacity-40"
                      >
                        Rename
                      </button>
                      {side && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => onDeleteSide(side)}
                          className="text-[10px] font-mono text-[#9496A1] hover:text-rose-400 disabled:opacity-40"
                        >
                          Delete
                        </button>
                      )}
                      {snapshot.samples.length > 0 && (
                        <span className="ml-auto text-[10px] font-mono text-[#5E606E] truncate">
                          {snapshot.samples.map((sample) => sample.label).join(" · ")}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <p className="text-[10px] font-mono text-[#5E606E] border-t border-white/[0.08] pt-3">
          {mode === "cloud"
            ? "Cloud mode: snapshots are stored in your account. Local browser data is never uploaded or merged."
            : "Local mode: everything stays in this browser. There is no automatic sync to cloud."}
        </p>
      </div>
    </>
  );
}
