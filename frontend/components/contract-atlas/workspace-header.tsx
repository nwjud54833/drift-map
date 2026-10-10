"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ContractDirection, Workspace } from "@/lib/contract/types";
import { ArrowLeftRight, Download, FileText, MoreHorizontal, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { AuthControl } from "./auth-control";
import { useSession } from "next-auth/react";

interface WorkspaceHeaderProps {
  workspaces: Workspace[];
  active: Workspace | null;
  mode: "local" | "cloud";
  cloudAvailable: boolean;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  onModeChange: (mode: "local" | "cloud") => void;
  onSelect: (id: string) => void;
  onImport: (side: "before" | "after") => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSwap: () => void;
  onDeleteSnapshot: (side: "before" | "after") => void;
  onDirection: (direction: ContractDirection) => void;
  onExport: (kind: "workspace" | "report") => void;
  onRaw: () => void;
  onPalette: () => void;
}

export function WorkspaceHeader({ workspaces, active, mode, cloudAvailable, sessionStatus, onModeChange, onSelect, onImport, onNew, onRename, onDelete, onSwap, onDeleteSnapshot, onDirection, onExport, onRaw, onPalette }: WorkspaceHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: session } = useSession();
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setMenuOpen(false); menuButtonRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  function runMenuAction(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <header className="ca-header">
      <Link href="/" className="ca-brand" aria-label="Contract Atlas home"><span className="ca-brand-mark">CA</span><strong>Contract Atlas</strong></Link>
      <span className="ca-header-sep" />
      <select aria-label="Storage mode" value={mode} onChange={(event) => onModeChange(event.target.value as "local" | "cloud")}>
        <option value="local">Local</option>
        <option value="cloud">Cloud{sessionStatus === "loading" ? " · checking" : cloudAvailable ? "" : " · sign in"}</option>
      </select>
      <select aria-label="Active workspace" value={active?.id ?? ""} onChange={(event) => onSelect(event.target.value)}>
        {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
      </select>
      <select aria-label="Contract direction" value={active?.direction ?? "event"} onChange={(event) => onDirection(event.target.value as ContractDirection)}>
        <option value="response">Response</option>
        <option value="request">Request</option>
        <option value="event">Event</option>
      </select>
      <div className="ca-header-actions">
        <button onClick={() => onImport("before")}><Upload size={14} /><span className="ca-action-label">Import </span>Baseline</button>
        <button onClick={() => onImport("after")}><Upload size={14} /><span className="ca-action-label">Import </span>Candidate</button>
        <button onClick={() => onExport("report")}><FileText size={14} /><span className="ca-action-label">Export </span>Report</button>
        <div className="ca-menu-wrap">
          <button
            ref={menuButtonRef}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Workspace actions"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <MoreHorizontal size={15} /><span className="ca-action-label">Actions</span>
          </button>
          {menuOpen && (
            <>
              <div className="ca-menu-backdrop" onMouseDown={() => setMenuOpen(false)} />
              <div className="ca-menu" role="menu" aria-label="Workspace actions">
                <button role="menuitem" onClick={() => runMenuAction(onNew)}><Plus size={14} />New workspace</button>
                <button role="menuitem" disabled={!active} onClick={() => runMenuAction(onRename)}><Pencil size={14} />Rename workspace</button>
                <button role="menuitem" disabled={!active} onClick={() => runMenuAction(onSwap)}><ArrowLeftRight size={14} />Swap snapshots</button>
                <hr />
                <button role="menuitem" disabled={!active} onClick={() => runMenuAction(() => onExport("workspace"))}><Download size={14} />Backup workspace</button>
                <button role="menuitem" disabled={!active} onClick={() => runMenuAction(onRaw)}><FileText size={14} />Raw JSON drawer</button>
                <button role="menuitem" className="is-danger" disabled={!active} onClick={() => runMenuAction(() => onDeleteSnapshot("before"))}><Trash2 size={14} />Delete baseline snapshot</button>
                <button role="menuitem" className="is-danger" disabled={!active} onClick={() => runMenuAction(() => onDeleteSnapshot("after"))}><Trash2 size={14} />Delete candidate snapshot</button>
                <hr />
                <button role="menuitem" className="is-danger" disabled={!active} onClick={() => runMenuAction(onDelete)}><Trash2 size={14} />Delete workspace</button>
              </div>
            </>
          )}
        </div>
      </div>
      <button className="ca-palette-button" onClick={onPalette} aria-label="Open command palette (Ctrl or Cmd plus K)"><kbd>Ctrl K</kbd></button>
      <AuthControl user={session?.user ?? null} />
    </header>
  );
}
