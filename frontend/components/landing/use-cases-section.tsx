import React, { useState } from 'react';

interface UseCaseScene {
  id: string;
  category: string;
  title: string;
  scenario: string;
  baselineSnippet: string;
  candidateSnippet: string;
  detectedDrift: {
    path: string;
    type: 'BREAKING' | 'WARNING';
    message: string;
  };
}

const USE_CASE_SCENES: UseCaseScene[] = [
  {
    id: 'api-responses',
    category: 'API RESPONSES',
    title: 'Silent Upstream API Schema Drift',
    scenario: 'Third-party SaaS updates minor API versions without warning, altering return schemas.',
    baselineSnippet: '{\n  "status": "success",\n  "credits_remaining": 450,\n  "account_tier": "pro"\n}',
    candidateSnippet: '{\n  "status": "success",\n  "credits": { "remaining": 450 },\n  "account_tier": "pro"\n}',
    detectedDrift: {
      path: '/credits_remaining',
      type: 'BREAKING',
      message: 'Field dropped; restructured to /credits/remaining. Usage gate evaluates to undefined.'
    }
  },
  {
    id: 'webhooks',
    category: 'WEBHOOKS',
    title: 'Payment & Partner Webhook Mutations',
    scenario: 'Payment gateways periodically deprecate top-level metadata or omit customer emails on failed charges.',
    baselineSnippet: '{\n  "event": "charge.failed",\n  "customer_email": "jane@corp.com",\n  "reason": "insufficient_funds"\n}',
    candidateSnippet: '{\n  "event": "charge.failed",\n  "customer_id": "cus_99182",\n  "reason": "insufficient_funds"\n}',
    detectedDrift: {
      path: '/customer_email',
      type: 'BREAKING',
      message: 'Customer email omitted from failure webhook payload. Dunning email pipeline halts.'
    }
  },
  {
    id: 'llm-outputs',
    category: 'LLM OUTPUTS',
    title: 'Model Update Hallucination & Type Shifting',
    scenario: 'Foundation model updates cause structured JSON outputs to mutate array formats into comma strings.',
    baselineSnippet: '{\n  "tags": ["security", "audit", "rbac"],\n  "score": 0.94\n}',
    candidateSnippet: '{\n  "tags": "security, audit, rbac",\n  "score": "0.94"\n}',
    detectedDrift: {
      path: '/tags',
      type: 'BREAKING',
      message: 'Array<string> collapsed into comma-separated scalar string. tags.includes() crashes.'
    }
  },
  {
    id: 'internal-services',
    category: 'INTERNAL SERVICES',
    title: 'Microservice RPC & Gateway Mismatches',
    scenario: 'Another service team changes property naming from snake_case to camelCase without updating gateway.',
    baselineSnippet: '{\n  "warehouse_id": "wh_09",\n  "stock_count": 82\n}',
    candidateSnippet: '{\n  "warehouseId": "wh_09",\n  "stockCount": 82\n}',
    detectedDrift: {
      path: '/warehouse_id',
      type: 'BREAKING',
      message: 'Naming convention drift: warehouse_id missing; replaced by warehouseId.'
    }
  }
];

export const UseCasesSection: React.FC = () => {
  const [activeSceneId, setActiveSceneId] = useState<string>('api-responses');
  const activeScene = USE_CASE_SCENES.find(s => s.id === activeSceneId) || USE_CASE_SCENES[0];

  return (
    <section id="use-cases" className="relative py-28 border-b border-[#1A202A] bg-[#050609]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Editorial Section Statement */}
        <div className="max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-[#8993A5] mb-4">
            Production Scenarios
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.96]">
            FOUR DRIFT SCENARIOS.
            <br />
            <span className="text-[#3B82F6]">ONE INVARIANT ENGINE.</span>
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[#8993A5] font-normal leading-relaxed text-balance">
            Real payload examples where subtle JSON deviations slip past standard integration tests and how DriftMap detects them instantly.
          </p>
        </div>

        {/* Scenario Tabs (Clean text segmented control, no pills) */}
        <div className="mt-12 flex items-center gap-1 overflow-x-auto pb-2 border-b border-[#1A202A]">
          {USE_CASE_SCENES.map((scene) => {
            const isActive = activeSceneId === scene.id;
            return (
              <button
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                className={`px-4 py-2.5 text-xs font-mono whitespace-nowrap transition-colors border-b-2 -mb-[2px] ${
                  isActive
                    ? 'border-[#3B82F6] text-white font-bold bg-[#090D15]'
                    : 'border-transparent text-[#8993A5] hover:text-white'
                }`}
              >
                {scene.category}
              </button>
            );
          })}
        </div>

        {/* Deep Real Scene Visual Display */}
        <div className="mt-8 rounded-lg bg-[#090C12] border border-[#1A202A] overflow-hidden shadow-2xl">

          <div className="px-6 py-4 bg-[#07090F] border-b border-[#1A202A] flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono text-[#3B82F6] uppercase tracking-wider">
                {activeScene.category}
              </span>
              <h3 className="text-base font-bold text-white font-mono mt-0.5">
                {activeScene.title}
              </h3>
            </div>

            <span className="text-xs font-mono text-[#8993A5]">
              Real Payload Fixture
            </span>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-[#07090F]">

            {/* Left: Real Payload Code Snippets (Baseline vs Candidate) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                {/* Baseline Payload */}
                <div className="rounded bg-[#050609] border border-[#1A202A] p-4">
                  <div className="text-[11px] font-mono text-[#8993A5] uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Baseline Sample</span>
                    <span className="text-emerald-400">EXPECTED</span>
                  </div>
                  <pre className="text-xs font-mono text-[#CBD5E1] overflow-x-auto leading-relaxed">
                    {activeScene.baselineSnippet}
                  </pre>
                </div>

                {/* Candidate Payload */}
                <div className="rounded bg-[#050609] border border-[#1A202A] p-4">
                  <div className="text-[11px] font-mono text-[#8993A5] uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span>Candidate Sample</span>
                    <span className="text-red-400">RECEIVED</span>
                  </div>
                  <pre className="text-xs font-mono text-red-300/90 overflow-x-auto leading-relaxed">
                    {activeScene.candidateSnippet}
                  </pre>
                </div>

              </div>

              {/* Detected Drift Verdict Box */}
              <div className="p-4 rounded bg-[#0A0D15] border border-red-900/40">
                <div className="flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                    <span className="text-white font-bold">{activeScene.detectedDrift.path}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/40 text-red-400 border border-red-900/40">
                    {activeScene.detectedDrift.type}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[#CBD5E1] font-sans">
                  {activeScene.detectedDrift.message}
                </p>
              </div>
            </div>

            {/* Right: Technical Breakdown */}
            <div className="lg:col-span-5 space-y-5">
              <div>
                <div className="text-xs font-mono text-[#8993A5] uppercase tracking-wider">
                  Scenario Details
                </div>
                <p className="mt-2 text-sm text-[#F5F7FA] leading-relaxed font-sans">
                  {activeScene.scenario}
                </p>
              </div>

              <div className="text-xs font-mono text-[#8993A5] flex items-center gap-3 pt-4 border-t border-[#1A202A]">
                <span className="text-emerald-400">✔</span>
                <span>Automated regression check in 1.4ms</span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
