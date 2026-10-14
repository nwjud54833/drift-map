"use client";

import { useEffect, useRef, useState } from "react";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";

/**
 * Obsidian design-token and keyboard-shortcut modals.
 *
 * Ported from `#tokens-modal` in the Obsidian v2.5 "Spatial" reference build.
 * A third modal is added for the keyboard map, because the redesigned surface
 * exposes shortcuts (⌘K, ↑/↓, J/K, G W, V G) that are otherwise undiscoverable.
 *
 * The token block is the exact CSS the reference build ships, so "Copy CSS
 * variables" yields something a consumer can paste into their own project.
 */

const CSS_TOKENS = `:root {
  /* Pure Obsidian Surfaces */
  --bg-canvas: #030304;
  --bg-elevated: #0A0A0D;
  --bg-glass: #111116;
  --border-hairline: rgba(255, 255, 255, 0.08);
  --border-specular: rgba(255, 255, 255, 0.18);

  /* Typography Hierarchy */
  --text-primary: #F4F4F6;
  --text-secondary: #9496A1;
  --text-muted: #5E606E;

  /* Semantic Drift Severity Tokens */
  --drift-breaking-fg: #FB7185;
  --drift-breaking-bg: rgba(244, 63, 94, 0.12);
  --drift-breaking-border: rgba(244, 63, 94, 0.30);

  --drift-warning-fg: #FBBF24;
  --drift-warning-bg: rgba(245, 158, 11, 0.12);
  --drift-warning-border: rgba(245, 158, 11, 0.30);

  --drift-safe-fg: #34D399;
  --drift-safe-bg: rgba(16, 185, 129, 0.12);
  --drift-safe-border: rgba(16, 185, 129, 0.30);

  --drift-info-fg: #38BDF8;
  --drift-info-bg: rgba(56, 189, 248, 0.12);
  --drift-info-border: rgba(56, 189, 248, 0.30);
}`;

const SWATCHES = [
  { name: "canvas", value: "#030304" },
  { name: "elevated", value: "#0A0A0D" },
  { name: "glass", value: "#111116" },
  { name: "breaking", value: "#FB7185" },
  { name: "warning", value: "#FBBF24" },
  { name: "safe", value: "#34D399" },
  { name: "info", value: "#38BDF8" },
] as const;

const SHORTCUTS: ReadonlyArray<{ keys: string; description: string }> = [
  { keys: "⌘K / Ctrl K", description: "Open or close the command palette" },
  { keys: "↑ ↓", description: "Move the floating row highlight" },
  { keys: "J / K", description: "Same row physics, Vim-style" },
  { keys: "↑ ↓ (palette)", description: "Move through palette results" },
  { keys: "↵", description: "Run the highlighted command" },
  { keys: "Esc", description: "Close the palette or the open modal" },
  { keys: "⌘O / Ctrl O", description: "Import a baseline document (workbench)" },
  { keys: "⌘E / Ctrl E", description: "Download the Markdown report (workbench)" },
];

function ModalFrame({
  labelledBy,
  onClose,
  children,
  maxWidth = "max-w-2xl",
}: {
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button, [tabindex]")?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={`obsidian-card rounded-2xl ${maxWidth} w-full p-6 border border-white/[0.15] shadow-2xl max-h-[85vh] overflow-y-auto`}
      >
        {children}
      </div>
    </div>
  );
}

export function SpatialModals() {
  const request = useSpatialUIStore((state) => state.modalRequest);
  const close = useSpatialUIStore((state) => state.closeModal);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!request) setCopied(false);
  }, [request]);

  async function copyTokens() {
    try {
      await navigator.clipboard.writeText(CSS_TOKENS);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (!request) return null;

  if (request.kind === "tokens") {
    return (
      <ModalFrame labelledBy="tokens-modal-title" onClose={close}>
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">OBSIDIAN DESIGN SYSTEM</span>
            <h2 id="tokens-modal-title" className="text-lg font-semibold text-white">DriftMap black theme CSS tokens</h2>
          </div>
          <button type="button" onClick={close} className="text-[#9496A1] hover:text-white p-1" aria-label="Close">✕</button>
        </div>

        <p className="text-xs text-[#9496A1] mb-3">
          These are the variables the app itself renders with — declared in{" "}
          <code className="text-white font-mono">app/globals.css</code> and consumed by every Obsidian surface class.
        </p>

        <div className="flex flex-wrap gap-2 mb-4" aria-hidden="true">
          {SWATCHES.map((swatch) => (
            <span key={swatch.name} className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.03] border border-white/[0.07] font-mono text-[10px] text-[#9496A1]">
              <span className="w-3 h-3 rounded-sm border border-white/15" style={{ backgroundColor: swatch.value }} />
              {swatch.name}
              <span className="text-white/70">{swatch.value}</span>
            </span>
          ))}
        </div>

        <pre
          id="css-tokens-code"
          className="p-4 rounded-xl bg-[#050507] border border-white/[0.08] font-mono text-xs text-white/90 overflow-x-auto max-h-80 leading-relaxed"
        >
          {CSS_TOKENS}
        </pre>

        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={close} className="btn-geist-secondary px-4 py-2 rounded-lg text-xs">Close</button>
          <button type="button" onClick={() => void copyTokens()} className="btn-geist-primary px-4 py-2 rounded-lg text-xs">
            {copied ? "Copied ✓" : "Copy CSS variables"}
          </button>
        </div>
      </ModalFrame>
    );
  }

  return (
    <ModalFrame labelledBy="shortcuts-modal-title" onClose={close} maxWidth="max-w-lg">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400">SPATIAL CONTROLS</span>
          <h2 id="shortcuts-modal-title" className="text-lg font-semibold text-white">Keyboard shortcuts</h2>
        </div>
        <button type="button" onClick={close} className="text-[#9496A1] hover:text-white p-1" aria-label="Close">✕</button>
      </div>

      <dl className="divide-y divide-white/[0.06] font-mono text-xs">
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.keys} className="flex items-center justify-between gap-4 py-2.5">
            <dt>
              <kbd className="px-2 py-1 rounded bg-[#050507] text-white/85 border border-white/[0.1]">{shortcut.keys}</kbd>
            </dt>
            <dd className="text-[#9496A1] text-right">{shortcut.description}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex justify-end">
        <button type="button" onClick={close} className="btn-geist-secondary px-4 py-2 rounded-lg text-xs">Close</button>
      </div>
    </ModalFrame>
  );
}
