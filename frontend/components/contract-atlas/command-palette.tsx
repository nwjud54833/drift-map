"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useDialogFocus } from "./use-dialog-focus";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette({ commands, onClose }: { commands: Command[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef, true, onClose);

  const filtered = useMemo(
    () => commands.filter((command) => `${command.label} ${command.hint ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())),
    [commands, query],
  );

  useEffect(() => { setActiveIndex(0); }, [query]);

  useEffect(() => {
    const active = listRef.current?.children[activeIndex];
    if (active instanceof HTMLElement) active.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function runCommand(command: Command | undefined) {
    if (!command) return;
    onClose();
    command.run();
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
    else if (event.key === "Enter") { event.preventDefault(); runCommand(filtered[activeIndex]); }
    else if (event.key === "Escape") { event.preventDefault(); onClose(); }
  }

  return (
    <div className="ca-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} tabIndex={-1} className="ca-command-modal" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKeyDown}>
        <header>
          <strong>Command palette</strong>
          <button className="ca-small-button" aria-label="Close command palette" onClick={onClose}><X size={14} /></button>
        </header>
        <input
          className="ca-command-input"
          autoFocus
          role="combobox"
          aria-expanded={filtered.length > 0}
          aria-controls="ca-command-list"
          aria-label="Search commands"
          aria-activedescendant={filtered[activeIndex] ? `ca-command-${filtered[activeIndex].id}` : undefined}
          placeholder="Type a command…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="ca-command-list" id="ca-command-list" role="listbox" aria-label="Commands" ref={listRef}>
          {filtered.map((command, index) => {
            const Icon = command.icon;
            return (
              <button
                key={command.id}
                id={`ca-command-${command.id}`}
                role="option"
                aria-selected={index === activeIndex}
                className={`ca-command-item ${index === activeIndex ? "is-active" : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => runCommand(command)}
              >
                <Icon size={14} aria-hidden="true" />
                {command.label}
                {command.hint && <span className="ca-command-hint">{command.hint}</span>}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="ca-command-empty">No command matches “{query}”.</p>}
        </div>
      </section>
    </div>
  );
}
