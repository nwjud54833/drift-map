"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  ChevronsLeft,
  ChevronsRight,
  FileJson,
  FolderTree,
  Menu as MenuIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { ContractDirection, ContractSnapshot, Workspace } from "@/lib/contract/types";
import { AccountMenu, AccountMenuSkeleton } from "./account-menu";
import { IconButton } from "@/components/ui/icon-button";
import { Segmented } from "@/components/ui/segmented";
import { SelectField } from "@/components/ui/field";
import { StatusPill } from "@/components/ui/status";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export type WorkbenchMode = "local" | "cloud";
export type SessionState = "loading" | "authenticated" | "unauthenticated";

export interface WorkbenchShellProps {
  workspaces: Workspace[];
  snapshots: ContractSnapshot[];
  active: Workspace | null;
  mode: WorkbenchMode;
  sessionStatus: SessionState;
  account: { name?: string | null; email?: string | null; image?: string | null } | null;
  pending: boolean;
  children: React.ReactNode;
  onModeChange: (mode: WorkbenchMode) => void;
  onSelectWorkspace: (id: string | null) => void;
  onNewWorkspace: () => void;
  onRenameWorkspace: () => void;
  onDeleteWorkspace: () => void;
  onSwap: () => void;
  onDirection: (direction: ContractDirection) => void;
  onSelectSnapshot: (side: "before" | "after", snapshotId: string) => void;
  onImport: (side: "before" | "after") => void;
}

const DIRECTION_OPTIONS = [
  { value: "response", label: "Response" },
  { value: "request", label: "Request" },
  { value: "event", label: "Event" },
] as const satisfies ReadonlyArray<{ value: ContractDirection; label: string }>;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function snapshotCount(snapshot: ContractSnapshot): string {
  if ("kind" in snapshot.contract && snapshot.contract.kind === "openapi") return `${snapshot.contract.operations.length} ops`;
  return `${snapshot.samples.length} samples`;
}

/**
 * Sidebar contents. Extracted so the same markup drives the desktop sidebar and
 * the mobile drawer without duplicating tree logic.
 */
