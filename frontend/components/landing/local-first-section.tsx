import React from 'react';

export const LocalFirstSection: React.FC = () => {
  return (
    <section className="relative py-28 border-b border-[#1A202A] bg-[#07090E]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Minimal Editorial Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">

          {/* Left: Huge Clean Statement */}
          <div className="lg:col-span-6">
            <div className="text-xs font-mono uppercase tracking-widest text-[#3B82F6] mb-4">
              Local-First Invariant
            </div>
            <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.92]">
              YOUR PAYLOADS
              <br />
              <span className="text-[#8993A5]">STAY YOURS.</span>
            </h2>
            <p className="mt-8 text-base sm:text-lg text-[#8993A5] font-normal leading-relaxed max-w-md">
              Analyze and persist your payloads locally. No upload. No API key. No cloud dependency.
            </p>
          </div>

          {/* Right: Pure Architectural Flow (PAYLOAD -> LOCAL ANALYSIS -> LOCAL STORAGE) */}
          <div className="lg:col-span-6">
            <div className="rounded-lg bg-[#090C12] border border-[#1A202A] p-8 shadow-2xl relative">

              <div className="flex items-center justify-between border-b border-[#1A202A] pb-4 mb-8">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                  ISOLATION BOUNDARY
                </span>
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>AIR-GAPPED</span>
                </span>
              </div>

              {/* Pure Vertical Structural Flow: PAYLOAD -> LOCAL ANALYSIS -> LOCAL STORAGE */}
              <div className="space-y-4">

                {/* 01: PAYLOAD */}
                <div className="p-4 rounded bg-[#07090F] border border-[#1A202A] flex items-center justify-between font-mono">
                  <div>
                    <div className="text-xs font-bold text-white tracking-wider">PAYLOAD</div>
                    <div className="text-[11px] text-[#8993A5] mt-0.5 font-sans">Raw JSON, webhook replay, or fixture</div>
                  </div>
                  <span className="text-[11px] text-[#8993A5]">stdin</span>
                </div>

                {/* Vector arrow */}
                <div className="flex justify-center -my-2">
                  <div className="h-6 w-[1px] bg-[#3B82F6]/50 flex items-center justify-center">
                    <span className="text-[10px] text-[#3B82F6] translate-y-3">↓</span>
                  </div>
                </div>

                {/* 02: LOCAL ANALYSIS */}
                <div className="p-4 rounded bg-[#0E131E] border border-[#3B82F6]/40 flex items-center justify-between font-mono shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                  <div>
                    <div className="text-xs font-bold text-white tracking-wider">LOCAL ANALYSIS</div>
                    <div className="text-[11px] text-[#93C5FD] mt-0.5 font-sans">In-Memory WASM AST &amp; Type Lattice</div>
                  </div>
                  <span className="text-[11px] text-[#3B82F6]">100% RAM</span>
                </div>

                {/* Vector arrow */}
                <div className="flex justify-center -my-2">
                  <div className="h-6 w-[1px] bg-[#3B82F6]/50 flex items-center justify-center">
                    <span className="text-[10px] text-[#3B82F6] translate-y-3">↓</span>
                  </div>
                </div>

                {/* 03: LOCAL STORAGE */}
                <div className="p-4 rounded bg-[#07090F] border border-[#1A202A] flex items-center justify-between font-mono">
                  <div>
                    <div className="text-xs font-bold text-white tracking-wider">LOCAL STORAGE</div>
                    <div className="text-[11px] text-[#8993A5] mt-0.5 font-sans">Local schema registry or SQLite disk</div>
                  </div>
                  <span className="text-[11px] text-[#8993A5]">~/.driftmap</span>
                </div>

              </div>

              <div className="mt-8 pt-4 border-t border-[#1A202A] flex items-center justify-between text-[11px] font-mono text-[#8993A5]">
                <span>Egress Firewall: DROP ALL</span>
                <span className="text-emerald-400">Zero network transmission</span>
              </div>

            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
