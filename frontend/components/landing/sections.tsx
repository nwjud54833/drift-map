import { ArrowRight, Braces, Check, Fingerprint, GitCompareArrows, LockKeyhole, Shield, SlidersHorizontal, Workflow } from "lucide-react";
import Link from "next/link";
import { Reveal } from "./reveal";
import { Logo, SectionHead } from "./ui";

const channels = ["APIs", "WEBHOOKS", "AUTOMATIONS", "AI OUTPUTS", "DATA PIPELINES"];
const features = [
  { icon: GitCompareArrows, title: "Structural, not textual", text: "Compare normalized paths, inferred types, and field presence—not indentation or key order." },
  { icon: SlidersHorizontal, title: "Risk with context", text: "Response, request, and event modes apply explicit compatibility rules to each change." },
  { icon: Fingerprint, title: "Deterministic by design", text: "The same samples produce the same contract fingerprint and comparable findings." },
  { icon: LockKeyhole, title: "Your data stays yours", text: "Payloads are analyzed and persisted in your browser. No upload, account, or API key." },
];

export function Integrations() {
  return <section className="integration-strip"><div className="section-container integration-inner"><p>BUILT FOR THE MESSY REALITY OF MODERN INTEGRATIONS</p><div>{channels.map((channel, index) => <span key={channel}><i>{["⌘", "↗", "⤳", "{}", "⌁"][index]}</i>{channel}</span>)}</div></div></section>;
}

export function ProductPrinciples() {
  return <section id="why" className="principles-section"><div className="section-container"><Reveal><SectionHead overline="WHY CONTRACT ATLAS" title={<>Line diffs tell you what moved.<br/>Contract Atlas tells you what matters.</>}><span>Semantic signal from real payload evidence—without pretending samples are a formal schema.</span></SectionHead></Reveal><div className="principle-grid">{features.map(({ icon: Icon, title, text }, index) => <Reveal key={title} delay={index % 3}><article className="principle-card"><div className="principle-icon"><Icon size={17}/><span>0{index + 1}</span></div><h3>{title}</h3><p>{text}</p></article></Reveal>)}</div></div></section>;
}

export function LocalFirst() {
  return <section className="local-section" id="developers"><div className="section-container local-grid"><Reveal><div><p className="section-overline">LOCAL-FIRST, BY DEFAULT</p><h2>Contract intelligence.<br/><span>Without the upload.</span></h2><p className="section-copy">Inspect sensitive webhook payloads and API responses without sending them to a service. The workbench runs in your browser and stores workspaces in local IndexedDB.</p><a className="text-link" href="/workbench">Open the local workbench <ArrowRight size={15}/></a></div></Reveal><Reveal delay={1}><div className="privacy-panel"><div className="privacy-panel-head"><Shield size={16}/><span>DATA BOUNDARY</span><span className="privacy-state"><i/> ON DEVICE</span></div><div className="privacy-flow"><div><Braces size={16}/><strong>JSON samples</strong><small>Imported locally</small></div><span className="flow-arrow">→</span><div><Workflow size={16}/><strong>Contract engine</strong><small>Deterministic TypeScript</small></div><span className="flow-arrow">→</span><div><Check size={16}/><strong>Drift report</strong><small>Stored in IndexedDB</small></div></div><div className="privacy-foot"><LockKeyhole size={13}/> No application network calls for contract analysis</div></div></Reveal></div></section>;
}

export function Footer() {
  return <footer className="site-footer"><div className="section-container"><div className="footer-main"><Link href="/" aria-label="Contract Atlas home"><Logo/></Link><p>Local-first contract intelligence for real-world payloads.</p><a className="footer-cta" href="/workbench">Open Workbench <ArrowRight size={14}/></a></div><div className="footer-bottom"><span>© 2026 Contract Atlas · Built for careful integrations</span><span>Runs locally in your browser. Your payloads stay on your device.</span></div></div></footer>;
}
