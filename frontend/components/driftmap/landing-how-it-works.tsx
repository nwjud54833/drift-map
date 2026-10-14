"use client";

import { useTiltCard } from "./use-tilt-card";

/**
 * "How it works" — three steps joined by animated SVG Bézier data pipes.
 *
 * Ported from `#how-it-works` in the Obsidian v2.5 "Spatial" reference build,
 * including the two gradient-stroked connector pipes and the `data-pipe-flow`
 * dash animation. Each card keeps the reference's cursor-tracked tilt and
 * specular spotlight.
 */

interface StepPanelRow {
  left: string;
  right: string;
  rightClass: string;
}

interface Step {
  badge: string;
  meta: string;
  title: string;
  body: string;
  panel: {
    heading: string;
    status: string;
    statusClass: string;
    /** Either a list of evidence rows, or the three severity pills. */
    rows?: readonly StepPanelRow[];
    pills?: boolean;
  };
}

const STEPS: readonly Step[] = [
  {
    badge: "01 · INPUT",
    meta: "JSON / YAML ≤ 2 MB",
    title: "Add samples",
    body: "Paste raw JSON payloads or import OpenAPI 3.0 specs in JSON or YAML. Group samples into baseline and candidate sets inside a local workspace.",
    panel: {
      heading: "WORKSPACE INPUTS",
      status: "✓ Validated",
      statusClass: "text-emerald-400",
      rows: [
        { left: "baseline_orders_v1.json", right: "3 samples", rightClass: "text-[10px] text-[#9496A1]" },
        { left: "candidate_orders_v2.yaml", right: "OpenAPI 3.0", rightClass: "text-[10px] text-sky-400" },
      ],
    },
  },
  {
    badge: "02 · INFERENCE",
    meta: "Normalized pointers",
    title: "Infer the contract",
    body: "DriftMap merges every sample into a normalized path tree, recording observed types, nullability, and whether each field was always present.",
    panel: {
      heading: "INFERRED CONTRACT TREE",
      status: "Wildcard /*",
      statusClass: "text-[#9496A1]",
      rows: [
        { left: "/customer/email", right: "string · req (3/3)", rightClass: "text-[11px] text-emerald-400" },
        { left: "/items/*/sku", right: "string|number · req", rightClass: "text-[11px] text-amber-400" },
      ],
    },
  },
  {
    badge: "03 · CLASSIFICATION",
    meta: "Ranked by risk",
    title: "Review classified drift",
    body: "Every difference between baseline and candidate is scored by compatibility rules and surfaced with before/after evidence you can filter and export.",
    panel: {
      heading: "SEMANTIC VERDICT",
      status: "Action required",
      statusClass: "text-rose-400",
      pills: true,
    },
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 md:py-28 border-b border-white/[0.07] relative">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-14 gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-[#9496A1] mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
              <span>HOW IT WORKS</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white">
              From samples to ranked findings in three steps
            </h2>
          </div>
          <p className="text-sm text-[#9496A1] max-w-md">
            No custom DSL or manual JSON Schema authoring required. Drop raw response bodies or OpenAPI documents and let
            evidence guide the review.
          </p>
        </div>

        <div className="relative">
          {/* Animated Bézier connector pipes (desktop only). */}
          <svg
            className="hidden md:block absolute top-1/2 -translate-y-1/2 left-0 w-full h-32 pointer-events-none z-0"
            viewBox="0 0 1200 120"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path d="M 360 60 C 415 20, 445 100, 500 60" stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
            <path d="M 360 60 C 415 20, 445 100, 500 60" stroke="url(#pipe-grad-1)" strokeWidth={2.5} strokeLinecap="round" className="data-pipe-flow" />
            <path d="M 760 60 C 815 100, 845 20, 900 60" stroke="rgba(255,255,255,0.08)" strokeWidth={2} />
            <path d="M 760 60 C 815 100, 845 20, 900 60" stroke="url(#pipe-grad-2)" strokeWidth={2.5} strokeLinecap="round" className="data-pipe-flow" />
            <defs>
              <linearGradient id="pipe-grad-1" x1="360" y1="60" x2="500" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#34D399" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#FBBF24" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="pipe-grad-2" x1="760" y1="60" x2="900" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FBBF24" stopOpacity="0.2" />
                <stop offset="50%" stopColor="#FB7185" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0.3" />
              </linearGradient>
            </defs>
          </svg>

          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <StepCard key={step.badge} step={step} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepCard({ step }: { step: Step }) {
  const ref = useTiltCard<HTMLDivElement>();
  const { panel } = step;

  return (
    <div
      ref={ref}
      className="obsidian-card obsidian-card-spotlight obsidian-card-interactive rounded-2xl p-6 flex flex-col justify-between"
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-white/[0.05] text-white border border-white/[0.1] whitespace-nowrap">
            {step.badge}
          </span>
          <span className="font-mono text-[11px] text-[#5E606E] whitespace-nowrap">{step.meta}</span>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2.5">{step.title}</h3>
        <p className="text-sm text-[#9496A1] leading-relaxed mb-6">{step.body}</p>
      </div>

      <div className="relative z-10 rounded-xl bg-[#050507] border border-white/[0.07] p-3.5 font-mono text-xs">
        <div className="flex items-center justify-between gap-2 text-[11px] text-[#5E606E] pb-2 mb-2 border-b border-white/[0.06]">
          <span>{panel.heading}</span>
          <span className={panel.statusClass}>{panel.status}</span>
        </div>

        {panel.pills ? (
          <div className="flex items-center justify-between gap-1.5 pt-1">
            <span className="pill-breaking px-2 py-1 rounded text-[11px] w-full text-center">Breaking (2)</span>
            <span className="pill-warning px-2 py-1 rounded text-[11px] w-full text-center">Warning (1)</span>
            <span className="pill-safe px-2 py-1 rounded text-[11px] w-full text-center">Safe (1)</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {panel.rows?.map((row) => (
              <div key={row.left} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded bg-[#0E0E13] border border-white/[0.05]">
                <span className="text-white/90 truncate">{row.left}</span>
                <span className={`${row.rightClass} shrink-0`}>{row.right}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
