import React, { useState } from 'react';
import { motion } from 'motion/react';
import { HeroSignatureFlow } from './hero-signature-flow';
import { KineticText } from './kinetic-text';

interface HeroSectionProps {
  onOpenWorkbench: () => void;
}

interface ContractMatrixRow {
  id: string;
  path: string;
  baseline: string;
  candidate: string;
  impactType: 'BREAKING' | 'WARNING' | 'SAFE';
  impactLabel: string;
  driftConnection?: {
    from: string;
    action: string;
    to: string;
  };
  explanation: string;
  downstreamFailure: string;
}

const MATRIX_ROWS: ContractMatrixRow[] = [
  {
    id: 'row-id',
    path: '/order/id',
    baseline: 'string',
    candidate: 'string',
    impactType: 'SAFE',
    impactLabel: 'SAFE',
    explanation: 'Scalar format and cardinality match production baseline 1:1.',
    downstreamFailure: 'Zero migration risk. Schema invariant preserved.'
  },
  {
    id: 'row-total',
    path: '/total_cents',
    baseline: 'number',
    candidate: 'removed',
    impactType: 'BREAKING',
    impactLabel: 'BREAKING',
    driftConnection: {
      from: '/total_cents',
      action: 'REMOVED & RELOCATED',
      to: '/total/amount'
    },
    explanation: 'Field dropped from root; restructured into nested object /total/amount.',
    downstreamFailure: 'Ledger accessor evaluates to undefined; downstream invoices generate $0.00 balances.'
  },
  {
    id: 'row-customer',
    path: '/customer/email',
    baseline: 'string',
    candidate: 'removed',
    impactType: 'BREAKING',
    impactLabel: 'BREAKING',
    driftConnection: {
      from: '/customer/email',
      action: 'DROPPED',
      to: 'unmapped'
    },
    explanation: 'Direct email key omitted in favor of account_uuid reference.',
    downstreamFailure: 'Email dispatcher worker crashes with TypeError: Cannot read properties of undefined.'
  },
  {
    id: 'row-tracking',
    path: '/shipping/tracking',
    baseline: 'string',
    candidate: 'changed',
    impactType: 'WARNING',
    impactLabel: 'WARNING',
    driftConnection: {
      from: '/shipping/tracking',
      action: 'RENAMED',
      to: '/shipping/tracking_number'
    },
    explanation: 'Property renamed to /shipping/tracking_number.',
    downstreamFailure: 'Legacy webhook listeners fail to display courier tracking numbers.'
  },
  {
    id: 'row-price',
    path: '/items/*/price',
    baseline: 'number',
    candidate: 'object',
    impactType: 'BREAKING',
    impactLabel: 'BREAKING',
    driftConnection: {
      from: 'number (scalar)',
      action: 'EXPANDED TO',
      to: '{ currency, amount }'
    },
    explanation: 'Scalar cents integer transformed into composite { currency, amount } object.',
    downstreamFailure: 'Arithmetic calculations (price * qty) evaluate to NaN in JavaScript/TypeScript.'
  }
];

