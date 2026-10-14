"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export interface MenuProps {
  /** Accessible name for the trigger button. */
  label: string;
  /** Trigger contents — an avatar, a caret, or a label. */
  trigger: (state: { open: boolean }) => ReactNode;
  children: (state: { close: () => void }) => ReactNode;
  align?: "start" | "end";
  triggerClassName?: string;
}

/**
 * Menu button with the expected keyboard contract: Escape and outside click
 * close it, focus moves into the menu on open and returns to the trigger on
 * close, and Up/Down move between items.
 */
export function Menu({ label, trigger, children, align = "end", triggerClassName }: MenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const items = () => Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])') ?? []);
    items()[0]?.focus();

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      // Returning focus to the trigger keeps the menu escapable without a trap.
      close();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  function onPanelKeyDown(event: React.KeyboardEvent) {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const items = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),[href],[tabindex]:not([tabindex="-1"])') ?? []);
    if (items.length === 0) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  return (
    <div className="ui-menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={["ui-icon-btn", triggerClassName ?? ""].filter(Boolean).join(" ")}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        {trigger({ open })}
      </button>
      {open && (
        <div ref={panelRef} id={panelId} className="ui-menu-panel" role="menu" aria-label={label} data-align={align} onKeyDown={onPanelKeyDown}>
          {children({ close: () => close(false) })}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ onSelect, danger = false, shortcut, children }: { onSelect: () => void; danger?: boolean; shortcut?: string; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" className="ui-menu-item" data-danger={danger || undefined} onClick={onSelect}>
      {children}
      {shortcut && <span className="ui-menu-shortcut">{shortcut}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <hr className="ui-menu-separator" />;
}

export function MenuHeader({ name, meta }: { name: string; meta?: string }) {
  return (
    <div className="ui-menu-header">
      <span className="ui-menu-name">{name}</span>
      {meta && <span className="ui-menu-meta">{meta}</span>}
    </div>
  );
}
