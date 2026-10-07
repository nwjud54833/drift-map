import React, { useState } from 'react';

interface WorkflowStep {
  step: string;
  name: string;
  sub: string;
  codeSnippet: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    step: '01',
    name: 'REAL JSON SAMPLES',
    sub: 'Ingest raw response fixtures',
    codeSnippet: 'cat test/fixtures/order_v2.json | driftmap record --tag=baseline',
    description: 'Capture actual production payloads from curl, proxy logs, Playwright fixtures, or webhook replays.'
  },
  {
    step: '02',
    name: 'INFERRED CONTRACT',
    sub: 'Generate AST lattice & path trie',
    codeSnippet: 'driftmap infer --input=baseline.json --generate-types',
    description: 'Infer precise field types, nullability boundaries, enum bounds, and array cardinality automatically.'
  },
  {
    step: '03',
    name: 'SEMANTIC DRIFT',
    sub: 'Structural differential analysis',
    codeSnippet: 'driftmap diff --baseline=baseline.json --candidate=staging.json',
    description: 'Compare syntax trees path-by-path. Discard whitespace and property order jitter; extract true contract deviations.'
  },
  {
    step: '04',
    name: 'COMPATIBILITY',
    sub: 'Semantic rule classification',
    codeSnippet: 'driftmap verify --policy=strict-backward-compat',
    description: 'Map each deviation into BREAKING, WARNING, SAFE, or INFO based on RFC merge patch semantics.'
  },
  {
    step: '05',
    name: 'ACTIONABLE REPORT',
    sub: 'GitHub PR check & exit code',
    codeSnippet: 'exit 1 # 6 breaking contract changes detected',
    description: 'Block pull requests before deployment or publish human-readable migration changelogs automatically.'
  }
];

