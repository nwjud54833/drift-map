"use client";

import Link from "next/link";
import { CLASSIFICATION_CAVEAT } from "@/lib/driftmap/rules";
import { useTiltCard } from "./use-tilt-card";

/**
 * "Read the change, not just the diff" showcase, the engineering-scope table,
 * the bottom call to action and the footer — ported from `#deep-inspection`,
 * `#limitations`, the closing CTA section and `<footer>` in the Obsidian v2.5
 * "Spatial" reference build.
 */

export function DeepInspectionSection({ onLaunchGraph }: {
  onOpenWorkbench: () => void;
  onLaunchGraph: () => void;
}) {
  const ref = useTiltCard<HTMLDivElement>();

  return (
    <section id="deep-inspection" className="py-20 md:py-28 border-b border-white/[0.07]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="text-xs font-mono uppercase tracking-[0.14em] text-[#9496A1] mb-2.5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>READ THE CHANGE, NOT JUST THE DIFF</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
              Every finding keeps its context
            </h2>
            <p className="text-sm sm:text-base text-[#9496A1] leading-relaxed mb-8">
              Line-by-line text diffs bury the real question:{" "}
              <em className="text-white not-italic font-medium">will existing clients fail when they parse this response?</em>{" "}
              DriftMap pairs each path with the exact rule that fired and the sample evidence behind it.
            </p>

            <ul className="space-y-4 text-sm text-[#9496A1] mb-8">
              {[
                { n: "1", lead: "Filter findings by severity", rest: " or search by JSON-pointer path across deeply nested objects." },
                { n: "2", lead: "Inspect before and after types,", rest: " requiredness, and observed sample values side by side." },
                { n: "3", lead: "See the compatibility rule", rest: " and plain-language explanation for every classification." },
              ].map((item) => (
                <li key={item.n} className="flex items-start gap-3">
                  <span className="mt-1 w-5 h-5 rounded-md bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-white text-xs font-mono shrink-0">
                    {item.n}
                  </span>
                  <span><strong className="text-white font-medium">{item.lead}</strong>{item.rest}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => { window.location.href = "/workbench?sample=1"; }}
                className="btn-geist-secondary px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider text-white inline-flex items-center gap-2"
              >
                <span>Try live inspector in Workbench</span>
                <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                onClick={onLaunchGraph}
                className="btn-geist-secondary px-4 py-2.5 rounded-xl text-xs font-mono uppercase tracking-wider text-sky-400 inline-flex items-center gap-2"
              >
                <span>Explore 3D force graph</span>
                <span aria-hidden="true">↗</span>
              </button>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div ref={ref} className="obsidian-card obsidian-card-spotlight rounded-2xl p-6 sm:p-8 border border-white/[0.12] shadow-2xl">
              <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-5 mb-6 border-b border-white/[0.08]">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#5E606E] mb-1">FINDING INSPECTOR</div>
                  <div className="font-mono text-lg sm:text-xl font-semibold text-white flex flex-wrap items-center gap-2.5">
                    <span className="break-all">/customer/email</span>
                    <span className="pill-breaking text-xs px-2.5 py-0.5 rounded-full font-medium">Breaking · removed</span>
                  </div>
                </div>
                <span className="font-mono text-xs px-2.5 py-1 rounded bg-[#111116] text-[#9496A1] border border-white/[0.08]">
                  RULE_REQUIRED_FIELD_REMOVED
                </span>
              </div>

              <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 font-mono">
                <div className="p-4 rounded-xl bg-[#050507] border border-white/[0.07]">
                  <div className="text-[10px] uppercase tracking-wider text-[#5E606E] mb-2">BASELINE CONTRACT (v1)</div>
                  <div className="text-sm text-white font-medium mb-1">string · required</div>
                  <div className="text-xs text-emerald-400 mb-3">Present in every baseline sample</div>
                  <div className="text-[11px] text-[#9496A1] bg-[#0A0A0D] p-2 rounded border border-white/[0.05]">
                    Observed: <span className="text-white">&quot;taylor@example.com&quot;</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-rose-950/15 border border-rose-500/25">
                  <div className="text-[10px] uppercase tracking-wider text-rose-300/70 mb-2">CANDIDATE CONTRACT (v2)</div>
                  <div className="text-sm text-rose-300 font-medium mb-1">— missing from payload</div>
                  <div className="text-xs text-rose-400/90 mb-3">Absent from every candidate sample</div>
                  <div className="text-[11px] text-rose-200/70 bg-[#0A0A0D]/90 p-2 rounded border border-rose-500/20">
                    Observed: <span className="italic">undefined (key omitted)</span>
                  </div>
                </div>
              </div>

              <div className="relative z-10 p-4 rounded-xl bg-[#111116] border border-white/[0.08] space-y-2">
                <div className="text-xs font-mono uppercase tracking-wider text-white flex items-center gap-2">
                  <svg className="w-4 h-4 text-rose-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>Why this is classified as breaking</span>
                </div>
                <p className="text-xs sm:text-sm text-[#9496A1] leading-relaxed">
                  Field <code className="text-white font-mono">/customer/email</code> was present in every baseline sample
                  (<code className="text-white font-mono">required</code>) and is absent from the candidate samples. Consumers that
                  read <code className="text-white font-mono">payload.data.customer.email</code> without an optional check
                  will see a missing key rather than a string.
                </p>
              </div>

              <p className="relative z-10 mt-4 text-[10px] font-mono text-[#5E606E] leading-relaxed">{CLASSIFICATION_CAVEAT}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const SCOPE_ITEMS = [
  { n: "01", title: "Evidence-based inference, not a formal schema validator", body: "Inference is evidence-based, not a formal schema validator — rare fields missing from your samples won't appear in the inferred contract." },
  { n: "02", title: "No fuzzy field rename matching", body: "Field renames appear as a removal plus an addition; fuzzy rename matching is not performed." },
  { n: "03", title: "OpenAPI 3.0 only (JSON & YAML)", body: "OpenAPI 3.0 only (JSON and YAML); OpenAPI 3.1 and Swagger 2.0 are not parsed, and external $ref URLs are rejected." },
  { n: "04", title: "2 MB document import ceiling", body: "Imports are capped at 2 MB per payload or specification document to keep in-browser parsing responsive." },
  { n: "05", title: "Heuristic compatibility guidance", body: "Classifications are heuristic compatibility guidance, not a guarantee of runtime safety." },
  { n: "06", title: "Browser-scoped IndexedDB persistence", body: "Local data lives in your browser's IndexedDB unless you explicitly sign in and sync." },
] as const;

export function LimitationsSection() {
  return (
    <section id="limitations" className="py-20 md:py-28 border-b border-white/[0.07]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <div className="text-xs font-mono uppercase tracking-[0.14em] text-[#9496A1] mb-2.5 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>LIMITATIONS &amp; ENGINEERING SCOPE</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white mb-3">What it doesn&apos;t do yet</h2>
          <p className="text-sm sm:text-base text-[#9496A1]">
            DriftMap is built for fast, honest contract triage. Know the exact boundaries of sample-based inference before
            integrating it into your release checklist.
          </p>
        </div>

        <div className="obsidian-card rounded-2xl overflow-hidden border border-white/[0.09]">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/[0.07]">
            <div className="divide-y divide-white/[0.07]">
              {SCOPE_ITEMS.slice(0, 3).map((item) => <ScopeRow key={item.n} item={item} />)}
            </div>
            <div className="divide-y divide-white/[0.07]">
              {SCOPE_ITEMS.slice(3).map((item) => <ScopeRow key={item.n} item={item} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ScopeRow({ item }: { item: (typeof SCOPE_ITEMS)[number] }) {
  return (
    <div className="p-6 flex items-start gap-4">
      <span className="font-mono text-xs px-2 py-1 rounded bg-white/[0.04] text-[#9496A1] border border-white/[0.07] shrink-0">{item.n}</span>
      <div>
        <h3 className="text-sm font-semibold text-white mb-1">{item.title}</h3>
        <p className="text-xs sm:text-sm text-[#9496A1] leading-relaxed">{item.body}</p>
      </div>
    </div>
  );
}

export function LandingCta() {
  return (
    <section className="py-20 md:py-24 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="text-xs font-mono uppercase tracking-[0.14em] text-emerald-400 mb-2">
          Make contract changes easy to review.
        </div>
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white mb-4">
          Check your next payload change before it ships.
        </h2>
        <p className="text-base text-[#9496A1] mb-8 max-w-xl mx-auto">
          No account required. Paste two samples and see the inferred contract diff in seconds.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button type="button" onClick={() => { window.location.href = "/workbench?sample=1"; }} className="btn-geist-primary px-6 py-3 rounded-xl text-sm inline-flex items-center gap-2">
            <span>Open the workbench</span>
            <span aria-hidden="true">→</span>
          </button>
          <a href="/signin" className="btn-geist-secondary px-5 py-3 rounded-xl text-sm text-[#9496A1] hover:text-white">
            Sign in to sync workspaces
          </a>
        </div>
      </div>
    </section>
  );
}

const GITHUB_URL = "https://github.com/nwjud54833/drift-map";

export function SiteFooter() {

  return (
    <footer className="relative z-10 border-t border-white/[0.08] bg-[#030304] py-8 px-4 sm:px-6 text-xs text-[#5E606E]">
      <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap justify-center">
          <span className="font-semibold text-white">DriftMap</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">local-first API contract review</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-5 font-mono" aria-label="Footer">
          <Link href="/" className="hover:text-white transition-colors">Landing</Link>
          <button type="button" onClick={() => { window.location.href = "/workbench?sample=1"; }} className="hover:text-white transition-colors">Workbench</button>

          <a href={`${GITHUB_URL}#readme`} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
            GitHub README ↗
          </a>
        </nav>
      </div>
    </footer>
  );
}
