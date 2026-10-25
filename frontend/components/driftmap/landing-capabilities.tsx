"use client";

import { useCallback, useEffect, useState } from "react";
import { DriftAudioSynth } from "@/lib/driftmap/audio-synth";
import { CLASSIFICATION_CAVEAT } from "@/lib/driftmap/rules";
import { useTiltCard } from "./use-tilt-card";

/**
 * "Capabilities" bento grid.
 *
 * Ported from `#capabilities` in the reference build: the 12-column bento, the
 * animated wildcard-funnel Bézier diagram, the four-tier risk taxonomy, the
 * sheet's only Markdown preview, the local-first privacy card, and the
 * three-plane isometric contract stack with `selectIsoLayer` /
 * `toggleIsoExplode` interaction.
 */

const ISO_CAPTIONS: Record<number, string> = {
  0: "Showing all 3 stepped planes in isometric cascade — click any plane to pop forward at 0°.",
  1: "Focused Plane 01 (0° flat): raw JSON samples stored locally in IndexedDB with zero server upload.",
  2: "Focused Plane 02 (0° flat): wildcard array indices (/items/0, /items/1) collapsed into /items/*/sku.",
  3: "Focused Plane 03 (0° flat): semantic compatibility rules score every drift with rule citations.",
};

export function CapabilitiesSection({ onLaunchGraph, onCopySampleMarkdown }: {
  onLaunchGraph: () => void;
  onCopySampleMarkdown: () => void;
}) {
  return (
    <section id="capabilities" className="py-20 md:py-28 border-b border-white/[0.07] bg-dot-matrix">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-14">
          <div className="text-xs font-mono uppercase tracking-[0.14em] text-[#9496A1] mb-2.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>CAPABILITIES</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white mb-3">
            Evidence, classification, and exports — in one review
          </h2>
          <p className="text-sm sm:text-base text-[#9496A1]">
            Built specifically for backend and platform engineers reviewing payload changes before merging pull requests.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <NormalizationCard />
          <RiskTaxonomyCard />
          <IsometricStackCard onLaunchGraph={onLaunchGraph} />
          <MarkdownExportCard onCopySampleMarkdown={onCopySampleMarkdown} />
          <LocalFirstCard />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function NormalizationCard() {
  const ref = useTiltCard<HTMLDivElement>();
  return (
    <div ref={ref} className="lg:col-span-7 obsidian-card obsidian-card-spotlight obsidian-card-interactive rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#9496A1] mb-4">
          <span>PATH NORMALIZATION &amp; UNION TYPES</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2.5">Contract inference from samples</h3>
        <p className="text-sm text-[#9496A1] leading-relaxed mb-6 max-w-xl">
          Builds a structural contract from one or many JSON payloads or an OpenAPI 3.0 document. Array items collapse into
          wildcard paths like <code className="text-white font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">/items/*/id</code> so
          heterogeneous elements are compared together.
        </p>
      </div>

      <div className="relative z-10 rounded-xl bg-[#050507] border border-white/[0.08] p-4 font-mono text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <div className="sm:col-span-5 space-y-1.5 bg-[#0A0A0D] p-3 rounded-lg border border-white/[0.06]">
            <div className="text-[10px] text-[#5E606E] uppercase">Raw observed array indices</div>
            <div className="text-[#9496A1] flex items-center justify-between gap-2">
              <span>/items/<span className="text-white">0</span>/id</span>
              <span className="text-emerald-400">&quot;sku_01&quot;</span>
            </div>
            <div className="text-[#9496A1] flex items-center justify-between gap-2">
              <span>/items/<span className="text-white">1</span>/id</span>
              <span className="text-amber-400">10492</span>
            </div>
            <div className="text-[#9496A1] flex items-center justify-between gap-2">
              <span>/items/<span className="text-white">2</span>/id</span>
              <span className="text-rose-400">null</span>
            </div>
          </div>

          <div className="sm:col-span-2 flex justify-center items-center py-2 sm:py-0">
            <svg className="w-20 h-20" viewBox="0 0 80 80" fill="none" aria-hidden="true">
              <path d="M 4 16 C 36 16, 40 40, 76 40" stroke="rgba(52, 211, 153, 0.25)" strokeWidth={1.5} />
              <path d="M 4 40 L 76 40" stroke="rgba(251, 191, 36, 0.25)" strokeWidth={1.5} />
              <path d="M 4 64 C 36 64, 40 40, 76 40" stroke="rgba(251, 113, 133, 0.25)" strokeWidth={1.5} />
              <path d="M 4 16 C 36 16, 40 40, 76 40" stroke="#34D399" strokeWidth={2} strokeLinecap="round" className="data-pipe-flow-fast" />
              <path d="M 4 40 L 76 40" stroke="#FBBF24" strokeWidth={2} strokeLinecap="round" className="data-pipe-flow-fast" />
              <path d="M 4 64 C 36 64, 40 40, 76 40" stroke="#FB7185" strokeWidth={2} strokeLinecap="round" className="data-pipe-flow-fast" />
              <circle cx="74" cy="40" r="3" fill="#38BDF8" />
            </svg>
          </div>

          <div className="sm:col-span-5 bg-[#111116] p-3 rounded-lg border border-white/[0.14] shadow-inner">
            <div className="text-[10px] text-sky-400 uppercase mb-1">Normalized contract node</div>
            <div className="text-white font-semibold mb-1">/items/*/id</div>
            <div className="text-[11px] text-[#9496A1]">type: <span className="text-amber-300">string | number</span></div>
            <div className="text-[11px] text-[#9496A1]">status: <span className="text-rose-300">required · nullable</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskTaxonomyCard() {
  const ref = useTiltCard<HTMLDivElement>();
  return (
    <div ref={ref} className="lg:col-span-5 obsidian-card obsidian-card-spotlight obsidian-card-interactive rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#9496A1] mb-4">
          <span>4-TIER RISK TAXONOMY</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2.5">Semantic drift classification</h3>
        <p className="text-sm text-[#9496A1] leading-relaxed mb-6">
          DriftMap classifies each drift as breaking (removed fields, narrowed types), warning (new nullability,
          required-to-optional shifts), safe additions, or informational notes.
        </p>
      </div>

      <div className="relative z-10 space-y-2 font-mono text-xs">
        {[
          { severity: "breaking", text: "Field removed · Type narrowed" },
          { severity: "warning", text: "Became nullable · Req → Opt" },
          { severity: "safe", text: "Optional field added" },
          { severity: "info", text: "Unchanged baseline contract" },
        ].map(({ severity, text }) => (
          <div key={severity} className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[#050507] border border-white/[0.06] transition-colors">
            <span className={`pill-${severity} px-2 py-0.5 rounded text-[11px] capitalize`}>{severity}</span>
            <span className="text-[#9496A1] text-[11px] text-right">{text}</span>
          </div>
        ))}
        <p className="text-[10px] text-[#5E606E] leading-relaxed pt-1">{CLASSIFICATION_CAVEAT}</p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function IsometricStackCard({ onLaunchGraph }: { onLaunchGraph: () => void }) {
  const ref = useTiltCard<HTMLDivElement>();
  const [focusedLayer, setFocusedLayer] = useState(0);
  const [exploded, setExploded] = useState(false);

  const selectLayer = useCallback((layer: number) => {
    setFocusedLayer((current) => (layer === current && layer !== 0 ? 0 : layer));
  }, []);

  useEffect(() => {
    DriftAudioSynth.playTick(focusedLayer === 0 ? 860 : 980 + focusedLayer * 110);
  }, [focusedLayer]);

  const toggleExplode = () => {
    setFocusedLayer(0);
    setExploded((current) => !current);
    DriftAudioSynth.playTick(1200);
  };

  const layerButtonClass = (layer: number) => `w-full text-left px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
    focusedLayer === layer
      ? "bg-white/[0.08] border-white/30 text-white"
      : "bg-[#050507] border-white/[0.07] text-[#9496A1] hover:text-white"
  }`;

  const planeClass = (layer: number, position: string) => {
    if (focusedLayer === 0) return `iso-layer ${position} flex flex-col justify-between font-mono text-xs`;
    return `iso-layer ${position} ${focusedLayer === layer ? "is-focused" : "is-dimmed"} flex flex-col justify-between font-mono text-xs`;
  };

  return (
    <div ref={ref} className="lg:col-span-12 obsidian-card obsidian-card-spotlight rounded-2xl p-6 sm:p-8 border border-white/[0.12]">
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        <div className="lg:col-span-5 space-y-4">
          <div className="inline-flex flex-wrap items-center gap-2 px-2.5 py-1 rounded-md bg-sky-500/10 border border-sky-500/30 text-xs font-mono text-sky-300">
            <span>3D ISOMETRIC ARCHITECTURE</span>
            <span className="text-white/25">·</span>
            <span>CLICK PLANE TO FOCUS</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-semibold text-white tracking-tight">
            Interactive 3D isometric contract stack
          </h3>
          <p className="text-sm text-[#9496A1] leading-relaxed">
            Click any plane below to pop it forward flat at 0° for crystal-clear reading, or view the stepped 3D cascade to see how
            raw JSON samples collapse into a normalized wildcard tree and emit semantic drift verdicts.
          </p>

          <div className="space-y-2 font-mono text-xs pt-1">
            <button type="button" onClick={() => selectLayer(0)} className={layerButtonClass(0)}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-white shrink-0" />
                <span className="truncate">Stepped 3D cascade · all 3 planes visible</span>
              </span>
              <span className="text-[10px] text-white/70 shrink-0">Default isometric</span>
            </button>
            <button type="button" onClick={() => selectLayer(3)} className={layerButtonClass(3)}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="truncate">Plane 03 · Classified semantic diff</span>
              </span>
              <span className="text-[10px] text-rose-300 shrink-0">Compatibility verdict</span>
            </button>
            <button type="button" onClick={() => selectLayer(2)} className={layerButtonClass(2)}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate">Plane 02 · Normalized wildcard tree (`/*`)</span>
              </span>
              <span className="text-[10px] text-amber-300 shrink-0">/items/*/sku</span>
            </button>
            <button type="button" onClick={() => selectLayer(1)} className={layerButtonClass(1)}>
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                <span className="truncate">Plane 01 · Raw JSON payload samples</span>
              </span>
              <span className="text-[10px] text-sky-300 shrink-0">IndexedDB local</span>
            </button>
          </div>

          <div className="pt-1 flex flex-wrap items-center gap-3">
            <button type="button" onClick={toggleExplode} className="btn-geist-secondary px-3 py-1.5 rounded-lg text-xs font-mono text-white whitespace-nowrap">
              {exploded ? "Collapse Z-axis" : "Toggle Z-axis explode"}
            </button>
            <button type="button" onClick={onLaunchGraph} className="text-xs font-mono text-sky-400 hover:text-sky-300 transition-colors whitespace-nowrap">
              Launch 3D force graph →
            </button>
          </div>
          <p id="iso-caption-status" className="text-[11px] font-mono text-[#9496A1]">{ISO_CAPTIONS[focusedLayer]}</p>
        </div>

        <div className="lg:col-span-7 iso-scene flex items-center justify-center min-h-[390px] py-6 bg-[#050507]/90 rounded-2xl border border-white/[0.06]">
          <div className={`iso-stack ${focusedLayer !== 0 ? "has-focused-layer" : ""} ${exploded && focusedLayer === 0 ? "iso-exploded" : ""}`}>
            {/* Plane 01 — raw JSON payloads */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => selectLayer(1)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLayer(1); } }}
              className={planeClass(1, "iso-layer-1")}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-sky-400 border-b border-white/[0.08] pb-1.5">
                <span className="font-semibold">PLANE 01 · RAW JSON PAYLOADS</span>
                <span className="px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-zinc-300 shrink-0">IndexedDB local</span>
              </div>
              <div className="grid grid-cols-2 gap-2 my-auto text-[11px]">
                <div className="p-2 rounded bg-[#07070B] border border-white/[0.07] text-[#9496A1] min-w-0">
                  <div className="text-white font-medium truncate">v1_sample_1.json</div>
                  <div className="text-[10px] text-emerald-400 truncate">&quot;email&quot;: &quot;a@b.co&quot;</div>
                </div>
                <div className="p-2 rounded bg-[#07070B] border border-white/[0.07] text-[#9496A1] min-w-0">
                  <div className="text-white font-medium truncate">v2_candidate.json</div>
                  <div className="text-[10px] text-rose-400 truncate">&quot;sku&quot;: 1042</div>
                </div>
              </div>
              <div className="text-[10px] text-[#9496A1] flex justify-between gap-2 pt-1 border-t border-white/[0.06]">
                <span>Evidence: sample count per side</span>
                <span className="text-sky-400 font-medium shrink-0">Click to pop 0° flat ↗</span>
              </div>
            </div>

            {/* Plane 02 — normalized wildcard tree */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => selectLayer(2)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLayer(2); } }}
              className={planeClass(2, "iso-layer-2")}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-amber-300 border-b border-white/[0.08] pb-1.5">
                <span className="font-semibold">PLANE 02 · NORMALIZED WILDCARD TREE (`/*`)</span>
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-zinc-300 shrink-0">AST pointer merge</span>
              </div>
              <div className="space-y-1.5 my-auto text-[11px]">
                <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-[#07070B] border border-white/[0.08]">
                  <span className="text-white font-medium truncate">/customer/email</span>
                  <span className="text-emerald-400 shrink-0">string · req</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded bg-[#07070B] border border-amber-400/30">
                  <span className="text-white font-medium truncate">/items/*/sku</span>
                  <span className="text-amber-300 shrink-0">string ➔ number</span>
                </div>
              </div>
              <div className="text-[10px] text-[#9496A1] flex justify-between gap-2 pt-1 border-t border-white/[0.06]">
                <span>Wildcard collapse active</span>
                <span className="text-amber-300 font-medium shrink-0">Click to pop 0° flat ↗</span>
              </div>
            </div>

            {/* Plane 03 — classified semantic diff */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => selectLayer(3)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectLayer(3); } }}
              className={planeClass(3, "iso-layer-3")}
            >
              <div className="flex items-center justify-between gap-2 text-[10px] text-rose-300 border-b border-white/[0.08] pb-1.5">
                <span className="font-semibold">PLANE 03 · CLASSIFIED SEMANTIC DIFF</span>
                <span className="px-1.5 py-0.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-200 shrink-0">DriftMap classification</span>
              </div>
              <div className="space-y-1.5 my-auto text-[11px]">
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-rose-950/35 border border-rose-500/40">
                  <span className="text-white font-medium truncate">/customer/email</span>
                  <span className="pill-breaking px-2 py-0.5 rounded-full text-[10px] shrink-0">BREAKING · REMOVED</span>
                </div>
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-amber-950/30 border border-amber-500/35">
                  <span className="text-white font-medium truncate">/customer/age</span>
                  <span className="pill-warning px-2 py-0.5 rounded-full text-[10px] shrink-0">WARNING · NULLABLE</span>
                </div>
              </div>
              <div className="text-[10px] text-[#9496A1] flex justify-between gap-2 pt-1 border-t border-white/[0.06]">
                <span>PR report ready</span>
                <span className="text-[#9496A1] font-medium shrink-0">Heuristic classification, not a guarantee</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const MARKDOWN_PREVIEW = `### DriftMap Contract Review (\`Order API v1 → v2\`)
| Severity | Path | Rule | Before → After |
| :--- | :--- | :--- | :--- |
| 🔴 **BREAKING** | \`/customer/email\` | \`FIELD_REMOVED\` | \`string (req)\` → \`missing\` |
| 🟡 **WARNING** | \`/customer/age\` | \`NULLABLE_ADDED\` | \`string\` → \`string | null\` |`;

function MarkdownExportCard({ onCopySampleMarkdown }: { onCopySampleMarkdown: () => void }) {
  const ref = useTiltCard<HTMLDivElement>();
  return (
    <div ref={ref} className="lg:col-span-6 obsidian-card obsidian-card-spotlight obsidian-card-interactive rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-[#9496A1] mb-4">
          <span>PR-READY ARTIFACTS</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2.5">Markdown &amp; workspace exports</h3>
        <p className="text-sm text-[#9496A1] leading-relaxed mb-6">
          Copy a clean Markdown summary for pull requests or incident threads, or export and re-import the full workspace as JSON to
          share a review session.
        </p>
      </div>

      <div className="relative z-10 rounded-xl bg-[#050507] border border-white/[0.08] p-4 font-mono text-[11px] text-[#9496A1] overflow-x-auto">
        <div className="flex items-center justify-between gap-2 text-[#5E606E] mb-2 pb-1.5 border-b border-white/[0.06]">
          <span>MARKDOWN PR SUMMARY PREVIEW</span>
          <button type="button" onClick={onCopySampleMarkdown} className="text-white hover:text-emerald-400 transition-colors shrink-0">
            Copy snippet
          </button>
        </div>
        <pre className="leading-relaxed text-white/85 whitespace-pre">{MARKDOWN_PREVIEW}</pre>
      </div>
    </div>
  );
}

function LocalFirstCard() {
  const ref = useTiltCard<HTMLDivElement>();
  return (
    <div ref={ref} className="lg:col-span-6 obsidian-card obsidian-card-spotlight obsidian-card-interactive rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
      <div className="relative z-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-300 mb-4">
          <span>ZERO DEFAULT TELEMETRY</span>
        </div>
        <h3 className="text-xl font-semibold text-white mb-2.5">Local-first privacy</h3>
        <p className="text-sm text-[#9496A1] leading-relaxed mb-6">
          Payloads stay in your browser via IndexedDB by default. Nothing is uploaded unless you sign in and explicitly sync a
          workspace.
        </p>
      </div>

      <div className="relative z-10 rounded-xl bg-[#050507] border border-white/[0.08] p-4 font-mono text-xs space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#9496A1] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            Browser storage engine
          </span>
          <span className="text-white text-right">IndexedDB (`contract-atlas`)</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-[#9496A1]">Outbound payload calls</span>
          <span className="text-emerald-400 font-semibold text-right">0 requests (offline-ready)</span>
        </div>
        <div className="pt-1">
          <div className="flex justify-between gap-2 text-[10px] text-[#5E606E] mb-1">
            <span>DOCUMENT IMPORT CAP</span>
            <span>2.0 MB MAX PER SPEC</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div className="w-1/4 h-full bg-gradient-to-r from-emerald-400 to-sky-400 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
