import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileJson, ShieldAlert, FileText, Lock } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const features = [
  { icon: FileJson, title: "Contract inference from samples", text: "Paste real JSON payloads. DriftMap normalizes pointer paths, handles array wildcards like /items/*/id, and infers types and requiredness from evidence." },
  { icon: ShieldAlert, title: "Semantic drift classification", text: "Every finding is labeled breaking, warning, safe, or info with a plain-language explanation and compatibility rule — not just a text diff." },
  { icon: FileText, title: "Markdown & workspace exports", text: "Copy a report or download a workspace backup. Exports use the existing engine output without changing format." },
  { icon: Lock, title: "Local-first privacy", text: "By default everything runs in this browser via IndexedDB. No account needed. Cloud is opt-in and never silently uploads local data." },
];

const steps = [
  { number: "01", title: "Add samples", text: "Import a baseline and a candidate — JSON payload samples or an OpenAPI 3.0 document (JSON or YAML)." },
  { number: "02", title: "Infer the contract", text: "DriftMap builds a structural contract with normalized paths, type unions, and requiredness evidence." },
  { number: "03", title: "Review classified drift", text: "Filter by severity, search by path, and inspect each change with before/after values and the rule that determined its risk." },
];

function Brand() {
  return <Link href="/" className="dm-site-brand" aria-label="DriftMap home"><Image src="/logos/driftmap-icon.svg" alt="" width={28} height={28} /><span>DriftMap</span></Link>;
}

function HeroDiagram() {
  return (
    <div className="dm-preview" aria-label="How DriftMap compares two payloads and classifies drift" role="img">
      <div className="dm-preview-top">
        <div><span className="dm-preview-kicker">HOW DRIFT IS FOUND</span><strong>Order payload · v1 → v2</strong></div>
        <span className="dm-preview-direction" aria-hidden="true">v1 <ArrowRight size={12} /> v2</span>
      </div>
      <div className="dm-preview-columns" aria-hidden="true"><span>BASELINE</span><span>DRIFT</span><span>CANDIDATE</span></div>
      <div className="dm-preview-row" aria-hidden="true">
        <span className="dm-preview-value">{`{ "email": "a@b.co" }`}</span>
        <span className="dm-preview-change is-breaking"><i aria-hidden="true" />Breaking · removed</span>
        <span className="dm-preview-value is-missing">— missing</span>
        <code>/customer/email</code>
      </div>
      <div className="dm-preview-row" aria-hidden="true">
        <span className="dm-preview-value">string · required</span>
        <span className="dm-preview-change is-warning"><i aria-hidden="true" />Warning · nullable</span>
        <span className="dm-preview-value">string · nullable</span>
        <code>/customer/age</code>
      </div>
      <div className="dm-preview-row" aria-hidden="true">
        <span className="dm-preview-value is-missing">—</span>
        <span className="dm-preview-change is-safe"><i aria-hidden="true" />Safe · added optional</span>
        <span className="dm-preview-value">string · optional</span>
        <code>/customer/nickname</code>
      </div>
      <div className="dm-preview-foot"><span><Check size={13} aria-hidden="true" /> Evidence-based, not schema guarantees</span><span>2 MB import cap</span></div>
      <p style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
        Illustration shows a baseline JSON payload on the left, a candidate on the right, and a central column where each row is classified as breaking when a field is removed, warning when nullability changes, and safe when an optional field is added. Paths use JSON-pointer notation.
      </p>
    </div>
  );
}

