"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";

/* --------------------------------------------------------------------------
 * DriftMap mark — the reference build's inline SVG, unchanged.
 * ------------------------------------------------------------------------ */

export function DriftMapMark({ className = "w-3.5 h-3.5 text-white" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h6l4 12h6M4 18h5m7-12h4" />
      <circle cx="10" cy="6" r="2" fill="#FB7185" stroke="none" />
      <circle cx="14" cy="18" r="2" fill="#34D399" stroke="none" />
    </svg>
  );
}

/* --------------------------------------------------------------------------
 * Audio synthesizer toggle with animated equaliser bars
 * ------------------------------------------------------------------------ */

function AudioSynthToggle() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => DriftAudioSynth.subscribe(setEnabled), []);

  return (
    <button
      type="button"
      id="audio-synth-toggle"
      onClick={() => setEnabled(DriftAudioSynth.toggle())}
      aria-pressed={enabled}
      title="Toggle Web Audio API micro-synthesizer (muted by default)"
      className={`h-8 px-2.5 rounded-lg text-xs font-mono whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.07] border transition-all ${
        enabled ? "border-emerald-500/40 text-white eq-active" : "border-white/[0.08] text-[#9496A1] hover:text-white"
      }`}
    >
      <span id="audio-synth-icon" className="inline-flex items-center shrink-0">
        {enabled ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-[#9496A1]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        )}
      </span>
      <span id="audio-synth-label" className="hidden md:inline whitespace-nowrap">{enabled ? "FX On" : "FX Off"}</span>
      <span
        id="audio-eq-bars"
        aria-hidden="true"
        className={`${enabled ? "inline-flex" : "hidden"} items-end gap-0.5 h-3 shrink-0`}
      >
        <span className="eq-1 w-0.5 bg-emerald-400 rounded-full" />
        <span className="eq-2 w-0.5 bg-sky-400 rounded-full" />
        <span className="eq-3 w-0.5 bg-rose-500 rounded-full" />
      </span>
    </button>
  );
}

/* --------------------------------------------------------------------------
 * Header
 * ------------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#deep-inspection", label: "Inspector" },
  { href: "#limitations", label: "Limitations" },
] as const;

/**
 * Sticky glass header shared by `/`, `/workbench` and `/contract-atlas`.
 *
 * The segmented centre switcher navigates between the two real routes instead
 * of toggling `hidden` on two views, which is what makes the same chrome work
 * for deep links and browser history.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { status } = useSession();
  const openCommandPalette = useSpatialUIStore((state) => state.openCommandPalette);
  const openModal = useSpatialUIStore((state) => state.openModal);
  const isWorkbench = pathname?.startsWith("/workbench") ?? false;

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#030304]/85 backdrop-blur-xl">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: brand identity + single-line section anchors */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <Link href="/" className="group flex items-center gap-2.5 text-left focus:outline-none shrink-0">
            <span className="w-7 h-7 rounded-lg bg-[#111116] border border-white/15 flex items-center justify-center relative overflow-hidden group-hover:border-white/30 transition-colors shrink-0">
              <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              <DriftMapMark />
            </span>
            <span className="font-semibold tracking-tight text-white text-sm whitespace-nowrap shrink-0">DriftMap</span>
            <span className="hidden sm:inline-flex items-center h-5 px-2 rounded text-[10px] font-mono font-medium bg-white/[0.05] text-[#9496A1] border border-white/[0.08] whitespace-nowrap shrink-0">
              v2.5 SPATIAL
            </span>
          </Link>

          <span className="hidden lg:block h-4 w-px bg-white/10 shrink-0" />

          {!isWorkbench && (
            <nav
              id="landing-nav-links"
              className="hidden lg:flex items-center gap-4 text-xs font-medium text-[#9496A1] whitespace-nowrap shrink-0"
              aria-label="Page sections"
            >
              {NAV_LINKS.map((link) => (
                <a key={link.href} href={link.href} className="hover:text-white transition-colors whitespace-nowrap shrink-0">
                  {link.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        {/* Centre: uniform h-8 segmented view switcher */}
        <div className="inline-flex items-center h-8 p-0.5 rounded-lg bg-zinc-900/90 border border-white/[0.1] shrink-0">
          {isWorkbench ? (
            <Link
              href="/"
              id="tab-btn-landing"
              className="h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-all duration-150 text-[#9496A1] hover:text-white"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18" />
              </svg>
              <span>Landing</span>
            </Link>
          ) : (
            <Link
              href="/"
              id="tab-btn-landing"
              aria-current="page"
              className="h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-all duration-150 bg-white text-[#030304] shadow-sm"
            >
              <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M3 9h18" />
              </svg>
              <span>Landing</span>
            </Link>
          )}

          {isWorkbench ? (
            <Link
              href="/workbench"
              id="tab-btn-workbench"
              aria-current="page"
              className="h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-all duration-150 bg-white text-[#030304] shadow-sm"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Workbench</span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono leading-none bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                LIVE
              </span>
            </Link>
          ) : (
            <Link
              href="/workbench"
              id="tab-btn-workbench"
              className="h-7 px-3 rounded-md text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 transition-all duration-150 text-[#9496A1] hover:text-white"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Workbench</span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-mono leading-none bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 whitespace-nowrap shrink-0">
                LIVE
              </span>
            </Link>
          )}
        </div>

        {/* Right: uniform h-8 single-line utility cluster */}
        <div className="flex items-center gap-2 shrink-0">
          <AudioSynthToggle />

          <button
            type="button"
            onClick={openCommandPalette}
            title="Open Command Palette (⌘K or Ctrl+K)"
            aria-keyshortcuts="Meta+K Control+K"
            className="h-8 px-2.5 rounded-lg text-xs font-mono whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 text-[#9496A1] hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] transition-all"
          >
            <svg className="w-3.5 h-3.5 text-[#9496A1] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="hidden sm:inline whitespace-nowrap">Command</span>
            <kbd className="px-1.5 py-0.5 text-[10px] leading-none rounded bg-[#030304] text-white/80 border border-white/[0.12] shrink-0">⌘K</kbd>
          </button>

          <button
            type="button"
            onClick={() => openModal("tokens")}
            title="Inspect and copy the Obsidian theme CSS tokens"
            className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs font-mono whitespace-nowrap shrink-0 text-[#9496A1] hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
            <span className="whitespace-nowrap">Tokens</span>
          </button>

          {status === "authenticated" ? (
            <Link
              href="/workbench"
              className="hidden xl:inline-flex items-center h-8 px-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 text-emerald-400 hover:text-white transition-colors"
            >
              Cloud ready
            </Link>
          ) : (
            <Link
              href="/signin"
              className="hidden xl:inline-flex items-center h-8 px-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 text-zinc-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
          )}

          <Link
            href="/workbench"
            className="btn-geist-primary h-8 px-3.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          >
            <span className="whitespace-nowrap">{isWorkbench ? "Workbench" : "Open workbench"}</span>
            <span aria-hidden="true" className="shrink-0">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
