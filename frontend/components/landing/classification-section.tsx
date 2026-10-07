import React, { useState } from 'react';

interface ClassificationRule {
  trigger: string;
  category: 'BREAKING' | 'WARNING' | 'SAFE' | 'INFO';
  pathExample: string;
  whyItMatters: string;
  engineVerdict: string;
}

const RULES: ClassificationRule[] = [
  {
    trigger: 'FIELD REMOVED',
    category: 'BREAKING',
    pathExample: '/customer/email',
    whyItMatters: 'Downstream accessors reading obj.customer.email will throw uncaught TypeError or send emails to null.',
    engineVerdict: 'Immediate breaking change. Fail CI build.'
  },
  {
    trigger: 'TYPE CHANGED',
    category: 'BREAKING',
    pathExample: '/items/*/price: number → object',
    whyItMatters: 'Downstream calculations expecting numeric arithmetic fail with NaN. Zod/Protobuf serializers reject message.',
    engineVerdict: 'Immediate breaking change. Fail CI build.'
  },
  {
    trigger: 'NEW REQUIRED FIELD',
    category: 'WARNING',
    pathExample: '/shipping/carrier_signature: required',
    whyItMatters: 'Payloads published to legacy systems will fail ingestion if consumer validates closed strict schemas.',
    engineVerdict: 'Risky change. Flag to schema review board.'
  },
  {
    trigger: 'NEW OPTIONAL FIELD',
    category: 'SAFE',
    pathExample: '/meta/correlation_id: optional string',
    whyItMatters: 'Additive payload field safely ignored by backward-compatible consumers and tolerant decoders.',
    engineVerdict: 'Safe. Auto-approve in CI.'
  },
  {
    trigger: 'KEY ORDER REARRANGED',
    category: 'INFO',
    pathExample: '/order: { id, total } → { total, id }',
    whyItMatters: 'JSON specification dictates objects are unordered key-value pairs; no structural impact on compliant parsers.',
    engineVerdict: 'Non-semantic noise filtered out.'
  }
];

