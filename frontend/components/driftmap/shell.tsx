"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ContractDirection, Workspace } from "@/lib/contract/types";
import { ArrowLeftRight, GitCompareArrows, Menu, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { AuthControl } from "../contract-atlas/auth-control";
import { SessionStatus } from "../contract-atlas/cloud-access-prompt";
import { ThemeToggle } from "../theme/theme-toggle";

interface WorkspaceHeaderProps {
  workspaces: Workspace[];
  active: Workspace | null;
  mode: "local" | "cloud";
  cloudAvailable: boolean;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  onModeChange: (mode: "local" | "cloud") => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSwap: () => void;
  onDeleteSnapshot: (side: "before" | "after") => void;
  onDirection: (direction: ContractDirection) => void;
  onPalette: () => void;
}

export function WorkspaceHeader(props: WorkspaceHeaderProps) {
  const { workspaces, active, mode, cloudAvailable, sessionStatus, onModeChange, onSelect, onNew, onRename, onDelete, onSwap, onDeleteSnapshot, onDirection, onPalette } = props;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { data: session } = useSession();
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen) return;
    const el = drawerRef.current;
    if (!el) return;
    const focusable = el.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab" || !first || !last) return;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    el.addEventListener("keydown", onKeyDown as unknown as EventListener);
    first?.focus();
    return () => el.removeEventListener("keydown", onKeyDown as unknown as EventListener);
  }, [drawerOpen]);

  const nav = (
    <nav className="dm-nav" aria-label="Primary">
      <Link href="/" className="dm-brand" aria-label="DriftMap home">
        <Image src="/logos/driftmap-icon.svg" alt="" width={28} height={28} />
        {!collapsed && <span className="dm-brand-name">DriftMap</span>}
      </Link>

      {!collapsed && (
        <div className="dm-segmented" role="group" aria-label="Storage mode">
          <button aria-pressed={mode === "local"} onClick={() => onModeChange("local")}>Local</button>
          <button aria-pressed={mode === "cloud"} onClick={() => onModeChange("cloud")}>{sessionStatus === "loading" ? "Checking…" : cloudAvailable ? "Cloud" : "Cloud · sign in"}</button>
        </div>
      )}
      {collapsed && (
        <div style={{ display: "grid", placeItems: "center", padding: "4px 0" }} aria-label={`Mode: ${mode}`}>
          <span className={`dm-mode-dot ${mode === "cloud" ? "is-cloud" : "is-local"}`} aria-hidden="true" title={mode} />
        </div>
      )}

      <div className="dm-nav-group">
        {!collapsed && <span className="dm-nav-label">Workspace</span>}
        <div className="dm-nav-controls">
          {!collapsed ? (
            <select aria-label="Active workspace" value={active?.id ?? ""} onChange={(event) => onSelect(event.target.value)}>
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          ) : (
            <span style={{ flex: 1, fontSize: 11, color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{active?.name ?? "—"}</span>
          )}
          <button className="dm-icon-btn" title="New workspace" aria-label="New workspace" onClick={onNew}><Plus size={14} /></button>
        </div>
        {!collapsed && (
          <div className="dm-nav-controls">
            <select aria-label="Contract direction" value={active?.direction ?? "event"} onChange={(event) => onDirection(event.target.value as ContractDirection)}>
              <option value="response">Response</option>
              <option value="request">Request</option>
              <option value="event">Event</option>
            </select>
            <button className="dm-icon-btn" title="Swap baseline and candidate" aria-label="Swap snapshots" disabled={!active} onClick={onSwap}><ArrowLeftRight size={14} /></button>
          </div>
        )}
      </div>

      <div className="dm-nav-group dm-nav-secondary">
        <button className="dm-nav-item" onClick={onPalette} aria-label="Command menu"><GitCompareArrows size={14} aria-hidden="true" />{!collapsed && <>Command menu <kbd>⌘K</kbd></>}</button>
        {!collapsed && <button className="dm-nav-item" disabled={!active} onClick={onRename}><Pencil size={14} aria-hidden="true" />Rename workspace</button>}
        <button className="dm-nav-item is-danger" disabled={!active} onClick={() => onDeleteSnapshot("before")} aria-label="Delete baseline"><Trash2 size={14} aria-hidden="true" />{!collapsed && "Delete baseline"}</button>
        <button className="dm-nav-item is-danger" disabled={!active} onClick={() => onDeleteSnapshot("after")} aria-label="Delete candidate"><Trash2 size={14} aria-hidden="true" />{!collapsed && "Delete candidate"}</button>
        {!collapsed && <button className="dm-nav-item is-danger" disabled={!active} onClick={onDelete}><Trash2 size={14} aria-hidden="true" />Delete workspace</button>}
      </div>

      {!collapsed && (
        <div className="dm-nav-foot">
          <ThemeToggle />
          <SessionStatus status={sessionStatus} />
          <AuthControl user={session?.user ?? null} />
          <button className="dm-icon-btn" aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((v) => !v)} style={{ width: "100%" }}>
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}<span style={{ fontSize: 11, marginLeft: 6 }}>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        </div>
      )}
      {collapsed && (
        <div className="dm-nav-foot">
          <button className="dm-icon-btn" aria-label="Expand sidebar" onClick={() => setCollapsed(false)}><PanelLeftOpen size={14} /></button>
        </div>
      )}
    </nav>
  );

  return (
    <>
      <header className="dm-topbar">
        <Link href="/" className="dm-brand" aria-label="DriftMap home"><Image src="/logos/driftmap-icon.svg" alt="" width={26} height={26} priority /><span className="dm-brand-name">DriftMap</span></Link>
        <span className={`dm-mode-chip ${mode === "cloud" ? "is-cloud" : ""}`}>{mode === "cloud" ? "Cloud" : "Local"}</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "none" }} className="dm-topbar-theme"><ThemeToggle /></div>
          <button ref={drawerTriggerRef} className="dm-icon-btn dm-drawer-toggle" aria-expanded={drawerOpen} aria-controls="dm-drawer" aria-label="Toggle navigation" onClick={() => setDrawerOpen((open) => !open)}>
            {drawerOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </header>
      {drawerOpen && <button className="dm-drawer-backdrop" aria-label="Close navigation" onClick={() => { setDrawerOpen(false); drawerTriggerRef.current?.focus(); }} />}
      <aside ref={drawerRef} id="dm-drawer" className={`dm-drawer ${drawerOpen ? "is-open" : ""}`} aria-hidden={!drawerOpen} aria-label="Navigation drawer">{nav}</aside>
      <aside className={`dm-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Primary" style={collapsed ? { width: 56 } : undefined}>
        {nav}
      </aside>
    </>
  );
}