export const HeroSection: React.FC<HeroSectionProps> = ({ onOpenWorkbench }) => {
  const [activeRowId, setActiveRowId] = useState<string>('row-total');
  const [activeTab, setActiveTab] = useState<'matrix' | 'signal'>('matrix');

  const selectedRow = MATRIX_ROWS.find(r => r.id === activeRowId) || MATRIX_ROWS[1];

  return (
    <section className="relative min-h-[94vh] flex flex-col justify-center overflow-hidden pt-10 pb-20 border-b border-[#1A202A] bg-[#050609]">
      {/* Precision atmospheric background grid */}
      <div className="absolute inset-0 bg-grid-subtle opacity-60 pointer-events-none" />

      {/* Subtle depth lighting behind the matrix - restrained electric blue / indigo */}
      <div
        className="absolute top-1/3 right-1/4 -translate-y-1/2 w-[680px] h-[520px] bg-blue-600/[0.045] blur-[150px] pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 w-full">
        {/* Asymmetric Editorial Hero Composition */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">

          {/* LEFT: Huge Editorial Typography */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col justify-between z-10"
          >
            <div>
              {/* Category indicator */}
              <div className="flex items-center gap-2.5 text-xs font-mono text-[#8993A5] mb-8 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                <span className="font-semibold text-white">DRIFTMAP</span>
                <span className="text-[#1A202A]">/</span>
                <span>STRUCTURAL CONTRACT DIFF</span>
              </div>

              {/* Massive Tight Editorial Headline */}
              <h1 className="text-[56px] sm:text-[72px] lg:text-[78px] font-black tracking-[-0.045em] leading-[0.91] text-[#F5F7FA]">
                <KineticText text="YOUR API" />
                <br />
                <span className="text-[#8993A5]"><KineticText text="CHANGED." /></span>
                <br />
                <span className="text-[#3B82F6]"><KineticText text="DRIFTMAP" accent /></span>
                <br />
                <span className="text-white"><KineticText text="SAW IT FIRST." /></span>
              </h1>

              {/* Supporting copy */}
              <p className="mt-8 text-base sm:text-lg text-[#8993A5] max-w-md font-normal leading-relaxed text-balance">
                Compare real API, webhook, and JSON payloads. Detect structural contract drift before your integration does.
              </p>

              {/* Action Buttons */}
              <div className="mt-10 flex flex-wrap items-center gap-4">
                <button
                  onClick={onOpenWorkbench}
                  className="group relative inline-flex items-center gap-2 px-6 py-3.5 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-[4px] shadow-[0_0_24px_rgba(59,130,246,0.3)] transition-all duration-200"
                >
                  <span>Open Workbench</span>
                  <span className="text-sm group-hover:translate-x-1 transition-transform duration-150">→</span>
                </button>

                <a
                  href="https://github.com/nwjud54833/drift-map"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3.5 text-xs font-mono font-medium uppercase tracking-wider text-[#F5F7FA] hover:text-white bg-[#090C12] hover:bg-[#0E1219] border border-[#1A202A] hover:border-[#28303F] rounded-[4px] transition-colors"
                >
                  <span>View GitHub</span>
                  <span className="text-xs text-[#8993A5]">↗</span>
                </a>
              </div>
            </div>

            {/* Invariant proof indicators */}
            <div className="mt-14 pt-8 border-t border-[#1A202A] flex items-center gap-6 text-xs text-[#8993A5] font-mono">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                <span>Deterministic AST</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                <span>Zero Telemetry</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8993A5]" />
                <span>Local-First</span>
              </div>
            </div>
          </motion.div>

          {/* RIGHT: Sophisticated DriftMap Contract Matrix & Drift Signal Engine */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 relative lg:-mr-4"
          >
            {/* Signature animated contract vector flow behind the matrix */}
            <HeroSignatureFlow />

            {/* Layered container with subtle depth and razor-sharp border */}
            <div className="relative rounded-lg bg-[#090C12] border border-[#1A202A] shadow-[0_24px_80px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-300">

              {/* Product Header: DRIFTMAP / CONTRACT MATRIX · ORDER_V2 → ORDER_V3 · LIVE ANALYSIS ● */}
              <div className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b border-[#1A202A] bg-[#07090F]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#1A202A] border border-[#28303F]" />
                    <span className="w-2 h-2 rounded-full bg-[#1A202A] border border-[#28303F]" />
                    <span className="w-2 h-2 rounded-full bg-[#1A202A] border border-[#28303F]" />
                  </div>
                  <span className="text-[12px] font-mono font-bold tracking-wider text-white uppercase ml-2">
                    DRIFTMAP / CONTRACT MATRIX
                  </span>
                </div>

                <div className="flex items-center gap-5 text-xs font-mono">
                  <span className="hidden sm:inline text-[#8993A5]">
                    ORDER_V2 → ORDER_V3
                  </span>

                  <div className="flex items-center gap-2 text-[#3B82F6]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse-subtle" />
                    <span className="font-semibold tracking-wider text-[11px]">LIVE ANALYSIS</span>
                  </div>
                </div>
              </div>

              {/* View Switcher: Matrix View vs Drift Signal Flow */}
              <div className="flex items-center justify-between px-5 py-2.5 bg-[#080B10] border-b border-[#1A202A] text-xs font-mono">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveTab('matrix')}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      activeTab === 'matrix'
                        ? 'bg-[#121722] text-white font-medium border border-[#1E2636]'
                        : 'text-[#8993A5] hover:text-white'
                    }`}
                  >
                    Contract View
                  </button>
                  <button
                    onClick={() => setActiveTab('signal')}
                    className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
                      activeTab === 'signal'
                        ? 'bg-[#121722] text-[#3B82F6] font-medium border border-[#3B82F6]/30'
                        : 'text-[#8993A5] hover:text-white'
                    }`}
                  >
                    <span>Drift Signal Flow</span>
                    <span className="text-[10px] text-[#3B82F6]">●</span>
                  </button>
                </div>

                {/* Counters: 6 BREAKING · 10 WARNING · 4 SAFE */}
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-red-400 font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    6 BREAKING
                  </span>
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    10 WARNING
                  </span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    4 SAFE
                  </span>
                </div>
              </div>

              {activeTab === 'matrix' ? (
                <>
                  {/* Table Column Headers: PATH | BASELINE | CANDIDATE | IMPACT */}
                  <div className="grid grid-cols-12 px-5 py-2.5 text-[11px] font-mono tracking-wider text-[#8993A5] uppercase bg-[#06080C] border-b border-[#1A202A]">
                    <div className="col-span-4 sm:col-span-4">PATH</div>
                    <div className="col-span-3 sm:col-span-3">BASELINE</div>
                    <div className="col-span-3 sm:col-span-3">CANDIDATE</div>
                    <div className="col-span-2 sm:col-span-2 text-right">IMPACT</div>
                  </div>

                  {/* Interactive Contract Matrix Rows */}
                  <div className="divide-y divide-[#1A202A]/80 font-mono text-[12px]">
                    {MATRIX_ROWS.map((row) => {
                      const isSelected = activeRowId === row.id;
                      return (
                        <div
                          key={row.id}
                          onMouseEnter={() => setActiveRowId(row.id)}
                          onClick={() => setActiveRowId(row.id)}
                          className={`grid grid-cols-12 px-5 py-3.5 items-center cursor-pointer transition-all duration-150 relative ${
                            isSelected
                              ? 'bg-[#0E131C] border-l-2 border-l-[#3B82F6]'
                              : 'hover:bg-[#0B0E14]'
                          }`}
                        >
                          {/* PATH */}
                          <div className="col-span-4 flex items-center gap-1.5 truncate pr-2">
                            <span className="text-[#8993A5] text-[11px]">/</span>
                            <span className={`truncate font-semibold ${
                              row.impactType === 'BREAKING'
                                ? 'text-white'
                                : row.impactType === 'WARNING'
                                ? 'text-[#F5F7FA]'
                                : 'text-[#8993A5]'
                            }`}>
                              {row.path.replace('/', '')}
                            </span>
                          </div>

                          {/* BASELINE */}
                          <div className="col-span-3 text-[#8993A5] truncate pr-2 text-[11px]">
                            {row.baseline}
                          </div>

                          {/* CANDIDATE */}
                          <div className="col-span-3 truncate pr-2 text-[11px]">
                            {row.impactType === 'BREAKING' ? (
                              <span className="text-red-400 font-medium">
                                {row.candidate}
                              </span>
                            ) : row.impactType === 'WARNING' ? (
                              <span className="text-amber-400 font-medium">
                                {row.candidate}
                              </span>
                            ) : (
                              <span className="text-emerald-400">
                                {row.candidate}
                              </span>
                            )}
                          </div>

                          {/* IMPACT */}
                          <div className="col-span-2 flex items-center justify-end text-[11px]">
                            <span className={`px-2 py-0.5 rounded font-bold tracking-wider text-[10px] ${
                              row.impactType === 'BREAKING'
                                ? 'bg-red-950/40 text-red-400 border border-red-900/40'
                                : row.impactType === 'WARNING'
                                ? 'bg-amber-950/40 text-amber-400 border border-amber-900/40'
                                : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                            }`}>
                              {row.impactLabel}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* SECTION 4 REQUIREMENT: "DRIFT SIGNAL" VISUAL */
                <div className="p-6 bg-[#07090F] space-y-5">
                  <div className="text-xs font-mono text-[#8993A5] uppercase tracking-wider mb-2">
                    Contract Vector Transformations
                  </div>

                  {/* Flow 1: /total_cents -> REMOVED -> /total/amount */}
                  <div className="p-4 rounded bg-[#090D14] border border-[#1A202A] space-y-3">
                    <div className="text-xs font-mono font-bold text-white flex items-center justify-between">
                      <span>/total_cents Restructure</span>
                      <span className="text-red-400 text-[10px] px-2 py-0.5 rounded bg-red-950/40 border border-red-900/40">
                        BREAKING
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs py-2 px-3 bg-[#050609] rounded border border-[#1A202A]">
                      <div className="text-[#8993A5]">
                        <span className="text-[10px] uppercase text-[#8993A5] block">BASELINE</span>
                        <span className="text-white">/total_cents: number</span>
                      </div>

                      <div className="flex items-center gap-2 text-red-400 font-bold text-[11px] px-2 py-1 bg-red-950/40 rounded border border-red-900/40">
                        <span>↓ REMOVED</span>
                      </div>

                      <div className="text-[#8993A5]">
                        <span className="text-[10px] uppercase text-[#8993A5] block">CANDIDATE</span>
                        <span className="text-emerald-400">/total/amount: object</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#8993A5] font-sans">
                      Client code accessing <code className="text-white font-mono">response.total_cents</code> will evaluate to undefined.
                    </p>
                  </div>

                  {/* Flow 2: /shipping/tracking -> MOVED -> /shipping/tracking_number */}
                  <div className="p-4 rounded bg-[#090D14] border border-[#1A202A] space-y-3">
                    <div className="text-xs font-mono font-bold text-white flex items-center justify-between">
                      <span>/shipping/tracking Rename</span>
                      <span className="text-amber-400 text-[10px] px-2 py-0.5 rounded bg-amber-950/40 border border-amber-900/40">
                        WARNING
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs py-2 px-3 bg-[#050609] rounded border border-[#1A202A]">
                      <div className="text-[#8993A5]">
                        <span className="text-[10px] uppercase text-[#8993A5] block">BASELINE</span>
                        <span className="text-white">/shipping/tracking: string</span>
                      </div>

                      <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] px-2 py-1 bg-amber-950/40 rounded border border-amber-900/40">
                        <span>→ MOVED</span>
                      </div>

                      <div className="text-[#8993A5]">
                        <span className="text-[10px] uppercase text-[#8993A5] block">CANDIDATE</span>
                        <span className="text-white">/shipping/tracking_number: string</span>
                      </div>
                    </div>
                    <p className="text-xs text-[#8993A5] font-sans">
                      Key remapped to alias. Requires fallback accessor to prevent missing tracking telemetry.
                    </p>
                  </div>
                </div>
              )}

              {/* Contextual Micro-Callout on Active Row Hover */}
              <div className="px-5 py-4 bg-[#07090F] border-t border-[#1A202A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                    selectedRow.impactType === 'BREAKING'
                      ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
                      : selectedRow.impactType === 'WARNING'
                      ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                      : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                  }`} />

                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="font-bold text-white">{selectedRow.path}</span>
                      <span className="text-[#8993A5]">·</span>
                      <span className="text-[#8993A5]">{selectedRow.explanation}</span>
                    </div>
                    <div className="text-xs text-red-400/90 font-mono mt-1">
                      {selectedRow.downstreamFailure}
                    </div>
                  </div>
                </div>

                <button
                  onClick={onOpenWorkbench}
                  className="shrink-0 self-end sm:self-center px-3 py-1.5 text-xs font-mono text-[#F5F7FA] hover:text-white bg-[#0E1219] hover:bg-[#151B24] border border-[#1A202A] rounded transition-colors whitespace-nowrap shadow-sm"
                >
                  Inspect in Workbench →
                </button>
              </div>

            </div>

            {/* Overlapping Bottom Marker */}
            <div className="absolute -bottom-5 -left-5 hidden xl:flex items-center gap-3 px-4 py-2 bg-[#090C12] border border-[#1A202A] rounded shadow-xl text-xs font-mono text-[#8993A5]">
              <span className="text-[#3B82F6] font-bold">SIGNAL</span>
              <span className="text-[#1A202A]">|</span>
              <span>INFERRED IN 1.8ms</span>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};