function SidebarContent({
  workspaces,
  snapshots,
  active,
  collapsed,
  pending,
  onSelectWorkspace,
  onNewWorkspace,
  onRenameWorkspace,
  onDeleteWorkspace,
  onSwap,
  onDirection,
  onSelectSnapshot,
  onImport,
  onToggleCollapse,
  closeDrawer,
}: Omit<WorkbenchShellProps, "children" | "mode" | "sessionStatus" | "account" | "onModeChange"> & {
  collapsed: boolean;
  onToggleCollapse: () => void;
  closeDrawer?: () => void;
}) {
  // The sidebar and the mobile drawer render the same content in the same
  // document, so heading ids have to be unique per instance or the
  // aria-labelledby references would resolve to whichever copy comes first.
  const uid = useId();
  const workspaceListId = `${uid}-workspaces`;
  const snapshotListId = `${uid}-snapshots`;
  const settingsId = `${uid}-settings`;
  const manageId = `${uid}-manage`;
  const workspaceSnapshots = useMemo(
    () => snapshots.filter((snapshot) => snapshot.workspaceId === active?.id),
    [snapshots, active?.id],
  );

  const run = (action: () => void) => () => { action(); closeDrawer?.(); };

  if (collapsed) {
    return (
      <nav className="dm-nav" aria-label="Workbench">
        <Link href="/" className="dm-brand" aria-label="DriftMap home">
          <Image src="/logos/driftmap-icon.svg" alt="" width={28} height={28} />
        </Link>
        <IconButton label="New workspace" bordered disabled={pending} onClick={run(onNewWorkspace)}>
          <Plus size={15} aria-hidden="true" />
        </IconButton>
        <IconButton label="Import baseline" bordered disabled={pending} onClick={run(() => onImport("before"))}>
          <FileJson size={15} aria-hidden="true" />
        </IconButton>
        <IconButton label="Import candidate" bordered disabled={pending} onClick={run(() => onImport("after"))}>
          <FileJson size={15} aria-hidden="true" />
        </IconButton>
        <IconButton label="Swap baseline and candidate" bordered disabled={pending || !active} onClick={run(onSwap)}>
          <ArrowLeftRight size={15} aria-hidden="true" />
        </IconButton>
        <div className="dm-nav-foot">
          <IconButton label="Expand sidebar" onClick={onToggleCollapse}>
            <ChevronsRight size={15} aria-hidden="true" />
          </IconButton>
        </div>
      </nav>
    );
  }

  return (
    <nav className="dm-nav" aria-label="Workbench">
      <Link href="/" className="dm-brand" aria-label="DriftMap home">
        <Image src="/logos/driftmap-icon.svg" alt="" width={28} height={28} />
        <span className="dm-brand-name">DriftMap</span>
      </Link>

      {/* Workspaces */}
      <section className="dm-nav-group" aria-labelledby={workspaceListId}>
        <div className="dm-group-head">
          <h2 className="dm-nav-label" id={workspaceListId}>Workspaces</h2>
          <span className="dm-group-count">{workspaces.length}</span>
          <IconButton label="New workspace" disabled={pending} onClick={run(onNewWorkspace)}>
            <Plus size={14} aria-hidden="true" />
          </IconButton>
        </div>
        <ul className="dm-group-list">
          {workspaces.length === 0 && <li className="dm-tree-empty">No workspaces yet.</li>}
          {workspaces.map((workspace) => (
            <li key={workspace.id}>
              <button
                type="button"
                className="dm-tree-item"
                aria-current={workspace.id === active?.id}
                onClick={run(() => onSelectWorkspace(workspace.id))}
              >
                <FolderTree size={14} aria-hidden="true" />
                <span className="dm-tree-name">{workspace.name}</span>
                <span className="dm-tree-meta">{workspace.direction}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Snapshots and payload samples for the active workspace */}
      {active && (
        <section className="dm-nav-group" aria-labelledby={snapshotListId}>
          <div className="dm-group-head">
            <h2 className="dm-nav-label" id={snapshotListId}>Snapshots</h2>
            <span className="dm-group-count">{workspaceSnapshots.length}</span>
          </div>
          <ul className="dm-group-list">
            {workspaceSnapshots.length === 0 && <li className="dm-tree-empty">Import a payload to create one.</li>}
            {workspaceSnapshots.map((snapshot) => {
              const side = snapshot.id === active.baselineSnapshotId ? "before" : snapshot.id === active.candidateSnapshotId ? "after" : null;
              const samples = snapshot.samples;
              return (
                <li key={snapshot.id}>
                  <button
                    type="button"
                    className="dm-tree-item"
                    aria-current={side !== null}
                    onClick={run(() => onSelectSnapshot(side ?? "before", snapshot.id))}
                    title={side ? `${side === "before" ? "Baseline" : "Candidate"} · ${snapshot.versionLabel}` : snapshot.versionLabel}
                  >
                    <FileJson size={14} aria-hidden="true" />
                    <span className="dm-tree-name">{snapshot.versionLabel}</span>
                    <span className="dm-tree-meta">{snapshotCount(snapshot)}</span>
                  </button>
                  {samples.length > 0 && (
                    <ul className="dm-group-list dm-tree-children" aria-label={`Payload samples in ${snapshot.versionLabel}`}>
                      {samples.map((sample) => (
                        <li key={sample.id}>
                          <span className="dm-tree-item dm-tree-item-static">
                            <span className="dm-tree-name">{sample.label}</span>
                            <span className="dm-tree-meta">{sample.source}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Workspace settings */}
      <section className="dm-nav-group" aria-labelledby={settingsId}>
        <h2 className="dm-nav-label" id={settingsId}>Contract</h2>
        <SelectField
          label="Contract direction"
          labelHidden
          value={active?.direction ?? "response"}
          disabled={!active || pending}
          onChange={(event) => onDirection(event.target.value as ContractDirection)}
        >
          {DIRECTION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} payload</option>)}
        </SelectField>
        <div className="dm-nav-controls">
          <Button size="sm" variant="quiet" disabled={!active || pending} onClick={run(onSwap)}>
            <ArrowLeftRight size={13} aria-hidden="true" /> Swap sides
          </Button>
        </div>
      </section>

      <section className="dm-nav-group dm-nav-secondary" aria-labelledby={manageId}>
        <h2 className="dm-nav-label" id={manageId}>Manage</h2>
        <button type="button" className="dm-nav-item" disabled={!active || pending} onClick={run(onRenameWorkspace)}>
          <Pencil size={14} aria-hidden="true" /> Rename workspace
        </button>
        <button type="button" className="dm-nav-item is-danger" disabled={!active || pending} onClick={run(onDeleteWorkspace)}>
          <Trash2 size={14} aria-hidden="true" /> Delete workspace
        </button>
      </section>

      <div className="dm-nav-foot">
        <IconButton label="Collapse sidebar" onClick={onToggleCollapse}>
          <ChevronsLeft size={15} aria-hidden="true" />
        </IconButton>
      </div>
    </nav>
  );
}

/**
 * Workbench application shell.
 *
 * Desktop (>= 1024px): persistent sidebar, optionally collapsed to an icon
 * rail, plus a top bar carrying the mode switch, theme control and account menu.
 *
 * Below 1024px: the sidebar moves into a drawer opened from the menu button.
 * The drawer traps focus while open, closes on Escape, and returns focus to the
 * trigger.
 */
export function WorkbenchShell(props: WorkbenchShellProps) {
  const { mode, sessionStatus, account, pending, children, onModeChange } = props;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const drawer = drawerRef.current;
    if (!drawer) return;
    drawer.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; }
      if (event.key !== "Tab" || !drawer) return;
      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !drawer.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, closeDrawer]);

  const signedInAs = account?.email ?? account?.name ?? null;
  const modeStatus = mode === "cloud"
    ? signedInAs ? `Cloud mode: signed in as ${signedInAs}` : "Cloud mode: signed in"
    : "Local mode: data stays in this browser";

  return (
    <div className="ca-app">
      <aside className={`dm-sidebar ${collapsed ? "is-collapsed" : ""}`} aria-label="Workspace navigation">
        <SidebarContent {...props} collapsed={collapsed} onToggleCollapse={() => setCollapsed((value) => !value)} />
      </aside>

      <main className="ca-main">
        <header className="dm-topbar">
          <IconButton
            ref={triggerRef}
            label={drawerOpen ? "Close navigation" : "Open navigation"}
            bordered
            className="dm-drawer-toggle"
            aria-expanded={drawerOpen}
            aria-controls="dm-drawer"
            onClick={() => (drawerOpen ? closeDrawer() : setDrawerOpen(true))}
          >
            {drawerOpen ? <X size={16} aria-hidden="true" /> : <MenuIcon size={16} aria-hidden="true" />}
          </IconButton>

          <Link href="/" className="dm-brand" aria-label="DriftMap home">
            <Image src="/logos/driftmap-icon.svg" alt="" width={26} height={26} priority />
            <span className="dm-brand-name">DriftMap</span>
          </Link>

          <div className="dm-mode-status">
            <Segmented
              label="Storage mode"
              value={mode}
              onChange={(next) => onModeChange(next)}
              options={[
                { value: "local" as const, label: "Local" },
                { value: "cloud" as const, label: "Cloud", ariaLabel: "Cloud mode" },
              ]}
            />
            <StatusPill mode={mode}>{modeStatus}</StatusPill>
            {mode === "local" && <StatusPill muted>Not synced to cloud</StatusPill>}
          </div>

          <span className="dm-topbar-spacer" />

          <ThemeToggle />

          {sessionStatus === "loading" ? <AccountMenuSkeleton /> : <AccountMenu user={account} />}
        </header>

        {children}
      </main>

      {drawerOpen && (
        <>
          <button type="button" className="ui-drawer-backdrop" aria-label="Close navigation" onClick={closeDrawer} />
          <div
            ref={drawerRef}
            id="dm-drawer"
            className="ui-drawer"
            data-open="true"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace navigation"
          >
            <SidebarContent
              {...props}
              collapsed={false}
              onToggleCollapse={closeDrawer}
              closeDrawer={closeDrawer}
            />
          </div>
        </>
      )}

      {/* Visually hidden but always available: keeps the active mode unambiguous
          for assistive technology regardless of viewport. */}
      <p className="sr-only" aria-live="polite">{modeStatus}. {pending ? "An operation is in progress." : "Ready."}</p>
    </div>
  );
}
