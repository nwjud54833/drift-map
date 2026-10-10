import React from 'react';

interface CallToActionProps {
  onOpenWorkbench: () => void;
}

export const CallToAction: React.FC<CallToActionProps> = ({ onOpenWorkbench }) => {
  return (
    <section className="relative py-32 border-b border-[#1A202A] bg-[#050609] overflow-hidden">
      {/* Background subtle grid and depth light */}
      <div className="absolute inset-0 bg-grid-subtle opacity-40 pointer-events-none" />
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/[0.045] blur-[160px] pointer-events-none rounded-full"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
        <div className="text-xs font-mono uppercase tracking-widest text-[#3B82F6] mb-6">
          Zero-Regret Deployments
        </div>

        <h2 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-[-0.04em] text-[#F5F7FA] leading-[0.92]">
          STOP FINDING OUT
          <br />
          <span className="text-[#8993A5]">IN PRODUCTION.</span>
        </h2>

        <p className="mt-8 text-lg sm:text-xl text-[#8993A5] max-w-xl mx-auto font-normal leading-relaxed text-balance">
          See contract drift before your integration does.
        </p>

        {/* Action Buttons */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onOpenWorkbench}
            className="group relative inline-flex items-center gap-2 px-8 py-4 text-xs font-mono font-semibold uppercase tracking-wider text-white bg-[#3B82F6] hover:bg-[#2563EB] rounded-[4px] shadow-[0_0_32px_rgba(59,130,246,0.3)] transition-all duration-200"
          >
            <span>Open DriftMap</span>
            <span className="text-sm group-hover:translate-x-1 transition-transform duration-150">→</span>
          </button>

          <a
            href="https://github.com/nwjud54833/drift-map"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-7 py-4 text-xs font-mono font-medium uppercase tracking-wider text-[#F5F7FA] hover:text-white bg-[#090C12] hover:bg-[#0E1219] border border-[#1A202A] hover:border-[#28303F] rounded-[4px] transition-colors"
          >
            <span>GitHub</span>
            <span className="text-xs text-[#8993A5]">↗</span>
          </a>
        </div>

        <div className="mt-12 text-xs font-mono text-[#8993A5]">
          curl -sSL https://driftmap.dev/install.sh | sh
        </div>
      </div>
    </section>
  );
};
