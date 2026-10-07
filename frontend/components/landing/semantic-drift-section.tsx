import React, { useState } from 'react';

interface AstNode {
  path: string;
  type: 'string' | 'number' | 'object' | 'array';
  nullable: boolean;
  cardinality: string;
  driftState: 'stable' | 'removed' | 'type_drift' | 'new';
  transformationNote: string;
}

const SAMPLE_AST_NODES: AstNode[] = [
  {
    path: '/data/order_id',
    type: 'string',
    nullable: false,
    cardinality: '1:1',
    driftState: 'stable',
    transformationNote: 'Scalar identity invariant. Regex matches ^ord_[0-9]+$.'
  },
  {
    path: '/data/customer/email',
    type: 'string',
    nullable: true,
    cardinality: '0..1',
    driftState: 'removed',
    transformationNote: 'Structural node missing from candidate payload stream.'
  },
  {
    path: '/data/items/*/sku',
    type: 'string',
    nullable: false,
    cardinality: '1..N',
    driftState: 'stable',
    transformationNote: 'Array member element preserved across all items in sample.'
  },
  {
    path: '/data/items/*/price',
    type: 'number',
    nullable: false,
    cardinality: '1..N',
    driftState: 'type_drift',
    transformationNote: 'Scalar number morphed into compound object node in candidate.'
  }
];

export const SemanticDriftSection: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(3); // 0: JSON, 1: STRUCTURE, 2: CONTRACT, 3: DRIFT
  const [selectedNode, setSelectedNode] = useState<AstNode>(SAMPLE_AST_NODES[3]);

  const pipelineStages = [
    { id: 0, label: 'JSON', desc: 'Raw payload stream ingest' },
    { id: 1, label: 'STRUCTURE', desc: 'Path trie & AST tokenization' },
    { id: 2, label: 'CONTRACT', desc: 'Type inference & invariants' },
    { id: 3, label: 'DRIFT', desc: 'Compatibility & risk verdict' }
  ];

  return (
    <section id="semantic-drift" className="relative py-28 border-b border-[#1A202A] bg-[#07090E]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Editorial Statement */}
        <div className="max-w-3xl">
          <div className="text-xs font-mono uppercase tracking-widest text-[#3B82F6] mb-4">
            Structural Intelligence Layer
          </div>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.96]">
            NOT A TEXT DIFF.
            <br />
            <span className="text-[#3B82F6]">A CONTRACT SIGNAL.</span>
          </h2>
          <p className="mt-6 text-base sm:text-lg text-[#8993A5] font-normal leading-relaxed text-balance">
            DriftMap parses payload samples into structural syntax trees. It derives schemas, infers field optionality and array types, and flags breaking shifts in runtime expectations.
          </p>
        </div>

        {/* Pipeline Transformation Stage Navigator */}
        <div className="mt-14 relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pipelineStages.map((stage) => {
              const isActive = activeStep === stage.id;
              return (
                <button
                  key={stage.id}
                  onClick={() => setActiveStep(stage.id)}
                  className={`text-left p-4 rounded bg-[#090C12] border transition-all duration-150 ${
                    isActive
                      ? 'border-[#3B82F6] bg-[#0E131E] shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                      : 'border-[#1A202A] hover:border-[#28303F]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#8993A5]">0{stage.id + 1}</span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#3B82F6]' : 'bg-[#1A202A]'}`} />
                  </div>
                  <div className="mt-2 font-mono text-xs font-bold tracking-wider text-white">
                    {stage.label}
                  </div>
                  <div className="mt-1 text-[11px] text-[#8993A5] font-sans">
                    {stage.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Technical AST & Contract Invariants Visualization */}
        <div className="mt-8 rounded-lg bg-[#090C12] border border-[#1A202A] overflow-hidden shadow-2xl">

          <div className="px-6 py-4 bg-[#0E1219] border-b border-[#1A202A] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                AST CONTRACT INVARIANT TRIE
              </span>
              <span className="text-[#1A202A] font-mono text-xs">|</span>
              <span className="text-xs font-mono text-[#8993A5]">Deterministic Type Lattice</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="px-2.5 py-0.5 rounded bg-[#07090F] text-[#8993A5] border border-[#1A202A]">
                Stage: {pipelineStages[activeStep].label}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-[#1A202A]">

            {/* Left: Path Trie & Inferred Types */}
            <div className="lg:col-span-7 p-6 space-y-3 bg-[#07090F]">
              <div className="text-[11px] font-mono text-[#8993A5] uppercase tracking-wider mb-2">
                Inferred Contract Paths &amp; Types
              </div>

              {SAMPLE_AST_NODES.map((node) => {
                const isSelected = selectedNode.path === node.path;
                return (
                  <div
                    key={node.path}
                    onClick={() => setSelectedNode(node)}
                    className={`p-3.5 rounded cursor-pointer font-mono text-xs transition-all duration-150 border ${
                      isSelected
                        ? 'bg-[#0E131E] border-[#3B82F6]'
                        : 'bg-[#090C12] border-[#1A202A] hover:border-[#28303F]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[#3B82F6]">▸</span>
                        <span className="text-white font-medium">{node.path}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-[#121824] text-[#93C5FD] border border-[#1E293B] text-[11px]">
                          {node.type}
                        </span>

                        {node.driftState === 'removed' && (
                          <span className="text-red-400 text-[11px] font-semibold">✕ REMOVED</span>
                        )}
                        {node.driftState === 'type_drift' && (
                          <span className="text-red-400 text-[11px] font-semibold">⚠ DRIFT</span>
                        )}
                        {node.driftState === 'stable' && (
                          <span className="text-emerald-400 text-[11px]">✓ INVARIANT</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 pt-3 border-t border-[#1A202A] flex items-center justify-between text-[11px] font-mono text-[#8993A5]">
                <span>Root Type: object</span>
                <span>Inferred Invariants: 100% deterministic</span>
              </div>
            </div>

            {/* Right: Contract Signal Inspector */}
            <div className="lg:col-span-5 p-6 bg-[#090C12] flex flex-col justify-between">
              <div>
                <div className="text-[11px] font-mono text-[#8993A5] uppercase tracking-wider mb-4">
                  Contract Node Specification
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-[#8993A5]">Normalized Path</div>
                    <div className="text-sm font-mono text-white mt-0.5 font-semibold">
                      {selectedNode.path}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-[#8993A5]">Inferred Type</div>
                      <div className="text-xs font-mono text-[#93C5FD] mt-0.5">
                        {selectedNode.type}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#8993A5]">Cardinality</div>
                      <div className="text-xs font-mono text-white mt-0.5">
                        {selectedNode.cardinality}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[#8993A5]">Drift Assessment</div>
                    <div className="mt-1 text-xs font-mono text-white bg-[#07090F] p-3 rounded border border-[#1A202A]">
                      {selectedNode.transformationNote}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[#8993A5]">TypeScript Type Signature</div>
                    <pre className="mt-1 text-[11px] font-mono text-[#34D399] bg-[#050609] p-3 rounded border border-[#1A202A] overflow-x-auto">
{selectedNode.path.includes('items')
  ? `type ItemPrice = ${selectedNode.type === 'number' ? 'number' : '{ currency: string; amount: number }'};`
  : `type FieldType = ${selectedNode.type}${selectedNode.nullable ? ' | null' : ''};`}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[#1A202A] flex items-center gap-2 text-xs font-mono text-[#3B82F6]">
                <span>Contract status:</span>
                <span className="text-white font-semibold">
                  {selectedNode.driftState === 'stable' ? 'Zero Drift' : 'Breaking Deviation Detected'}
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>
    </section>
  );
};
