"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ContractDirection, Workspace } from "@/lib/contract/types";
import { ArrowLeftRight, Cloud, Download, FileText, GitCompareArrows, Menu, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { AuthControl } from "../contract-atlas/auth-control";
import { SessionStatus } from "../contract-atlas/cloud-access-prompt";
import { DriftMapLogo } from "./logo";

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

export function WorkspaceHeader(props: WorkspaceHeaderProps) {
  const { workspaces, active, mode, cloudAvailable, sessionStatus, onModeChange, onSelect, onImport, onNew, onRename, onDelete, onSwap, onDeleteSnapshot, onDirection, onExport, onRaw, onPalette } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
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

  const nav = (
    <nav className="dm-nav" aria-label="Primary">
      <Link href="/" className="dm-brand" aria-label="DriftMap home">
        <DriftMapLogo size={24} />
        <span className="dm-brand-name">DriftMap</span>
      </Link>

      <label className="dm-mode" aria-label="Storage mode">
        <span className={`dm-mode-dot ${mode === "cloud" ? "is-cloud" : "is-local"}`} aria-hidden="true" />
        <select value={mode} onChange={(event) => onModeChange(event.target.value as "local" | "cloud")}>
          <option value="local">Local{mode === "local" ? " storage" : ""}</option>
          <option value="cloud">{sessionStatus === "loading" ? "Cloud · checking…" : cloudAvailable ? "Cloud sync" : "Cloud · sign in"}</option>
        </select>
        <Cloud size={13} aria-hidden="true" className="dm-mode-icon" />
      </label>

      <div className="dm-nav-group">
        <span className="dm-nav-label">Workspace</span>
        <div className="dm-nav-controls">
          <select aria-label="Active workspace" value={active?.id ?? ""} onChange={(event) => onSelect(event.target.value)}>
            {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
          <button className="dm-icon-btn" title="New workspace" aria-label="New workspace" onClick={onNew}><Plus size={14} /></button>
        </div>
        <div className="dm-nav-controls">
          <select aria-label="Contract direction" value={active?.direction ?? "event"} onChange={(event) => onDirection(event.target.value as ContractDirection)}>
            <option value="response">Response</option>
            <option value="request">Request</option>
            <option value="event">Event</option>
          </select>
          <button className="dm-icon-btn" title="Swap baseline and candidate" aria-label="Swap snapshots" disabled={!active} onClick={onSwap}><ArrowLeftRight size={14} /></button>
        </div>
      </div>

      <div className="dm-nav-group">
        <span className="dm-nav-label">Compare</span>
        <button className="dm-nav-item" onClick={() => onImport("before")}><Upload size={14} aria-hidden="true" />Import baseline</button>
        <button className="dm-nav-item" onClick={() => onImport("after")}><Upload size={14} aria-hidden="true" />Import candidate</button>
        <button className="dm-nav-item" disabled={!active} onClick={() => onExport("report")}><FileText size={14} aria-hidden="true" />Export report</button>
        <button className="dm-nav-item" disabled={!active} onClick={onRaw}><Download size={14} aria-hidden="true" />Raw JSON</button>
      </div>

      <div className="dm-nav-group dm-nav-secondary">
        <button className="dm-nav-item" onClick={onPalette}><GitCompareArrows size={14} aria-hidden="true" />Command menu <kbd>⌘K</kbd></button>
        <button className="dm-nav-item" disabled={!active} onClick={onRename}><Pencil size={14} aria-hidden="true" />Rename workspace</button>
        <button className="dm-nav-item is-danger" disabled={!active} onClick={() => runMenuAction(() => onDeleteSnapshot("before"))}><Trash2 size={14} aria-hidden="true" />Delete baseline</button>
        <button className="dm-nav-item is-danger" disabled={!active} onClick={() => runMenuAction(() => onDeleteSnapshot("after"))}><Trash2 size={14} aria-hidden="true" />Delete candidate</button>
        <button className="dm-nav-item is-danger" disabled={!active} onClick={onDelete}><Trash2 size={14} aria-hidden="true" />Delete workspace</button>
      </div>

      <div className="dm-nav-foot">
        <SessionStatus status={sessionStatus} />
        <AuthControl user={session?.user ?? null} />
      </div>
    </nav>
  );

  return (
    <>
      {/* Mobile top bar with drawer toggle */}
      <header className="dm-topbar">
        <Link href="/" className="dm-brand" aria-label="DriftMap home"><DriftMapLogo size={20} /><span className="dm-brand-name">DriftMap</span></Link>
        <span className={`dm-mode-chip ${mode === "cloud" ? "is-cloud" : ""}`}>{mode === "cloud" ? "Cloud" : "Local"}</span>
        <button className="dm-icon-btn dm-drawer-toggle" aria-expanded={drawerOpen} aria-controls="dm-drawer" aria-label="Toggle navigation" onClick={() => setDrawerOpen((open) => !open)}>
          {drawerOpen ? <X size={16} /> : <Menu size={16} />}
        </button>
      </header>
      <aside id="dm-drawer" className={`dm-drawer ${drawerOpen ? "is-open" : ""}`} aria-hidden={!drawerOpen}>{nav}</aside>

      {/* Desktop sidebar */}
      <aside className="dm-sidebar" aria-label="Primary">{nav}</aside>
    </>
  );
}