export const WorkflowSection: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(2);
  const activeStep = WORKFLOW_STEPS[activeStepIndex];

  return (
    <section className="relative py-28 border-b border-[#1A202A] bg-[#050609]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Editorial Statement */}
        <div className="max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-[#8993A5] mb-4">
            Integration Pipeline
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.96]">
            FROM REAL SAMPLES
            <br />
            <span className="text-[#3B82F6]">TO CI VERIFICATION.</span>
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[#8993A5] font-normal leading-relaxed text-balance">
            A deterministic engineering workflow that slots into your existing GitHub Actions, test runners, or local terminal without cloud proxies.
          </p>
        </div>

        {/* ONE INTEGRATED TECHNICAL VISUAL */}
        <div className="mt-14 rounded-lg bg-[#090C12] border border-[#1A202A] overflow-hidden shadow-2xl">

          {/* Horizontal Sequential Stepper Track */}
          <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[#1A202A] bg-[#07090F] border-b border-[#1A202A]">
            {WORKFLOW_STEPS.map((item, index) => {
              const isSelected = activeStepIndex === index;
              return (
                <button
                  key={item.step}
                  onClick={() => setActiveStepIndex(index)}
                  className={`p-4 text-left transition-all duration-150 ${
                    isSelected ? 'bg-[#0E131E]' : 'hover:bg-[#0B0E15]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#8993A5]">{item.step}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[#3B82F6]' : 'bg-[#1A202A]'}`} />
                  </div>
                  <div className={`mt-2 font-mono text-xs font-bold tracking-wider ${isSelected ? 'text-white' : 'text-[#8993A5]'}`}>
                    {item.name}
                  </div>
                  <div className="mt-1 text-[11px] text-[#8993A5] font-sans truncate">
                    {item.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Workflow Interactive Stage Deep-Dive */}
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1A202A] bg-[#07090F]">

            {/* Left: Terminal Output / Command Representation */}
            <div className="lg:col-span-7 p-6 space-y-4">
              <div className="flex items-center justify-between text-xs font-mono text-[#8993A5]">
                <span>STAGE {activeStep.step} TERMINAL SIMULATION</span>
                <span className="text-[#3B82F6]">driftmap-engine v2.6</span>
              </div>

              <div className="bg-[#050609] p-4 rounded border border-[#1A202A] font-mono text-xs space-y-2">
                <div className="text-[#8993A5] flex items-center gap-2">
                  <span className="text-[#3B82F6]">$</span>
                  <span className="text-white">{activeStep.codeSnippet}</span>
                </div>

                {activeStepIndex === 0 && (
                  <div className="text-[#8993A5] pt-2 text-[11px] space-y-1">
                    <div>[INFO] Reading stream from stdin (JSON payload: 1,482 bytes)...</div>
                    <div>[INFO] Parsed 24 object nodes, 2 arrays, 38 keys.</div>
                    <div className="text-emerald-400">✔ Recorded fixture to local baseline store (~/.driftmap/store.db)</div>
                  </div>
                )}

                {activeStepIndex === 1 && (
                  <div className="text-[#8993A5] pt-2 text-[11px] space-y-1">
                    <div>[INFO] Traversing AST lattice...</div>
                    <div>[SCHEMA] /order/total_cents :: number (cardinality: required)</div>
                    <div>[SCHEMA] /order/customer/email :: string (cardinality: required)</div>
                    <div className="text-emerald-400">✔ Contract invariants synthesized in 2.1ms</div>
                  </div>
                )}

                {activeStepIndex === 2 && (
                  <div className="text-[#8993A5] pt-2 text-[11px] space-y-1">
                    <div>[DIFF] Comparing baseline (v2.4) vs candidate (v3.0)...</div>
                    <div className="text-red-400">[REMOVED] /order/total_cents</div>
                    <div className="text-red-400">[REMOVED] /order/customer/email</div>
                    <div className="text-red-400">[TYPE_MUTATED] /order/items/*/price (number → object)</div>
                    <div className="text-amber-400">[CHANGED] /order/shipping/tracking (renamed)</div>
                    <div className="text-emerald-400">[ADDED] /order/settlement_id (safe additive)</div>
                  </div>
                )}

                {activeStepIndex === 3 && (
                  <div className="text-[#8993A5] pt-2 text-[11px] space-y-1">
                    <div>[POLICY] Applying RFC 7386 Semantic Ruleset:</div>
                    <div className="text-red-400">  ✖ 6 Breaking Changes (Client crashes guaranteed)</div>
                    <div className="text-amber-400">  ⚠ 10 Warnings (Permissive parsers may tolerate)</div>
                    <div className="text-emerald-400">  ✔ 4 Safe Additions</div>
                  </div>
                )}

                {activeStepIndex === 4 && (
                  <div className="text-[#8993A5] pt-2 text-[11px] space-y-1">
                    <div className="text-red-400 font-bold">FAILED: Contract regression detected in PR #842.</div>
                    <div>GitHub Checks status updated to: FAILURE.</div>
                    <div>Summary posted to pull request discussion.</div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Architectural Explanation */}
            <div className="lg:col-span-5 p-6 bg-[#090C12] flex flex-col justify-between">
              <div>
                <div className="text-xs font-mono text-[#3B82F6] uppercase tracking-wider mb-2">
                  Step {activeStep.step} Architecture
                </div>
                <h3 className="text-lg font-bold text-white font-mono">
                  {activeStep.name}
                </h3>
                <p className="mt-3 text-xs text-[#CBD5E1] leading-relaxed font-sans">
                  {activeStep.description}
                </p>

                <div className="mt-6 pt-4 border-t border-[#1A202A] space-y-2 text-xs font-mono text-[#8993A5]">
                  <div className="flex items-center justify-between">
                    <span>Latency overhead:</span>
                    <span className="text-white">&lt; 5ms</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>CI Integration:</span>
                    <span className="text-white">GitHub Actions / GitLab / CircleCI</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>External calls:</span>
                    <span className="text-emerald-400">0 (Local Execution)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#1A202A] text-[11px] font-mono text-[#8993A5]">
                Runs natively on macOS, Linux, and Windows via standalone binary or npm CLI.
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
