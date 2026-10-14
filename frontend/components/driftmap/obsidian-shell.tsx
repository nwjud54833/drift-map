"use client";

import { SiteHeader } from "./site-header";
import { CommandPalette } from "./command-palette";
import { SpatialModals } from "./spatial-modals";

/**
 * Obsidian v2.5 "Spatial" application shell.
 *
 * Provides the ambient top radial glow, the sticky glass header, the ⌘K command
 * palette and the design-token / shortcut modals for both routes. The footer and
 * the toast region are page-specific, so each page renders them inside
 * `children`.
 */
export function ObsidianShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Ambient top radial glow */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[980px] h-[440px] rounded-full bg-gradient-to-b from-white/[0.055] via-rose-500/[0.022] to-transparent blur-3xl" />
        <div className="absolute top-[35%] right-[-10%] w-[520px] h-[520px] rounded-full bg-sky-500/[0.022] blur-3xl" />
      </div>

      <SiteHeader />
      {children}
      <CommandPalette />
      <SpatialModals />
    </>
  );
}
