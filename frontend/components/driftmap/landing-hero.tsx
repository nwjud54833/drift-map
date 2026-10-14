"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import {
  buildDemoTimeline,
  toFindings,
  type Finding,
  type TimelineRevision,
} from "@/lib/driftmap/presentation";
import { useRegisteredCommands } from "@/lib/driftmap/command-registry";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";
import { CrosshairLattice, DriftTable, type DriftRow } from "./drift-table";
import { EvidenceInspector } from "./evidence-inspector";
import { HeroPerspectiveCanvas } from "./hero-perspective-canvas";
import { TimelineBadges, TimelineScrubber } from "./timeline-scrubber";

/**
 * Landing hero.
 *
 * Ported from the reference build's `#hero-section`: the interactive perspective
 * horizon canvas, the centred metallic headline and trust strip, the schema
 * version timeline scrubber, and the 3D tilt stage holding the drift table and
 * the selected-path evidence inspector with its Split JSON AST Diff.
 *
 * The reference drives the table from a hard-coded `TIMELINE_SNAPSHOTS` array.
 * Here the four stops are built by `buildDemoTimeline()`, which applies the
 * engine's own change list to the bundled fixture and re-infers the contract at
 * each step — so the table, the counts and the inspector all come from real
 * `compareContracts` output, and scrubbing morphs genuinely different contracts.
 */

const LIVE_SNIPPETS = [
  '{ "order_id": "ORD-1004", "status": "shipped", "total": { "amount": 129, "currency": "USD" } }',
  '{ "order_id": "ORD-1005", "status": "shipped", "total": { "amount": 75, "currency": "USD" } }',
  '{ "order_id": "ORD-1006", "status": "partially_shipped", "total": { "amount": 200, "currency": "USD" } }',
  '{ "order_id": "ORD-1007", "status": "shipped", "total": { "amount": 42, "currency": "USD" } }',
];