export default function DriftmapLanding() {
  return (
    <div className="dm-site">
      <header className="dm-site-header">
        <div className="dm-site-header-inner">
          <Brand />
          <nav className="dm-site-nav" aria-label="Main navigation">
            <a href="#how-it-works">How it works</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#limitations">Limitations</a>
          </nav>
          <div className="dm-site-actions">
            <ThemeToggle />
            <Link className="dm-signin-link" href="/signin">Sign in</Link>
            <Link className="dm-button dm-button-primary dm-header-cta" href="/workbench">Open workbench <ArrowRight size={14} aria-hidden="true" /></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="dm-hero">
          <div className="dm-hero-inner">
            <div className="dm-hero-copy">
              <span className="dm-eyebrow"><span aria-hidden="true" /> API CONTRACT REVIEW</span>
              <h1>Know exactly which JSON changes will break your consumers.</h1>
              <p>DriftMap infers a structural contract from real payload samples and classifies every drift as breaking, warning, safe, or info — so you review risk, not formatting noise.</p>
              <div className="dm-hero-actions">
                <Link className="dm-button dm-button-primary" href="/workbench">Open the workbench <ArrowRight size={15} aria-hidden="true" /></Link>
                <a className="dm-button dm-button-secondary" href="https://github.com/nwjud54833/drift-map#readme" target="_blank" rel="noreferrer">Read the README</a>
              </div>
              <div className="dm-hero-notes"><span><Check size={13} aria-hidden="true" /> OpenAPI 3.0 JSON & YAML</span><span><Check size={13} aria-hidden="true" /> Local-first, cloud optional</span><span><Check size={13} aria-hidden="true" /> IndexedDB · no upload by default</span></div>
            </div>
            <HeroDiagram />
          </div>
        </section>

        <section className="dm-section dm-how" id="how-it-works">
          <div className="dm-section-heading"><span className="dm-eyebrow">HOW IT WORKS</span><h2>From samples to ranked findings in three steps.</h2><p>Add payloads, let DriftMap infer the contract, then review drift with severity, path, and rule — all in one place.</p></div>
          <div className="dm-step-grid">{steps.map((s) => <article className="dm-step-card" key={s.number}><span className="dm-step-number">{s.number}</span><h3>{s.title}</h3><p>{s.text}</p></article>)}</div>
        </section>

        <section className="dm-capabilities-section" id="capabilities">
          <div className="dm-section dm-capabilities">
            <div className="dm-section-heading"><span className="dm-eyebrow">BUILT FOR CONTRACT CHANGES</span><h2>Evidence, classification, and exports — in one review.</h2><p>Everything you need to decide if a change is safe to ship.</p></div>
            <div className="dm-capability-grid">{features.map(({ icon: Icon, title, text }) => <article className="dm-capability-card" key={title}><Icon size={18} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></article>)}</div>
          </div>
        </section>

        <section className="dm-section dm-example" id="example">
          <div className="dm-example-copy"><span className="dm-eyebrow">READ THE CHANGE, NOT JUST THE DIFF</span><h2>Every finding keeps its context.</h2><p>Open a change to inspect its JSON-pointer path, before-and-after types, supporting examples, and the compatibility rule that produced the severity. Paths wrap — never silently truncated.</p><Link className="dm-text-link" href="/workbench">Explore the workbench <ArrowRight size={14} aria-hidden="true" /></Link></div>
          <div className="dm-insight-card"><div className="dm-insight-head"><span className="dm-severity-label"><i aria-hidden="true" /> BREAKING</span><code>/customer/email</code></div><h3>Field removed from the candidate contract</h3><div className="dm-insight-values"><div><span>BASELINE</span><code>string · required</code></div><ArrowRight size={14} aria-hidden="true" /><div><span>CANDIDATE</span><code>missing</code></div></div><p>Consumers that require this field may need an update before adopting the candidate contract.</p><small>Illustrative example · inspect the actual contract for its evidence</small></div>
        </section>

        <section className="dm-section dm-limitations" id="limitations">
          <div className="dm-limit-card">
            <h3>What it doesn&apos;t do yet</h3>
            <ul>
              <li>Sample inference is <strong>evidence</strong>, not formal schema validation.</li>
              <li>Field renames appear as a removal plus an addition — fuzzy rename detection is not implemented.</li>
              <li>Payload samples are JSON; API specs support <strong>OpenAPI 3.0</strong> in JSON and YAML. OpenAPI 3.1 and Swagger 2.0 are not supported, and external <code>$ref</code> URLs are rejected.</li>
              <li>Imports are capped at <strong>2 MB</strong>.</li>
              <li>Schema comparison is deterministic heuristic guidance, not a guarantee that deployed servers conform to their specs.</li>
              <li>Collaboration and CI integration are not implemented. Local IndexedDB data is not automatically synced to cloud workspaces.</li>
            </ul>
          </div>
        </section>

        <section className="dm-team-section"><div className="dm-section dm-team-inner"><div><span className="dm-eyebrow">FOR ENGINEERING TEAMS</span><h2>Make contract changes easy to review.</h2></div><p>Use DriftMap during API version reviews and integration maintenance. Start locally; sign in only when you want saved cloud history.</p></div></section>

        <section className="dm-final-cta"><div><span className="dm-eyebrow">READY WHEN YOU ARE</span><h2>Review your next contract change with clarity.</h2><p>Open the workbench to import contracts or JSON examples and compare them. No account required for local mode.</p><Link className="dm-button dm-button-primary" href="/workbench">Open the workbench <ArrowRight size={15} aria-hidden="true" /></Link></div></section>
      </main>

      <footer className="dm-site-footer"><div className="dm-footer-inner"><div><Brand /><p>Understand contract changes before consumers do.</p></div><div className="dm-footer-links"><Link href="/workbench">Workbench</Link><a href="https://github.com/nwjud54833/drift-map/blob/main/LICENSE" target="_blank" rel="noreferrer">MIT License</a><a href="https://github.com/nwjud54833/drift-map" target="_blank" rel="noreferrer">GitHub</a></div><small>© 2026 DriftMap · Local data stays in this browser unless you switch to cloud.</small></div></footer>
    </div>
  );
}
