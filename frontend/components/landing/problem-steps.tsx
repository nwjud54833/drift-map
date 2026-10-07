import { ScanSearch, UploadCloud, Waypoints } from "lucide-react";
import { Reveal } from "./reveal";
import { SectionHead, SeverityChip } from "./ui";

const beforeLines = [
  '   "total_cents": 12900,',
  '-  "currency": "USD",',
  '+  "total": {',
  '+    "amount": 129,',
  '+    "currency": "USD"',
  '+  },',
  '-  "email": "taylor@example.com",',
  '   "shipping": {',
  '-    "tracking_number": "1Z99…"',
  '+    "tracking": "1Z99…"',
  '   }',
];

const afterRows = [
  { severity: "breaking" as const, label: "REMOVED", path: "/data/total_cents", note: "number → missing" },
  { severity: "breaking" as const, label: "REMOVED", path: "/data/customer/email", note: "string → missing" },
  { severity: "breaking" as const, label: "REMOVED", path: "/data/shipping/tracking_number", note: "rename appears as remove + add" },
  { severity: "warning" as const, label: "NEW REQUIRED", path: "/schema_version", note: "present in every sample" },
];

export function Problem() {
  return <section className="problem-section" id="problem"><div className="section-container"><Reveal><SectionHead overline="WHY A CONTRACT VIEW" title={<>Your API changed.<br/>Your integration found out later.</>}><span>An upstream payload changed. A line diff shows edits, but not which structural assumptions are likely to break.</span></SectionHead></Reveal><div className="problem-grid"><Reveal delay={1}><article className="diff-card"><header><span>RAW DIFF</span><span>Values obscure structure</span></header><pre>{beforeLines.map((line, index) => <span key={index} className={line.startsWith("-") ? "diff-remove" : line.startsWith("+") ? "diff-add" : ""}>{line}{"\n"}</span>)}</pre><footer>What changed is visible. What matters is not.</footer></article></Reveal><Reveal delay={2}><article className="semantic-card"><header><span>CONTRACT ATLAS</span><span>Structural changes, classified</span></header><div className="semantic-rows">{afterRows.map((row) => <div key={row.path}><SeverityChip severity={row.severity} label={row.label}/><code>{row.path}</code><small>{row.note}</small></div>)}</div><footer>Signal with context. No fuzzy rename guesses.</footer></article></Reveal></div></div></section>;
}

const steps = [
  { number: "01", title: "Import", body: "Paste or choose real JSON payload samples. One object or an array of object samples.", icon: UploadCloud },
  { number: "02", title: "Infer", body: "Build a structural view of paths, observed types, examples, and sample-based requiredness.", icon: Waypoints },
  { number: "03", title: "Compare", body: "Review additions, removals, type changes, and requiredness with direction-aware severity.", icon: ScanSearch },
];
export function HowItWorks() {
  return <section className="how-section" id="how-it-works"><div className="section-container"><Reveal><SectionHead overline="HOW IT WORKS" title="From payload samples to useful signal."><span>No formal schema to maintain. Deterministic inference and a clear comparison you can inspect.</span></SectionHead></Reveal><div className="steps-grid">{steps.map(({ number, title, body, icon: Icon }, index) => <Reveal key={number} delay={index}><article className="step-card"><div><Icon size={17}/><span>{number}</span></div><h3>{title}</h3><p>{body}</p></article></Reveal>)}</div><p className="flowline">REAL JSON SAMPLES <i>→</i> INFERRED CONTRACT <i>→</i> SEMANTIC DRIFT <i>→</i> COMPATIBILITY</p></div></section>;
}
