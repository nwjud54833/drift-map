import React from 'react';

interface FooterProps {
  onOpenWorkbench: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenWorkbench }) => {
  return (
    <footer className="w-full bg-[#050609] border-t border-[#1A202A] py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-8 pb-10 border-b border-[#1A202A]/80">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold tracking-wide text-[#F5F7FA]">
              <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-[#3B82F6] text-[11px] font-bold text-white shadow-[0_0_12px_rgba(59,130,246,0.45)]">
                Δ
              </span>
              <span className="font-mono text-[14px] font-bold tracking-tight text-white">
                DRIFTMAP
              </span>
            </div>
            <p className="mt-3 text-sm text-[#8993A5] max-w-md font-sans">
              Map the changes that could break your integration.
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono text-[#8993A5]">
            <button
              onClick={onOpenWorkbench}
              className="hover:text-white transition-colors"
            >
              Workbench
            </button>
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors"
            >
              Documentation
            </a>
            <a
              href="https://github.com/nwjud54833/drift-map"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              GitHub <span>↗</span>
            </a>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono text-[#8993A5]">
          <div>
            © {new Date().getFullYear()} DriftMap. All rights reserved. Zero external telemetry.
          </div>
          <div>
            RFC 7386 JSON Merge Patch Compliant · In-Memory WASM
          </div>
        </div>
      </div>
    </footer>
  );
};
