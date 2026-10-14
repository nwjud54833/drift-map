import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, FileJson, FileText, Lock, ShieldAlert } from "lucide-react";
import { Severity } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme/theme-toggle";

const GITHUB_URL = "https://github.com/nwjud54833/drift-map";

const features = [
  {
    icon: FileJson,
    title: "Contract inference from samples",
    text: "Paste real JSON payloads. DriftMap normalises JSON-pointer paths, handles array wildcards such as /items/*/id, and infers type unions and requiredness from the evidence in the samples.",
  },
  {
    icon: ShieldAlert,
    title: "Semantic drift classification",
    text: "Every finding is labelled breaking, warning, safe, or info with a plain-language explanation and the compatibility rule that produced it — not just a line diff.",
  },
  {
    icon: FileText,
    title: "Markdown and workspace exports",
    text: "Copy or download a Markdown drift report, and export the full workspace as JSON. Exports use the engine's existing output without reformatting it.",
  },
  {
    icon: Lock,
    title: "Local-first privacy",
    text: "By default everything runs in this browser and payloads are stored in IndexedDB. No account is needed, and switching to cloud never silently uploads local data.",
  },
];

const steps = [
  { number: "01", title: "Add samples", text: "Import a baseline and a candidate — JSON payload samples, or an OpenAPI 3.0 document in JSON or YAML." },
  { number: "02", title: "Infer the contract", text: "DriftMap builds a structural contract with normalised paths, type unions and requiredness evidence, and a stable fingerprint." },
  { number: "03", title: "Review classified drift", text: "Filter by severity, search by path, and inspect each change with its before and after evidence and the rule that set its risk." },
];

const limitations = [
  <>Sample inference is <strong>evidence</strong>, not formal schema validation.</>,
  <>Field renames appear as a removal plus an addition — <strong>fuzzy rename detection is not implemented</strong>.</>,
  <>Payload samples are JSON. API specifications support <strong>OpenAPI 3.0</strong> in JSON and YAML; OpenAPI 3.1 and Swagger 2.0 are not supported, and external <code>$ref</code> URLs are rejected.</>,
  <>Imports are capped at <strong>2 MB</strong>.</>,
  <>Schema comparison is deterministic heuristic guidance, not a guarantee that deployed servers conform to their specifications.</>,
  <>Collaboration and CI integration are not implemented, and local IndexedDB data is <strong>not automatically synchronised</strong> with cloud workspaces.</>,
];

function Brand() {
  return (
    <Link href="/" className="dm-site-brand" aria-label="DriftMap home">
      <Image src="/logos/driftmap-icon.svg" alt="" width={26} height={26} priority />
      <span>DriftMap</span>
    </Link>
  );
}

/**
 * Hero visual: two payloads either side of a classified diff column, built from
 * HTML and CSS so it costs no image bytes and no layout shift.
 *
 * The panel carries a real accessible description. The individual syntax-
 * coloured fragments are decorative duplicates of that description, so they are
 * hidden from assistive technology.
 */
