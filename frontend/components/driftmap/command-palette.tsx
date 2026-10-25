"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import { usePaletteCommands, type PaletteCommand } from "@/lib/driftmap/command-registry";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";

/**
 * Global ⌘K / Ctrl+K command palette.
 *
 * Ported from `#command-palette-modal` in the Obsidian v2.5 "Spatial" reference
 * build. The reference hard-codes its command list; here the palette renders
 * whatever the current page registered through `lib/driftmap/command-registry`
 * plus a small set of navigation and preference commands that are always valid.
 */

const FOCUSABLE = 'input,button:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function CommandPalette() {
  const open = useSpatialUIStore((state) => state.isCommandPaletteOpen);
  const close = useSpatialUIStore((state) => state.closeCommandPalette);
  const openModal = useSpatialUIStore((state) => state.openModal);
  const pageCommands = usePaletteCommands();
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isWorkbench = pathname?.startsWith("/workbench") ?? false;

  const commands = useMemo<PaletteCommand[]>(() => {
    const shellCommands: PaletteCommand[] = [
      {
        id: "nav-workbench",
        title: "Switch to Interactive Workbench",
        category: "View",
        shortcut: "G W",
        keywords: ["workbench", "atlas", "compare"],
        run: () => router.push("/workbench"),
      },
      {
        id: "nav-landing",
        title: "Switch to Landing Page Showcase",
        category: "View",
        shortcut: "G L",
        keywords: ["landing", "home", "overview"],
        run: () => router.push("/"),
      },
      {
        id: "toggle-audio",
        title: "Toggle Web Audio API UI Synthesizer",
        category: "Audio",
        shortcut: "M",
        keywords: ["audio", "sound", "fx", "equalizer"],
        run: () => DriftAudioSynth.toggle(),
      },
      {
        id: "tokens",
        title: "Inspect the DriftMap CSS design tokens",
        category: "Theme",
        shortcut: "T",
        keywords: ["tokens", "css", "theme", "palette", "variables"],
        run: () => openModal("tokens"),
      },
      {
        id: "shortcuts",
        title: "Show Keyboard Shortcuts",
        category: "Help",
        shortcut: "?",
        keywords: ["keyboard", "shortcuts", "keys", "help"],
        run: () => openModal("shortcuts"),
      },
    ];
    return [...pageCommands, ...shellCommands];
  }, [pageCommands, router, openModal]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return commands;
    return commands.filter((command) =>
      command.title.toLowerCase().includes(text)
      || command.category.toLowerCase().includes(text)
      || (command.keywords ?? []).some((keyword) => keyword.includes(text)),
    );
  }, [commands, query]);

  const execute = useCallback((command: PaletteCommand | undefined) => {
    if (!command) return;
    close();
    command.run();
  }, [close]);

  // Reset transient state each time the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelected(0);
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (selected >= filtered.length) setSelected(0);
  }, [filtered.length, selected]);

  // Global shortcut: ⌘K / Ctrl+K toggles, Escape closes.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        const store = useSpatialUIStore.getState();
        if (store.isCommandPaletteOpen) store.closeCommandPalette();
        else store.openCommandPalette();
        return;
      }
      if (event.key === "Escape") {
        const store = useSpatialUIStore.getState();
        if (store.isCommandPaletteOpen) {
          event.preventDefault();
          store.closeCommandPalette();
        } else if (store.modalRequest) {
          event.preventDefault();
          store.closeModal();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Arrow/Enter navigation and focus trapping while the palette is open.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((current) => (filtered.length === 0 ? 0 : (current + 1) % filtered.length));
        DriftAudioSynth.playTick(1100);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) => (filtered.length === 0 ? 0 : (current - 1 + filtered.length) % filtered.length));
        DriftAudioSynth.playTick(1200);
      } else if (event.key === "Enter") {
        event.preventDefault();
        execute(filtered[selected]);
      } else if (event.key === "Tab") {
        const dialog = dialogRef.current;
        if (!dialog) return;
        const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
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
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, filtered, selected, execute]);

  if (!open) return null;

  return (
    <div
      id="command-palette-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/75 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="obsidian-card rounded-2xl max-w-xl w-full overflow-hidden border border-white/[0.18] shadow-[0_35px_90px_rgba(0,0,0,0.95)] bg-[#0A0A0D]"
      >
        {/* Search bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-white/[0.08] bg-[#0E0E13]">
          <svg className="w-4 h-4 text-[#9496A1] mr-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <label className="sr-only" htmlFor="cmd-palette-input">Search commands</label>
          <input
            ref={inputRef}
            id="cmd-palette-input"
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cmd-palette-list"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Type a command or search actions (e.g. '3d graph', 'audio', 'timeline', 'breaking')…"
            className="w-full bg-transparent text-xs sm:text-sm font-mono text-white placeholder-[#5E606E] focus:outline-none"
          />
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-white/[0.06] text-[#9496A1] border border-white/[0.1]">ESC</kbd>
        </div>

        {/* Command list */}
        <div id="cmd-palette-list" role="listbox" aria-label="Commands" className="max-h-80 overflow-y-auto divide-y divide-white/[0.04] p-2 font-mono text-xs">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-[#5E606E]">No matching commands found.</div>
          ) : (
            filtered.map((command, index) => (
              <button
                key={command.id}
                type="button"
                role="option"
                aria-selected={index === selected}
                onClick={() => execute(command)}
                onMouseEnter={() => setSelected(index)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl flex items-center justify-between transition-colors ${
                  index === selected ? "bg-white/[0.09] text-white" : "text-[#9496A1] hover:text-white"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.07] text-[#5E606E] shrink-0">
                    {command.category}
                  </span>
                  <span className="font-medium truncate">{command.title}</span>
                </span>
                {command.shortcut && (
                  <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-[#050507] text-[#9496A1] border border-white/[0.08] shrink-0">
                    {command.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-[#060608] border-t border-white/[0.07] flex items-center justify-between text-[10px] font-mono text-[#5E606E]">
          <div className="flex items-center gap-3">
            <span><kbd className="text-white/80">↑↓</kbd> Navigate</span>
            <span><kbd className="text-white/80">↵</kbd> Execute</span>
          </div>
          <span>{isWorkbench ? "Workbench command engine" : "DriftMap spatial command engine"}</span>
        </div>
      </div>
    </div>
  );
}
