"use client";

import { useEffect, useRef, useState } from "react";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ScrollSequence() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const update = () => {
      const rect = root.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      setProgress(reduced ? 1 : clamp(-rect.top / Math.max(distance, 1)));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const stage = progress < 0.22 ? 0 : progress < 0.42 ? 1 : progress < 0.6 ? 2 : progress < 0.82 ? 3 : 4;
  const labels = ["JSON", "STRUCTURE", "CONTRACT", "DRIFT", "WORKBENCH"];

  return (
    <section ref={rootRef} className="dm-sequence" aria-label="JSON to drift transformation">
      <div className="dm-sequence-sticky">
        <div className="dm-sequence-copy">
          <span className="dm-sequence-kicker">LIVE STRUCTURE</span>
          <h2>One field tells the whole story.</h2>
          <p>A real payload path resolves into a contract node, then becomes a compatibility verdict.</p>
          <div className="dm-sequence-steps" aria-label="Transformation stages">
            {labels.map((label, index) => <span key={label} className={index <= stage ? "is-active" : ""}>{label}</span>)}
          </div>
        </div>
        <div className="dm-sequence-stage" data-stage={stage} aria-live="polite">
          <div className="dm-json-pane">
            <span className="dm-pane-label">INPUT SAMPLE</span>
            <pre>{'{\n  "data": {\n    "total_cents": 12900,\n    "customer": {\n      "email": "taylor@example.com"\n    }\n  }\n}'}</pre>
          </div>
          <div className="dm-field-lane">
            <span className="dm-node">/data</span>
            <span className="dm-edge" />
            <span className="dm-node">/customer</span>
            <span className="dm-edge" />
            <span className={`dm-node ${stage >= 3 ? "is-breaking" : ""}`}>/email</span>
            <span className={`dm-node dm-node-total ${stage >= 3 ? "is-mutated" : ""}`}>{stage >= 3 ? "/total/amount" : "/total_cents"}</span>
          </div>
          <div className="dm-contract-card">
            <span className="dm-pane-label">INFERRED CONTRACT</span>
            <strong>/data/customer/email</strong>
            <span>string · required · 3/3 samples</span>
            <strong>/data/total_cents</strong>
            <span>{stage >= 3 ? "number → object { amount, currency }" : "number · required"}</span>
          </div>
          <div className={`dm-verdict ${stage >= 3 ? "is-visible" : ""}`}>
            <span>BREAKING</span>
            <strong>client accessor undefined</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