function HeroDiagram() {
  return (
    <div className="dm-diagram">
      <div className="dm-diagram-top">
        <div>
          <span className="dm-diagram-label">HOW DRIFT IS FOUND</span>
          <strong>order.shipped · v1 → v2</strong>
        </div>
        <span className="dm-diagram-label" aria-hidden="true">baseline → candidate</span>
      </div>

      <div className="dm-diagram-cols">
        <div className="dm-diagram-col">
          <span className="dm-diagram-heading">Baseline sample</span>
          <pre aria-hidden="true">{`{
  "order_id": `}<span className="dm-string">&quot;ORD-1001&quot;</span>{`,
  "status": `}<span className="dm-string">&quot;shipped&quot;</span>{`,
  "total_cents": `}<span className="dm-num">12900</span>{`,
  "customer": {
    "email": `}<span className="dm-gone">&quot;t@b.co&quot;</span>{`
  }
}`}</pre>
        </div>

        <div className="dm-diagram-diff">
          <span>Classified drift</span>
          <div className="dm-diagram-finding is-breaking">
            <Severity severity="breaking" />
            <code>/customer/email</code>
            <small>Field removed — the candidate has no such property in any sample.</small>
          </div>
          <div className="dm-diagram-finding is-warning">
            <Severity severity="warning" />
            <code>/schema_version</code>
            <small>Field added and required in every candidate sample.</small>
          </div>
          <div className="dm-diagram-finding is-safe">
            <Severity severity="safe" />
            <code>/fulfillment</code>
            <small>Optional object added — existing consumers are unaffected.</small>
          </div>
        </div>

        <div className="dm-diagram-col">
          <span className="dm-diagram-heading">Candidate sample</span>
          <pre aria-hidden="true">{`{
  "order_id": `}<span className="dm-string">&quot;ORD-1001&quot;</span>{`,
  "status": `}<span className="dm-string">&quot;shipped&quot;</span>{`,
  "schema_version": `}<span className="dm-string">&quot;2026-10&quot;</span>{`,
  "total": {
    "amount": `}<span className="dm-num">129</span>{`
  },
  "customer": { `}<span className="dm-key">{"/* id only */"}</span>{` }
}`}</pre>
        </div>
      </div>

      <div className="dm-diagram-foot">
        <span><Check size={13} aria-hidden="true" /> Evidence-based findings, not schema guarantees</span>
        <span>2 MB import cap</span>
      </div>

      <p className="sr-only">
        The baseline payload on the left contains a required customer email address. The candidate payload on the right drops it
        and adds a required schema_version field plus an optional fulfillment object. The central column classifies each
        structural difference: removing the email is breaking, adding the required schema_version is a warning, and adding the
        optional object is safe. Paths are shown in JSON-pointer notation.
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
          <nav className="dm-site-nav" aria-label="Page sections">
            <a href="#how-it-works">How it works</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#limitations">Limitations</a>
          </nav>
          <div className="dm-site-actions">
            <ThemeToggle />
            <Link className="dm-text-link" href="/signin">Sign in</Link>
            <Link className="ui-btn ui-btn-sm ui-btn-gradient" href="/workbench">
              Open the workbench <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------- Hero ---------- */}
        <section className="dm-hero" aria-labelledby="hero-heading">
          <div className="dm-hero-inner">
            <div className="dm-hero-copy">
              <span className="dm-eyebrow">JSON contract review</span>
              <h1 id="hero-heading">Know exactly which JSON changes will break your consumers.</h1>
              <p>
                DriftMap infers a structural contract from real payload samples and classifies every difference as breaking,
                warning, safe, or info — so you review risk instead of formatting noise.
              </p>
              <div className="dm-hero-actions">
                <Link className="ui-btn ui-btn-lg ui-btn-primary" href="/workbench">
                  Open the workbench <ArrowRight size={15} aria-hidden="true" />
                </Link>
                <a className="ui-btn ui-btn-lg ui-btn-quiet" href={GITHUB_URL} target="_blank" rel="noreferrer">
                  <FileText size={15} aria-hidden="true" /> Read the README
                </a>
              </div>
              <div className="dm-hero-notes">
                <span><Check size={13} aria-hidden="true" /> OpenAPI 3.0 JSON &amp; YAML</span>
                <span><Check size={13} aria-hidden="true" /> Local-first, cloud optional</span>
                <span><Check size={13} aria-hidden="true" /> IndexedDB · no upload by default</span>
              </div>
            </div>
            <HeroDiagram />
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section className="dm-section dm-section-bordered" id="how-it-works" aria-labelledby="how-heading">
          <div className="dm-section-heading">
            <span className="dm-eyebrow">How it works</span>
            <h2 id="how-heading">From samples to ranked findings in three steps.</h2>
            <p>Add payloads, let DriftMap infer the contract, then review drift by severity, path, and the rule behind it.</p>
          </div>
          <div className="dm-step-grid">
            {steps.map((step) => (
              <article className="dm-step" key={step.number}>
                <span className="dm-step-number" aria-hidden="true">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Feature grid ---------- */}
        <section className="dm-section dm-section-bordered" id="capabilities" aria-labelledby="capabilities-heading">
          <div className="dm-section-heading">
            <span className="dm-eyebrow">Capabilities</span>
            <h2 id="capabilities-heading">Evidence, classification, and exports in one review.</h2>
            <p>Everything needed to decide whether a contract change is safe to ship.</p>
          </div>
          <div className="dm-feature-grid">
            {features.map(({ icon: Icon, title, text }) => (
              <article className="dm-feature" key={title}>
                <span className="dm-feature-icon" aria-hidden="true"><Icon size={17} /></span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- Limitations ---------- */}
        <section className="dm-section dm-section-bordered" id="limitations" aria-labelledby="limitations-heading">
          <div className="dm-limitations">
            <span className="dm-eyebrow">Scope</span>
            <h2 id="limitations-heading">What it doesn&apos;t do yet</h2>
            <p>
              Being explicit about the edges of the tool matters more than claiming coverage it does not have. Each point below
              is a real constraint of the current engine and API surface.
            </p>
            <ul>
              {limitations.map((item, index) => <li key={index}>{item}</li>)}
            </ul>
          </div>
        </section>

        {/* ---------- Closing CTA ---------- */}
        <section className="dm-final" aria-labelledby="final-heading">
          <div className="dm-final-inner">
            <div>
              <span className="dm-eyebrow">Ready when you are</span>
              <h2 id="final-heading">Review your next contract change with clarity.</h2>
              <p>Import two payloads or two specifications and compare them. No account is required for local mode.</p>
            </div>
            <Link className="ui-btn ui-btn-lg ui-btn-primary" href="/workbench">
              Open the workbench <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="dm-site-footer">
        <div className="dm-footer-inner">
          <div>
            <Brand />
            <p>Understand contract changes before your consumers do.</p>
          </div>
          <nav className="dm-footer-links" aria-label="Footer">
            <Link href="/workbench">Workbench</Link>
            <a href="/signin">Sign in</a>
            <a href={`${GITHUB_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT License</a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">GitHub</a>
          </nav>
          <small className="dm-footer-legal">
            © 2026 DriftMap · Released under the MIT License · Local data stays in this browser unless you explicitly switch to cloud.
          </small>
        </div>
      </footer>
    </div>
  );
}
