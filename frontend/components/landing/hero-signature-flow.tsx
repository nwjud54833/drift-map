import React from 'react';

export const HeroSignatureFlow: React.FC = () => {
  return (
    <div
      className="absolute -inset-4 sm:-inset-8 pointer-events-none -z-10 overflow-hidden opacity-60 hidden lg:block"
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        viewBox="0 0 800 500"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Subtle gradient for baseline vectors */}
          <linearGradient id="grad-stable" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.1" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#10B981" stopOpacity="0.3" />
          </linearGradient>

          <linearGradient id="grad-breaking" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
            <stop offset="40%" stopColor="#EF4444" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#EF4444" stopOpacity="0.0" />
          </linearGradient>

          <linearGradient id="grad-warning" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#F59E0B" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* 1. /order/id (Invariant: Baseline -> Candidate) */}
        <g className="opacity-75">
          <path
            d="M 40 100 L 260 100 L 520 100 L 740 100"
            stroke="url(#grad-stable)"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="animate-drift-flow"
          />
          <circle cx="40" cy="100" r="2.5" fill="#3B82F6" fillOpacity="0.6" />
          <circle cx="740" cy="100" r="2.5" fill="#10B981" fillOpacity="0.6" />
          <text x="50" y="93" fill="#8993A5" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fillOpacity="0.5">
            /order/id
          </text>
        </g>

        {/* 2. /total_cents (Breaking: Removed from root -> Restructured) */}
        <g className="opacity-80">
          <path
            d="M 40 180 L 320 180"
            stroke="url(#grad-breaking)"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="animate-drift-flow"
          />
          {/* Breaking X mark */}
          <path d="M 316 176 L 324 184" stroke="#EF4444" strokeWidth="1.2" strokeOpacity="0.6" />
          <path d="M 324 176 L 316 184" stroke="#EF4444" strokeWidth="1.2" strokeOpacity="0.6" />

          {/* Diverted drift vector toward /total/amount */}
          <path
            d="M 320 180 C 400 200, 480 250, 740 260"
            stroke="#EF4444"
            strokeWidth="0.8"
            strokeDasharray="2 4"
            strokeOpacity="0.25"
          />
          <circle cx="40" cy="180" r="2.5" fill="#3B82F6" fillOpacity="0.6" />
          <text x="50" y="173" fill="#EF4444" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fillOpacity="0.6">
            /total_cents [dropped]
          </text>
          <text x="335" y="183" fill="#EF4444" fontSize="7.5" fontFamily="JetBrains Mono, monospace" fillOpacity="0.5">
            ✕ BREAKING DRIFT
          </text>
        </g>

        {/* 3. /shipping/tracking (Warning: Renamed to /shipping/tracking_number) */}
        <g className="opacity-80">
          <path
            d="M 40 280 L 280 280 C 380 280, 440 330, 740 330"
            stroke="url(#grad-warning)"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="animate-drift-flow"
          />
          <circle cx="40" cy="280" r="2.5" fill="#3B82F6" fillOpacity="0.6" />
          <circle cx="740" cy="330" r="2.5" fill="#F59E0B" fillOpacity="0.6" />
          <text x="50" y="273" fill="#F59E0B" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fillOpacity="0.55">
            /shipping/tracking → /tracking_number
          </text>
        </g>

        {/* 4. /items/[index]/price (Breaking: number to object) */}
        <g className="opacity-80">
          <path
            d="M 40 380 L 260 380 C 380 380, 420 420, 740 430"
            stroke="url(#grad-breaking)"
            strokeWidth="1"
            strokeDasharray="4 4"
            className="animate-drift-flow"
          />
          <circle cx="40" cy="380" r="2.5" fill="#3B82F6" fillOpacity="0.6" />
          <circle cx="740" cy="430" r="2.5" fill="#EF4444" fillOpacity="0.6" />
          <text x="50" y="373" fill="#8993A5" fontSize="8.5" fontFamily="JetBrains Mono, monospace" fillOpacity="0.5">
            /items/*/price : number → &#123; currency, amount &#125;
          </text>
        </g>
      </svg>
    </div>
  );
};