export const ClassificationSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'BREAKING' | 'WARNING' | 'SAFE' | 'INFO'>('ALL');
  const [activeRule, setActiveRule] = useState<ClassificationRule>(RULES[0]);

  const filteredRules = selectedCategory === 'ALL'
    ? RULES
    : RULES.filter(r => r.category === selectedCategory);

  return (
    <section className="relative py-28 border-b border-[#1A202A] bg-[#050609]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Editorial Heading */}
        <div className="max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-[#8993A5] mb-4">
            Deterministic Decision Tree
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.96]">
            KNOW WHAT BREAKS.
            <br />
            <span className="text-[#8993A5]">BEFORE DEPLOYING.</span>
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[#8993A5] font-normal leading-relaxed text-balance">
            Not all changes are created equal. DriftMap enforces a strict hierarchy of runtime compatibility so engineers never have to guess whether a schema evolution will halt production traffic.
          </p>
        </div>

        {/* ONE LARGE UNIFIED VISUAL SYSTEM */}
        <div className="mt-14 rounded-lg bg-[#090C12] border border-[#1A202A] overflow-hidden shadow-2xl">

          {/* Classification Pillar Headers */}
          <div className="grid grid-cols-2 md:grid-cols-4 border-b border-[#1A202A] divide-x divide-[#1A202A] bg-[#07090F]">

            {/* BREAKING */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === 'BREAKING' ? 'ALL' : 'BREAKING')}
              className={`p-5 text-left transition-colors ${
                selectedCategory === 'BREAKING' ? 'bg-red-950/20' : 'hover:bg-[#0B0E14]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-red-400 tracking-wider">
                  BREAKING
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              </div>
              <div className="mt-3 text-xs text-[#8993A5] font-mono">
                Deletions &amp; Type Shifts
              </div>
              <div className="mt-1 text-[11px] text-red-400/90 font-mono">
                Exit Code 1 · Blocks CI
              </div>
            </button>

            {/* WARNING */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === 'WARNING' ? 'ALL' : 'WARNING')}
              className={`p-5 text-left transition-colors ${
                selectedCategory === 'WARNING' ? 'bg-amber-950/20' : 'hover:bg-[#0B0E14]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-amber-400 tracking-wider">
                  WARNING
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>
              <div className="mt-3 text-xs text-[#8993A5] font-mono">
                Tightened Invariants
              </div>
              <div className="mt-1 text-[11px] text-amber-400/90 font-mono">
                Review Required
              </div>
            </button>

            {/* SAFE */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === 'SAFE' ? 'ALL' : 'SAFE')}
              className={`p-5 text-left transition-colors ${
                selectedCategory === 'SAFE' ? 'bg-emerald-950/20' : 'hover:bg-[#0B0E14]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-emerald-400 tracking-wider">
                  SAFE
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </div>
              <div className="mt-3 text-xs text-[#8993A5] font-mono">
                Additive Evolution
              </div>
              <div className="mt-1 text-[11px] text-emerald-400/90 font-mono">
                Backward Compatible
              </div>
            </button>

            {/* INFO */}
            <button
              onClick={() => setSelectedCategory(selectedCategory === 'INFO' ? 'ALL' : 'INFO')}
              className={`p-5 text-left transition-colors ${
                selectedCategory === 'INFO' ? 'bg-blue-950/20' : 'hover:bg-[#0B0E14]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#93C5FD] tracking-wider">
                  INFO
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
              </div>
              <div className="mt-3 text-xs text-[#8993A5] font-mono">
                Non-Structural Diffs
              </div>
              <div className="mt-1 text-[11px] text-blue-400/90 font-mono">
                Filtered Noise
              </div>
            </button>

          </div>

          {/* Unified Flow Visual: Rules flowing dynamically into the classification engine */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1A202A] bg-[#07090F]">

            {/* Left: Interactive Transformation Stream */}
            <div className="lg:col-span-7 p-6 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-mono text-[#8993A5] uppercase tracking-wider">
                  Payload Mutation Event Stream
                </span>
                <span className="text-xs font-mono text-[#3B82F6]">
                  {filteredRules.length} Scenarios Loaded
                </span>
              </div>

              {filteredRules.map((rule, idx) => {
                const isSelected = activeRule.trigger === rule.trigger;
                return (
                  <div
                    key={rule.trigger}
                    onClick={() => setActiveRule(rule)}
                    className={`p-4 rounded border cursor-pointer font-mono text-xs transition-all duration-150 ${
                      isSelected
                        ? 'bg-[#0E131E] border-[#3B82F6]'
                        : 'bg-[#090C12] border-[#1A202A] hover:border-[#28303F]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-[#8993A5]">0{idx + 1}</span>
                        <span className="text-white font-semibold tracking-wide">
                          {rule.trigger}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[#8993A5]">→</span>
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          rule.category === 'BREAKING'
                            ? 'bg-red-950/40 text-red-400 border border-red-900/40'
                            : rule.category === 'WARNING'
                            ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40'
                            : rule.category === 'SAFE'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40'
                            : 'bg-blue-950/40 text-[#93C5FD] border border-blue-900/40'
                        }`}>
                          {rule.category}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-[#8993A5] truncate pl-7">
                      Example: {rule.pathExample}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: Concrete Impact & Risk Explanation */}
            <div className="lg:col-span-5 p-6 bg-[#090C12] flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono uppercase tracking-wider text-[#8993A5] mb-4">
                  Runtime Blast Radius Analysis
                </div>

                <div className="space-y-5">
                  <div>
                    <div className="text-xs font-mono text-[#8993A5]">Triggering Pattern</div>
                    <div className="text-base font-mono font-bold text-white mt-1">
                      {activeRule.trigger}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-mono text-[#8993A5]">Sample Path</div>
                    <div className="text-xs font-mono text-[#3B82F6] bg-[#07090F] p-2.5 rounded border border-[#1A202A] mt-1">
                      {activeRule.pathExample}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-mono text-[#8993A5]">Root Cause Explanation</div>
                    <p className="mt-1 text-xs text-[#CBD5E1] leading-relaxed font-sans bg-[#0D121B] p-3.5 rounded border border-[#1A202A]">
                      {activeRule.whyItMatters}
                    </p>
                  </div>

                  <div>
                    <div className="text-xs font-mono text-[#8993A5]">DriftMap Enforcement Action</div>
                    <div className="mt-1 text-xs font-mono text-white flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                      <span>{activeRule.engineVerdict}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-[#1A202A] text-[11px] font-mono text-[#8993A5]">
                DriftMap rule engine conforms to semantic versioning &amp; RFC 7386 JSON Merge Patch rules.
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
