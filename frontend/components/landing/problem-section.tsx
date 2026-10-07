import React, { useState } from 'react';

export const ProblemSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'side-by-side' | 'semantic-only'>('side-by-side');

  return (
    <section id="how-it-works" className="relative py-28 border-b border-[#1A202A] bg-[#050609]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Editorial Statement */}
        <div className="max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-[#8993A5] mb-4">
            The Silent Breaking Change Dilemma
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.96]">
            YOUR API CHANGED.
            <br />
            <span className="text-red-400">YOUR INTEGRATION FOUND OUT LATER.</span>
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[#8993A5] font-normal leading-relaxed text-balance">
            Git diffs and line comparators only track text tokens and whitespace. They do not know that renaming a key or nesting a number inside an object will instantly crash downstream consumers in production.
          </p>
        </div>

        {/* View Switcher */}
        <div className="mt-14 flex items-center justify-between border-b border-[#1A202A] pb-4">
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-[#8993A5]">CONTRAST VIEW</span>
            <div className="flex items-center gap-1 bg-[#090C12] p-1 rounded border border-[#1A202A]">
              <button
                onClick={() => setActiveTab('side-by-side')}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  activeTab === 'side-by-side'
                    ? 'bg-[#141A26] text-white font-medium'
                    : 'text-[#8993A5] hover:text-white'
                }`}
              >
                Raw Diff vs Semantic Signal
              </button>
              <button
                onClick={() => setActiveTab('semantic-only')}
                className={`px-3 py-1 rounded text-xs transition-colors ${
                  activeTab === 'semantic-only'
                    ? 'bg-[#141A26] text-white font-medium'
                    : 'text-[#8993A5] hover:text-white'
                }`}
              >
                Semantic Signal Only
              </button>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-[#8993A5]">
            <span>148 lines diff</span>
            <span>→</span>
            <span className="text-white font-semibold">4 Actionable Verdicts</span>
          </div>
        </div>

        {/* Side-by-Side Visual Comparison Grid */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

          {/* LEFT: RAW JSON (Noisy git additions/deletions) */}
          {activeTab === 'side-by-side' && (
            <div className="lg:col-span-5 rounded-lg bg-[#07090E] border border-[#1A202A] overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#090C12] border-b border-[#1A202A] flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-[#8993A5] uppercase tracking-wider">
                  Raw Git / Text Diff
                </span>
                <span className="text-[11px] font-mono text-red-400/80">noisy line noise</span>
              </div>

              <div className="p-4 font-mono text-xs leading-relaxed overflow-x-auto text-[#8993A5] flex-1 bg-[#050609]">
                <div className="text-gray-600 mb-2">@@ -14,32 +14,35 @@ order_payload.json</div>
                <div className="text-gray-600">&nbsp;&nbsp;&quot;order&quot;: &#123;</div>
                <div className="text-gray-600">&nbsp;&nbsp;&nbsp;&nbsp;&quot;id&quot;: &quot;ord_994827103&quot;,</div>
                <div className="text-red-400/80 bg-red-950/20 px-1 -mx-1 line-through">
                  -&nbsp;&nbsp;&nbsp;&quot;total_cents&quot;: 18450,
                </div>
                <div className="text-gray-600">&nbsp;&nbsp;&nbsp;&nbsp;&quot;currency&quot;: &quot;USD&quot;,</div>
                <div className="text-emerald-400/80 bg-emerald-950/20 px-1 -mx-1">
                  +&nbsp;&nbsp;&nbsp;&quot;total&quot;: &#123; &quot;amount_cents&quot;: 18450 &#125;,
                </div>
                <div className="text-gray-600">&nbsp;&nbsp;&nbsp;&nbsp;&quot;customer&quot;: &#123;</div>
                <div className="text-gray-600">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;name&quot;: &quot;Eleanor Vance&quot;,</div>
                <div className="text-red-400/80 bg-red-950/20 px-1 -mx-1 line-through">
                  -&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;email&quot;: &quot;eleanor.vance@hillhouse.org&quot;,
                </div>
                <div className="text-emerald-400/80 bg-emerald-950/20 px-1 -mx-1">
                  +&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;account_uuid&quot;: &quot;9f8b417e...&quot;
                </div>
                <div className="text-gray-600">&nbsp;&nbsp;&nbsp;&nbsp;&#125;,</div>
                <div className="text-red-400/80 bg-red-950/20 px-1 -mx-1 line-through">
                  -&nbsp;&nbsp;&nbsp;&quot;tracking&quot;: &quot;TRK-99081249&quot;,
                </div>
                <div className="text-emerald-400/80 bg-emerald-950/20 px-1 -mx-1">
                  +&nbsp;&nbsp;&nbsp;&quot;tracking_number&quot;: &quot;TRK-99081249&quot;,
                </div>
                <div className="text-gray-600 my-1">{"// ... omitted lines ..."}</div>
                <div className="text-red-400/80 bg-red-950/20 px-1 -mx-1 line-through">
                  -&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;price&quot;: 4500
                </div>
                <div className="text-emerald-400/80 bg-emerald-950/20 px-1 -mx-1">
                  +&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;price&quot;: &#123; &quot;currency&quot;: &quot;USD&quot;, &quot;amount&quot;: 45.00 &#125;
                </div>
              </div>

              <div className="px-4 py-2.5 bg-[#090C12] border-t border-[#1A202A] text-[11px] font-mono text-[#8993A5]">
                ❌ Gives zero insight into runtime breaking impact or schema invariants.
              </div>
            </div>
          )}

          {/* RIGHT: DRIFTMAP (Semantic contract signal) */}
          <div className={`${activeTab === 'side-by-side' ? 'lg:col-span-7' : 'lg:col-span-12'} rounded-lg bg-[#090C12] border border-[#1A202A] overflow-hidden flex flex-col shadow-2xl`}>
            <div className="px-5 py-3.5 bg-[#0E1219] border-b border-[#1A202A] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                <span className="text-xs font-mono font-semibold text-white uppercase tracking-wider">
                  DriftMap Semantic Contract Signal
                </span>
              </div>
              <span className="text-[11px] font-mono text-[#3B82F6] font-medium">AST-Synthesized</span>
            </div>

            <div className="p-5 flex-1 flex flex-col justify-between space-y-3.5 bg-[#07090F]">

              {/* REMOVED /customer/email */}
              <div className="p-4 rounded bg-[#090C12] border border-[#1A202A] hover:border-red-900/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/40 text-red-400 border border-red-900/40">
                      REMOVED
                    </span>
                    <span className="font-mono text-sm font-semibold text-white">/customer/email</span>
                  </div>
                  <span className="text-xs font-mono text-red-400 font-semibold">BREAKING</span>
                </div>
                <div className="mt-2 text-xs text-[#8993A5] font-mono flex items-center gap-2">
                  <span>Was: string</span>
                  <span>→</span>
                  <span className="text-red-400">Dropped (Omitted from response)</span>
                </div>
                <p className="mt-1.5 text-xs text-[#8993A5] font-sans">
                  Order receipt notification dispatch worker crashes with unhandled TypeError.
                </p>
              </div>

              {/* REMOVED /total_cents */}
              <div className="p-4 rounded bg-[#090C12] border border-[#1A202A] hover:border-red-900/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/40 text-red-400 border border-red-900/40">
                      REMOVED
                    </span>
                    <span className="font-mono text-sm font-semibold text-white">/total_cents</span>
                  </div>
                  <span className="text-xs font-mono text-red-400 font-semibold">BREAKING</span>
                </div>
                <div className="mt-2 text-xs text-[#8993A5] font-mono flex items-center gap-2">
                  <span>Was: number (18450)</span>
                  <span>→</span>
                  <span className="text-amber-400">Restructured to /total/amount_cents</span>
                </div>
                <p className="mt-1.5 text-xs text-[#8993A5] font-sans">
                  Billing integration reading total_cents evaluates to undefined, generating $0 invoices.
                </p>
              </div>

              {/* MOVED /shipping/tracking */}
              <div className="p-4 rounded bg-[#090C12] border border-[#1A202A] hover:border-amber-900/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-900/40">
                      MOVED
                    </span>
                    <span className="font-mono text-sm font-semibold text-white">/shipping/tracking</span>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-semibold">WARNING</span>
                </div>
                <div className="mt-2 text-xs text-[#8993A5] font-mono flex items-center gap-2">
                  <span>Renamed key</span>
                  <span>→</span>
                  <span className="text-white">/shipping/tracking_number</span>
                </div>
                <p className="mt-1.5 text-xs text-[#8993A5] font-sans">
                  Fulfillment status tracker will read null tracking code unless migrated to alias.
                </p>
              </div>

              {/* TYPE CHANGE /items/[index]/price */}
              <div className="p-4 rounded bg-[#090C12] border border-[#1A202A] hover:border-red-900/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-950/40 text-red-400 border border-red-900/40">
                      TYPE CHANGE
                    </span>
                    <span className="font-mono text-sm font-semibold text-white">/items/*/price</span>
                  </div>
                  <span className="text-xs font-mono text-red-400 font-semibold">BREAKING</span>
                </div>
                <div className="mt-2 text-xs text-[#8993A5] font-mono flex items-center gap-2">
                  <span>number (4500)</span>
                  <span>→</span>
                  <span className="text-red-400">object (&#123; currency, amount &#125;)</span>
                </div>
                <p className="mt-1.5 text-xs text-[#8993A5] font-sans">
                  Scalar arithmetic operations fail with NaN; strict Zod/Protobuf serializers reject message.
                </p>
              </div>

            </div>

            <div className="px-5 py-3 bg-[#0E1219] border-t border-[#1A202A] flex items-center justify-between text-xs font-mono">
              <span className="text-emerald-400 flex items-center gap-1.5">
                <span>✓</span>
                <span>Immediate root-cause failure explanation</span>
              </span>
              <span className="text-[#8993A5]">Zero false alarms</span>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