export function LandingHero() {
  const setCenterMode = useSpatialUIStore((state) => state.setCenterMode);
  const setSimStatus = useSpatialUIStore((state) => state.setSimStatus);
  const openModal = useSpatialUIStore((state) => state.openModal);
  const openCommandPalette = useSpatialUIStore((state) => state.openCommandPalette);
  const router = useRouter();

  const revisions = useMemo<TimelineRevision[]>(() => buildDemoTimeline(), []);
  // Open on the final revision — the current state of the contract, with every
  // finding visible. The scrubber is what reveals the earlier, quieter stops.
  const [activeIndex, setActiveIndex] = useState(() => Math.max(revisions.length - 1, 0));
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [flashIndex, setFlashIndex] = useState(-1);
  const [streaming, setStreaming] = useState(false);
  const [snippet, setSnippet] = useState(LIVE_SNIPPETS[0]);
  const [leveled, setLeveled] = useState(false);
  const [tilt, setTilt] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const tickRef = useRef(0);

  const activeRevision = revisions[activeIndex] ?? revisions[0] ?? null;

  const findings = useMemo<Finding[]>(() => {
    if (!activeRevision) return [];
    return toFindings(activeRevision.changes, {
      direction: "event",
      candidateVersion: activeRevision.version,
    });
  }, [activeRevision]);

  // Keep the selected finding valid as revisions change size.
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeIndex]);

  const selected = findings[selectedIndex] ?? findings[0] ?? null;

  const rows = useMemo<DriftRow[]>(
    () => findings.map((finding) => ({
      id: finding.id,
      pointer: finding.pointer,
      ruleId: finding.ruleId,
      fromType: finding.fromType,
      toType: finding.toType,
      driftLabel: finding.driftLabel,
      severity: finding.severity,
      presentCount: finding.presentCount,
      totalSamples: finding.totalSamples,
      sparkPoints: finding.sparkPoints,
    })),
    [findings],
  );

  const counts = useMemo(() => {
    const tally = { breaking: 0, warning: 0, safe: 0, info: 0 };
    for (const finding of findings) tally[finding.severity] += 1;
    return tally;
  }, [findings]);

  const openWorkbenchWithPreset = useCallback(() => {
    setCenterMode("table");
    router.push("/workbench");
  }, [router, setCenterMode]);

  const launchGraph = useCallback(() => {
    setCenterMode("graph");
    router.push("/workbench?view=graph");
  }, [router, setCenterMode]);

  /* ---------- 3D tilt stage physics (reference `initSpatial3DInteractions`) --- */

  useEffect(() => {
    const stage = stageRef.current;
    const frame = windowRef.current;
    if (!stage || !frame) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function onMove(event: MouseEvent) {
      if (!stage || !frame) return;
      const rect = stage.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      setTilt(`rotateX(${(-y * 5).toFixed(2)}deg) rotateY(${(x * 5).toFixed(2)}deg) scale(1)`);
    }

    function onLeave() {
      setTilt(null);
    }

    stage.addEventListener("mousemove", onMove);
    stage.addEventListener("mouseleave", onLeave);
    return () => {
      stage.removeEventListener("mousemove", onMove);
      stage.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Level the window once the hero starts scrolling away.
  useEffect(() => {
    function onScroll() {
      setLeveled(window.scrollY > 90);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* ---------- Live traffic simulation --------------------------------------- */

  useEffect(() => {
    if (!streaming) return;
    const interval = window.setInterval(() => {
      tickRef.current += 1;
      const tick = tickRef.current;
      setFlashIndex(findings.length > 0 ? tick % findings.length : -1);
      setSnippet(LIVE_SNIPPETS[tick % LIVE_SNIPPETS.length]);
      const row = findings[tick % Math.max(findings.length, 1)];
      if (row) DriftAudioSynth.playForSeverity(row.severity);
    }, 1350);
    return () => window.clearInterval(interval);
  }, [streaming, findings]);

  useEffect(() => {
    setSimStatus(streaming ? "streaming" : "idle");
    return () => setSimStatus("idle");
  }, [streaming, setSimStatus]);

  // Stop streaming if the visitor navigates away mid-tick.
  useEffect(() => () => {
    tickRef.current = 0;
  }, []);

  /* ---------- Command palette contributions -------------------------------- */

  useRegisteredCommands(
    "landing",
    [
      ...revisions.map((revision, index) => ({
        id: `timeline-${index}`,
        title: `Timeline scrubber: ${revision.version} (${revision.summary})`,
        category: "Timeline",
        shortcut: String(index + 1),
        keywords: ["timeline", "scrub", "revision", revision.version],
        run: () => setActiveIndex(index),
      })),
      ...(["breaking", "warning", "safe", "info"] as const)
        .filter((severity) => counts[severity] > 0)
        .map((severity) => ({
          id: `hero-filter-${severity}`,
          title: `Inspect the ${counts[severity]} ${severity} finding${counts[severity] === 1 ? "" : "s"} in the workbench`,
          category: "Filter",
          keywords: ["filter", severity, "breaking", "warning", "safe", "info"],
          run: () => setCenterMode("table"),
        })),
      {
        id: "hero-3d-graph",
        title: "Launch the workbench in 3D force graph view",
        category: "3D Graph",
        shortcut: "V G",
        keywords: ["3d", "graph", "force", "orbital", "ast"],
        run: launchGraph,
      },
      {
        id: "hero-toggle-traffic",
        title: "Toggle live traffic stream simulation",
        category: "Simulation",
        shortcut: "L",
        keywords: ["simulate", "live", "traffic", "stream"],
        run: () => setStreaming((current) => !current),
      },
    ],
    [revisions, counts, launchGraph, setCenterMode],
  );

  /* ---------- Render -------------------------------------------------------- */

  return (
    <section id="hero-section" className="relative pt-14 pb-24 md:pt-20 md:pb-32 border-b border-white/[0.07] overflow-hidden">
      <HeroPerspectiveCanvas className="absolute inset-0 w-full h-full pointer-events-none z-0 opacity-90" />

      <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-10 md:mb-12">
          <div className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#0A0A0D]/90 border border-white/[0.1] mb-6 shadow-sm backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot shadow-[0_0_8px_#34D399]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-[#F4F4F6] font-medium">API CONTRACT REVIEW</span>
            <span className="text-white/20" aria-hidden="true">·</span>
            <span className="text-[11px] font-mono text-[#9496A1]">Zero-upload IndexedDB engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-[56px] font-semibold tracking-tightest leading-[1.08] text-gradient-metallic mb-6">
            Know exactly which JSON changes will break your consumers.
          </h1>

          <p className="text-base sm:text-lg text-[#9496A1] leading-relaxed max-w-2xl mx-auto font-normal mb-8">
            DriftMap infers a structural contract from real payload samples and classifies every drift as{" "}
            <span className="text-rose-400 font-mono text-sm">breaking</span>,{" "}
            <span className="text-amber-400 font-mono text-sm">warning</span>,{" "}
            <span className="text-emerald-400 font-mono text-sm">safe</span>, or{" "}
            <span className="text-sky-400 font-mono text-sm">info</span>{" "}
            — so you review risk, not formatting noise.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-9">
            <button type="button" onClick={openWorkbenchWithPreset} className="btn-geist-primary px-5 py-2.5 rounded-xl text-sm inline-flex items-center gap-2">
              <span>Open the workbench</span>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>

            <a
              href="https://github.com/nwjud54833/drift-map#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-geist-secondary px-4 py-2.5 rounded-xl text-sm inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4 text-[#9496A1]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>Read the README</span>
            </a>

            <button
              type="button"
              onClick={() => openModal("tokens")}
              className="btn-geist-secondary px-4 py-2.5 rounded-xl text-sm inline-flex items-center gap-2 text-[#9496A1] hover:text-white"
            >
              <svg className="w-4 h-4 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <span>Copy design tokens (CSS)</span>
            </button>
          </div>

          <div className="inline-flex flex-wrap items-center justify-center gap-y-2 gap-x-6 px-4 py-2 rounded-xl bg-[#0A0A0D]/90 border border-white/[0.06] text-xs font-mono text-[#9496A1] backdrop-blur-md">
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              OpenAPI 3.0 JSON &amp; YAML
            </span>
            <span className="text-white/15 hidden sm:inline" aria-hidden="true">|</span>
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Local-first, cloud optional
            </span>
            <span className="text-white/15 hidden sm:inline" aria-hidden="true">|</span>
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-sky-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <ellipse cx="12" cy="5" rx="9" ry="3" />
                <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
              </svg>
              IndexedDB · no upload by default
            </span>
          </div>
        </div>

        {/* Schema version timeline scrubber */}
        {revisions.length > 1 && (
          <div className="max-w-4xl mx-auto mb-6 obsidian-card rounded-2xl p-4 sm:px-6 border border-white/[0.11] bg-[#0A0A0D]/90 backdrop-blur-xl shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="uppercase tracking-wider text-white font-medium">SCHEMA VERSION TIMELINE SCRUBBER</span>
                <span className="text-[#5E606E] hidden sm:inline">· drag or click a revision to morph drift state</span>
              </div>
              <TimelineBadges baselineLabel={revisions[0].version} revision={activeRevision} />
            </div>
            <TimelineScrubber
              revisions={revisions}
              activeIndex={activeIndex}
              onChange={(index) => {
                setActiveIndex(index);
                const revision = revisions[index];
                if (revision) DriftAudioSynth.playForSeverity(revision.tone);
              }}
              idPrefix="hero"
              baselineLabel={revisions[0].version}
            />
          </div>
        )}

        {/* 3D tilt stage */}
        <div id="hero-3d-stage" ref={stageRef} className="hero-perspective-stage">
          <div
            id="hero-3d-window"
            ref={windowRef}
            style={tilt ? { transform: tilt } : undefined}
            className={`hero-3d-window obsidian-card rounded-2xl overflow-hidden border border-white/[0.12] ${leveled ? "is-leveled" : ""}`}
          >
            {/* Window chrome */}
            <div className="px-4 sm:px-6 py-3.5 bg-[#0E0E13]/95 border-b border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/50 border border-rose-400/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50 border border-amber-400/40" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50 border border-emerald-400/40" />
                </div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#9496A1] pl-2 border-l border-white/[0.08]">
                  HOW DRIFT IS FOUND
                </span>
                <span className="text-xs font-mono text-white font-medium bg-white/[0.05] px-2 py-0.5 rounded border border-white/[0.08]">
                  order.shipped · {revisions[0]?.version ?? "v1"} → {activeRevision?.version ?? "—"}
                </span>
                <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono text-[#5E606E] bg-[#050507] px-2 py-0.5 rounded border border-white/[0.06]">
                  <kbd className="text-white/80">↑</kbd><kbd className="text-white/80">↓</kbd> or <kbd className="text-white/80">J</kbd><kbd className="text-white/80">K</kbd> row physics
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setStreaming((current) => !current)}
                  aria-pressed={streaming}
                  className="px-2.5 py-1 rounded-lg border border-white/[0.12] bg-white/[0.04] hover:bg-white/[0.09] text-white inline-flex items-center gap-1.5 transition-all"
                >
                  <span className={`w-2 h-2 rounded-full ${streaming ? "bg-emerald-400 animate-ping" : "bg-[#5E606E]"}`} />
                  <span>{streaming ? "⚡ Streaming live samples…" : "⚡ Simulate live traffic"}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  {counts.breaking > 0 && <span className="pill-breaking px-2 py-0.5 rounded-full font-medium">{counts.breaking} breaking</span>}
                  {counts.warning > 0 && <span className="pill-warning px-2 py-0.5 rounded-full font-medium">{counts.warning} warning</span>}
                  {counts.safe > 0 && <span className="pill-safe px-2 py-0.5 rounded-full font-medium">{counts.safe} safe</span>}
                  {counts.info > 0 && <span className="pill-info px-2 py-0.5 rounded-full font-medium">{counts.info} stable</span>}
                  {findings.length === 0 && <span className="pill-info px-2 py-0.5 rounded-full font-medium">no drift</span>}
                </div>
              </div>
            </div>

            {/* Split grid: table + evidence inspector */}
            <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.07]">
              <div className="lg:col-span-7 bg-[#070709] flex flex-col justify-between live-grid-wrapper">
                <div className="laser-scanline" aria-hidden="true" />
                <CrosshairLattice id="hero-crosshairs" />

                <div className="relative z-10">
                  <div className="grid grid-cols-12 px-4 sm:px-6 py-2.5 text-[10px] font-mono uppercase tracking-wider text-[#5E606E] border-b border-white/[0.06] bg-[#0A0A0D]/80">
                    <div className="col-span-4">Path &amp; telemetry</div>
                    <div className="col-span-3">Type shift</div>
                    <div className="col-span-3">Drift classification</div>
                    <div className="col-span-2 text-right">Presence</div>
                  </div>

                  {rows.length > 0 ? (
                    // Capped so a payload pair with many findings cannot push the
                    // rest of the page below the fold; the table scrolls instead.
                    <div className="max-h-[360px] overflow-y-auto">
                      <DriftTable rows={rows} flashIndex={flashIndex} onSelect={setSelectedIndex} />
                    </div>
                  ) : (
                    <p className="px-4 sm:px-6 py-10 text-center font-mono text-xs text-[#5E606E]">
                      These two revisions infer an identical contract, so there is no drift to classify.
                    </p>
                  )}
                </div>

                <div className="relative z-10 px-4 sm:px-6 py-3 bg-[#0A0A0D] border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#9496A1]">
                  <div className="flex items-center gap-2 overflow-x-auto min-w-0">
                    <span className="text-[#5E606E] shrink-0">
                      {streaming ? "Live sample:" : "Candidate snippet:"}
                    </span>
                    <code className="px-2 py-0.5 rounded bg-[#111116] text-white/90 border border-white/[0.06] truncate max-w-full">{snippet}</code>
                  </div>
                  <button type="button" onClick={openWorkbenchWithPreset} className="text-xs font-mono text-white hover:text-emerald-400 inline-flex items-center gap-1 transition-colors shrink-0">
                    <span>Inspect in full workbench</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              </div>

              <EvidenceInspector
                finding={selected}
                revision={activeRevision}
                index={selectedIndex}
                total={findings.length}
                onOpenInWorkbench={openWorkbenchWithPreset}
              />
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] font-mono text-[#5E606E]">
          Press <button type="button" onClick={openCommandPalette} className="text-white/80 hover:text-white underline underline-offset-2">⌘K</button>{" "}
          for the command palette, or ↑/↓ and J/K to move through findings.
        </p>
      </div>
    </section>
  );
}
