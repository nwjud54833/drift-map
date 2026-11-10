"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";
import { submitEarlyAccessRequest } from "@/lib/client/early-access";
import { getProCheckoutUrl } from "@/lib/client/pro-checkout";
import { DRIFTMAP_CLI_COMMAND } from "./cli-install-snippet";

/**
 * Landing page for `/` — the "Obsidian v4" design.
 *
 * Ported from the standalone static design. Everything that was scripted on the
 * original page (header state, the Workbench product mock, scroll reveal, the
 * capability collapse, the inspector tabs, both copy buttons) is React state
 * here, and every action that touches the product is wired to the real route or
 * API rather than being a decorative stub:
 *
 *   - "Open workbench" navigates to /workbench
 *   - "Sign in" navigates to /signin
 *   - the early-access form POSTs to /api/early-access
 *   - footer links Privacy and Terms to the in-app pages
 *
 * Styling lives in app/landing-v4.css, where every selector is scoped under
 * `.dm-landing` so the design's generic class names and custom properties cannot
 * affect the Workbench, auth or legal pages.
 *
 * The page keeps its own header, so the shared SiteHeader is suppressed for this
 * route in ObsidianShell.
 */

/* ------------------------------------------------------------------ data --- */

type Severity = "breaking" | "warning";
type VersionKey = "v1.0.0" | "v1.1.0" | "v2.0-rc1";

interface Finding {
  path: string;
  severity: Severity;
  severityLabel: "Breaking" | "Warning";
  sevClass: "tb" | "tw";
  /** Compact "before → after" caption shown under the path in the list pane. */
  transition: string;
  baseType: string;
  baseSample: string;
  candType: string;
  candColor: string;
  candSample: string;
  diffLine: string;
  diffBg: string;
  diffColor: string;
  rule: string;
  desc: string;
}

const FINDINGS: Finding[] = [
  {
    path: "/data/currency",
    severity: "breaking",
    severityLabel: "Breaking",
    sevClass: "tb",
    transition: "string → missing",
    baseType: "string · required",
    baseSample: 'Sample: "USD"',
    candType: "— missing",
    candColor: "var(--sev-breaking)",
    candSample: "No sample recorded",
    diffLine: '- "currency": "USD"',
    diffBg: "rgba(244,120,108,0.10)",
    diffColor: "var(--sev-breaking)",
    rule: "RULE_REQUIRED_FIELD_REMOVED",
    desc: "Present in the baseline, absent from every candidate sample. Removed fields in event payloads are classified as breaking.",
  },
  {
    path: "/data/total_cents",
    severity: "breaking",
    severityLabel: "Breaking",
    sevClass: "tb",
    transition: "number → missing",
    baseType: "number · required",
    baseSample: "Sample: 14900",
    candType: "— missing",
    candColor: "var(--sev-breaking)",
    candSample: "Replaced by /data/total/amount",
    diffLine: '- "total_cents": 14900',
    diffBg: "rgba(244,120,108,0.10)",
    diffColor: "var(--sev-breaking)",
    rule: "RULE_REQUIRED_FIELD_REMOVED",
    desc: "Flat integer cents field was removed in v2.0-rc1. Downstream billing consumers reading payload.data.total_cents will fail.",
  },
  {
    path: "/data/customer/email",
    severity: "breaking",
    severityLabel: "Breaking",
    sevClass: "tb",
    transition: "string → missing",
    baseType: "string · required",
    baseSample: 'Sample: "taylor@example.com"',
    candType: "— missing",
    candColor: "var(--sev-breaking)",
    candSample: "No sample recorded",
    diffLine: '- "email": "taylor@example.com"',
    diffBg: "rgba(244,120,108,0.10)",
    diffColor: "var(--sev-breaking)",
    rule: "RULE_REQUIRED_FIELD_REMOVED",
    desc: "Customer email was omitted from all 3 candidate samples. Notification services expecting a non-null string will throw.",
  },
  {
    path: "/data/items/*/unit_price_cents",
    severity: "breaking",
    severityLabel: "Breaking",
    sevClass: "tb",
    transition: "number → missing",
    baseType: "number · required",
    baseSample: "Sample: 4900",
    candType: "— missing",
    candColor: "var(--sev-breaking)",
    candSample: "Absent across all wildcard items",
    diffLine: '- "unit_price_cents": 4900',
    diffBg: "rgba(244,120,108,0.10)",
    diffColor: "var(--sev-breaking)",
    rule: "RULE_ARRAY_ITEM_FIELD_REMOVED",
    desc: "Wildcard array normalization detected that unit_price_cents was removed from every element inside /data/items/*.",
  },
  {
    path: "/data/total/amount",
    severity: "warning",
    severityLabel: "Warning",
    sevClass: "tw",
    transition: "absent → number",
    baseType: "— absent",
    baseSample: "Not in baseline v1",
    candType: "number · required",
    candColor: "var(--sev-warning)",
    candSample: "Sample: 149.00",
    diffLine: '+ "total": { "amount": 149.00 }',
    diffBg: "rgba(232,176,75,0.10)",
    diffColor: "var(--sev-warning)",
    rule: "RULE_NEW_NESTED_STRUCTURE",
    desc: "New nested monetary structure introduced alongside removal of /data/total_cents. Review unit shift from cents to decimal.",
  },
  {
    path: "/schema_version",
    severity: "warning",
    severityLabel: "Warning",
    sevClass: "tw",
    transition: "absent → string",
    baseType: "— absent",
    baseSample: "Not in baseline v1",
    candType: "string · required",
    candColor: "var(--sev-warning)",
    candSample: 'Sample: "2026-11-rc1"',
    diffLine: '+ "schema_version": "2026-11-rc1"',
    diffBg: "rgba(232,176,75,0.10)",
    diffColor: "var(--sev-warning)",
    rule: "RULE_TOP_LEVEL_FIELD_ADDED",
    desc: "Added top-level discriminator field. Safe for lenient JSON parsers, flagged as warning for strict schema consumers.",
  },
];

const VERSIONS: Array<{ key: VersionKey; changes: number; hash: string }> = [
  { key: "v1.0.0", changes: 0, hash: "fb0790c" },
  { key: "v1.1.0", changes: 10, hash: "8742162" },
  { key: "v2.0-rc1", changes: 6, hash: "8be931c" },
];

const VERSION_CONFIGS: Record<VersionKey, { order: number[]; all: number; breaking: number; warning: number; select: number }> = {
  "v1.0.0": { order: [5, 4, 0, 1, 2, 3], all: 10, breaking: 0, warning: 10, select: 5 },
  "v1.1.0": { order: [4, 5, 2, 0, 1, 3], all: 12, breaking: 2, warning: 10, select: 4 },
  "v2.0-rc1": { order: [0, 1, 2, 3, 4, 5], all: 16, breaking: 6, warning: 10, select: 0 },
};

const MD_SNIPPET = [
  "### DriftMap Contract Review (Order API v1 -> v2)",
  "| Severity | Path | Rule | Before -> After |",
  "| --- | --- | --- | --- |",
  "| BREAKING | /customer/email | FIELD_REMOVED | string (req) -> missing |",
  "| WARNING | /customer/age | NULLABLE_ADDED | string -> string | null |",
].join("\n");

const TRUST_ITEMS: Array<{ icon: ReactNode; label: string }> = [
  {
    icon: <path d="M5 3.5 2 8l3 4.5M11 3.5 14 8l-3 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />,
    label: "OpenAPI 3.0 in JSON and YAML",
  },
  {
    icon: (
      <>
        <circle cx="8" cy="8" r="5.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
    label: "Local-first, cloud optional",
  },
  {
    icon: (
      <>
        <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
      </>
    ),
    label: "IndexedDB storage, no upload by default",
  },
  {
    icon: (
      <>
        <rect x="2.75" y="2.75" width="10.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 6h5M5.5 9h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </>
    ),
    label: "Markdown PR summaries",
  },
];

const FLOW_STEPS: Array<{ step: string; title: string; body: string; rows: Array<[string, string]> }> = [
  {
    step: "Step 1",
    title: "Add samples",
    body: "Paste raw JSON payloads or import OpenAPI 3.0 specs in JSON or YAML, up to 2 MB. Group them into baseline and candidate sets in a local workspace.",
    rows: [
      ["baseline_orders_v1.json", "3 samples"],
      ["candidate_orders_v2.yaml", "OpenAPI 3.0"],
    ],
  },
  {
    step: "Step 2",
    title: "Infer the contract",
    body: "Every sample merges into a normalized path tree that records observed types, nullability, and whether each field was always present.",
    rows: [
      ["/customer/email", "string · req (3/3)"],
      ["/items/*/sku", "string|number · req"],
    ],
  },
];

const SEVERITY_LEGEND: Array<{ tag: "tb" | "tw" | "ts" | "ti"; label: string; note: string }> = [
  { tag: "tb", label: "breaking", note: "Field removed, type narrowed" },
  { tag: "tw", label: "warning", note: "Became nullable, required to optional" },
  { tag: "ts", label: "safe", note: "Optional field added" },
  { tag: "ti", label: "info", note: "Unchanged baseline contract" },
];

const LIMITATIONS: Array<{ title: string; body: string }> = [
  { title: "Inference, not a schema validator", body: "Rare fields missing from your samples won't appear in the inferred contract." },
  { title: "No fuzzy rename matching", body: "A renamed field appears as one removal plus one addition." },
  { title: "OpenAPI 3.0 only", body: "JSON and YAML. OpenAPI 3.1 and Swagger 2.0 are not parsed, and external $ref URLs are rejected." },
  { title: "2 MB import ceiling", body: "Per payload or specification document, to keep in-browser parsing responsive." },
  { title: "Heuristic guidance", body: "Classifications are compatibility guidance, not a guarantee of runtime safety." },
  { title: "Browser-scoped persistence", body: "Local data lives in your browser's IndexedDB unless you sign in and sync." },
];

interface SampleDetail {
  path: string;
  badgeText: string;
  badgeClass: string;
  rule: string;
  baseType: string;
  baseNote: string;
  baseObs: string;
  candType: string;
  candColor: string;
  candNote: string;
  candObs: string;
  why: string;
}

const SAMPLES: Record<"email" | "age" | "tier", SampleDetail> = {
  email: {
    path: "/customer/email",
    badgeText: "Breaking: removed",
    badgeClass: "tag tb",
    rule: "RULE_REQUIRED_FIELD_REMOVED",
    baseType: "string · required",
    baseNote: "Present in every baseline sample",
    baseObs: 'Observed: "taylor@example.com"',
    candType: "— missing from payload",
    candColor: "var(--sev-breaking)",
    candNote: "Absent from every candidate sample",
    candObs: "Observed: undefined (key omitted)",
    why: "The field was present in every baseline sample and is absent from the candidate samples. Consumers that read payload.data.customer.email without an optional check will see a missing key rather than a string.",
  },
  age: {
    path: "/customer/age",
    badgeText: "Warning: nullable",
    badgeClass: "tag tw",
    rule: "RULE_FIELD_BECAME_NULLABLE",
    baseType: "number · required",
    baseNote: "Non-null across all baseline samples",
    baseObs: "Observed: 34, 29, 41",
    candType: "number | null · required",
    candColor: "var(--sev-warning)",
    candNote: "Null observed in 1 of 3 candidate samples",
    candObs: "Observed: 34, null, 41",
    why: "The key remains present in every sample, but candidate payloads now emit null values. Typed deserializers without nullable annotations will fail at runtime.",
  },
  tier: {
    path: "/customer/loyalty_tier",
    badgeText: "Safe: optional added",
    badgeClass: "tag ts",
    rule: "RULE_OPTIONAL_FIELD_ADDED",
    baseType: "— absent in baseline",
    baseNote: "Not recorded in v1 samples",
    baseObs: "Observed: undefined",
    candType: "string · optional (2/3)",
    candColor: "var(--sev-safe)",
    candNote: "Added in candidate samples",
    candObs: 'Observed: "gold", "platinum"',
    why: "Additive fields do not break existing consumers that ignore unknown keys. Flagged as safe so reviewers can verify naming conventions.",
  },
};

const SAMPLE_TABS: Array<{ key: "email" | "age" | "tier"; label: string }> = [
  { key: "email", label: "/customer/email" },
  { key: "age", label: "/customer/age" },
  { key: "tier", label: "/customer/loyalty_tier" },
];

/* ----------------------------------------------------------------- hooks --- */

function usePrefersReducedMotion() {
  const ref = useRef(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    ref.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  return ref;
}

/** Adds the design's scroll-reveal classes, then removes them so later hover
 *  transitions on the same elements are not permanently overridden. */
function useScrollReveal(rootRef: React.RefObject<HTMLElement | null>) {
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion.current) return;
    if (!("IntersectionObserver" in window)) return;

    const targets = root.querySelectorAll<HTMLElement>(
      ".trust-strip, .sec > .eyebrow, .sec > .h2, .sec > .lead, .flow-step, .bento-grid > .card, .inspector-grid > *, .limits-panel, .g2 > .card, .cta-panel",
    );

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          observer.unobserve(el);
          el.classList.add("in");
          const delay = parseFloat(el.style.transitionDelay) || 0;
          window.setTimeout(() => {
            el.classList.remove("reveal", "in");
            el.style.transitionDelay = "";
          }, 900 + delay);
        }
      },
      { threshold: 0.1 },
    );

    targets.forEach((el) => {
      const parent = el.parentElement;
      const index = parent ? Array.prototype.indexOf.call(parent.children, el) : 0;
      el.style.transitionDelay = `${Math.min(index, 3) * 80}ms`;
      el.classList.add("reveal");
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [rootRef, reducedMotion]);
}

/** Cursor-following highlight used by `.card` and `.flow-step`. */
function useCardSpotlight(rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const bound: Array<[HTMLElement, (event: PointerEvent) => void]> = [];
    root.querySelectorAll<HTMLElement>(".card, .flow-step").forEach((el) => {
      const handler = (event: PointerEvent) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        el.style.setProperty("--my", `${event.clientY - rect.top}px`);
      };
      el.addEventListener("pointermove", handler, { passive: true });
      bound.push([el, handler]);
    });

    return () => bound.forEach(([el, handler]) => el.removeEventListener("pointermove", handler));
  }, [rootRef]);
}

function useCopyToClipboard() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback((key: string, text: string) => {
    const done = () => {
      setCopiedKey(key);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopiedKey(null), 1500);
    };

    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text).then(done).catch(done);
      return;
    }

    // Older browsers without the async clipboard API.
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand("copy");
    } catch {
      /* nothing actionable */
    }
    document.body.removeChild(area);
    done();
  }, []);

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  return { copiedKey, copy };
}

/* --------------------------------------------------------------- pieces --- */

const SECTION_LINK_CLASS = "nl";

/** Sets the Workbench center pane before navigating. Navigation itself is done
 *  by a plain `Link`, so this stays usable in a statically rendered tree. */
function useWorkbenchEntry() {
  const setCenterMode = useSpatialUIStore((state) => state.setCenterMode);
  return {
    toTable: useCallback(() => setCenterMode("table"), [setCenterMode]),
    toGraph: useCallback(() => setCenterMode("graph"), [setCenterMode]),
  };
}

function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const workbench = useWorkbenchEntry();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div id="site-header-wrap" className={`site-header-wrap${scrolled ? " scrolled" : ""}`}>
      <header className="w site-header">
        <Link href="/" className="brand-link">
          <DriftMapMark />
          <span>DriftMap</span>
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <a className={SECTION_LINK_CLASS} href="#how">How it works</a>
          <a className={SECTION_LINK_CLASS} href="#capabilities">Capabilities</a>
          <a className={SECTION_LINK_CLASS} href="#inspector">Inspector</a>
          <a className={SECTION_LINK_CLASS} href="#limits">Limitations</a>
        </nav>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Link className="btn bg btn-sm nav-signin" href="/signin">Sign in</Link>
          <Link className="btn bp btn-sm" href="/workbench" onClick={workbench.toTable}>
            <span>Open workbench</span>
            <ArrowIcon size={14} />
          </Link>
        </div>
      </header>
    </div>
  );
}

function DriftMapMark() {
  return (
    <svg width="26" height="26" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="8" fill="#0A0A0A" stroke="#9AA8FF" strokeWidth="1.5" />
      <path d="M8 10h7M8 14h12M8 18h6" stroke="#F4F2EE" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M17 18h3" stroke="#F4786C" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8h9m0 0L8.5 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Hero() {
  const { copiedKey, copy } = useCopyToClipboard();
  const workbench = useWorkbenchEntry();
  const copied = copiedKey === "cli";

  return (
    <section className="w" style={{ paddingTop: "clamp(48px,6vw,80px)", textAlign: "center" }}>
      <div className="hero-anim-1">
        <span className="hero-pill">
          <span className="hero-pill-dot" aria-hidden="true" />
          <span>Runs in your browser. Nothing uploaded by default.</span>
        </span>
        <h1 className="h1-hero">
          Know exactly which JSON changes will <em>break</em> your consumers.
        </h1>
      </div>

      <p className="lead hero-anim-2" style={{ margin: "24px auto 0", fontSize: 18, maxWidth: "58ch", textWrap: "balance" }}>
        DriftMap infers a structural contract from real payload samples and classifies every drift as breaking, warning,
        safe, or info — so you review risk, not formatting noise.
      </p>

      <div className="hero-anim-3" style={{ marginTop: 36 }}>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link className="btn bp" href="/workbench" onClick={workbench.toTable}>
            <span>Open the workbench</span>
            <ArrowIcon size={15} />
          </Link>
          <a className="btn bg" href="#team">Secure Team CI Cloud</a>
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="cli-shell">
            <div className="cli-code m">
              <span style={{ color: "var(--text-tertiary)", userSelect: "none" }}>$ </span>
              <span id="cli-command-text">{DRIFTMAP_CLI_COMMAND}</span>
            </div>
            <button
              type="button"
              className={`copy-btn${copied ? " copied" : ""}`}
              aria-label="Copy CLI command"
              onClick={() => copy("cli", DRIFTMAP_CLI_COMMAND)}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <rect x="5.25" y="5.25" width="8.25" height="8.25" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 10.5V3.5A1.5 1.5 0 0 1 4.5 2h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>
            Compare two JSON samples from your terminal. No global install.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------ product window mock --- */

type Filter = "all" | Severity;

function ProductWindow() {
  const reducedMotion = usePrefersReducedMotion();
  const [version, setVersion] = useState<VersionKey>("v2.0-rc1");
  const [filter, setFilter] = useState<Filter>("all");
  const [activeRow, setActiveRow] = useState(0);
  const [counts, setCounts] = useState({ all: 16, breaking: 6, warning: 10 });
  const [fading, setFading] = useState(false);
  const [morphing, setMorphing] = useState(false);

  const windowRef = useRef<HTMLDivElement | null>(null);
  const segControlRef = useRef<HTMLDivElement | null>(null);
  const segThumbRef = useRef<HTMLSpanElement | null>(null);
  const versionBtnRefs = useRef<Partial<Record<VersionKey, HTMLButtonElement | null>>>({});
  const timersRef = useRef<number[]>([]);
  const countsRef = useRef(counts);
  const autoplayedRef = useRef(false);

  const order = VERSION_CONFIGS[version].order;

  const stopAutoplay = useCallback(() => {
    while (timersRef.current.length) {
      const id = timersRef.current.pop();
      if (id) window.clearTimeout(id);
    }
  }, []);

  useEffect(() => () => stopAutoplay(), [stopAutoplay]);

  const selectFinding = useCallback(
    (index: number) => {
      if (reducedMotion.current) {
        setActiveRow(index);
        return;
      }
      setFading(true);
      timersRef.current.push(
        window.setTimeout(() => {
          setActiveRow(index);
          setFading(false);
        }, 150),
      );
    },
    [reducedMotion],
  );

  const animateCounts = useCallback(
    (target: { all: number; breaking: number; warning: number }) => {
      if (reducedMotion.current) {
        countsRef.current = target;
        setCounts(target);
        return;
      }
      const start = countsRef.current;
      const startTime = performance.now();
      const duration = 260;

      const tick = (now: number) => {
        const p = Math.min(1, (now - startTime) / duration);
        const next = {
          all: Math.round(start.all + (target.all - start.all) * p),
          breaking: Math.round(start.breaking + (target.breaking - start.breaking) * p),
          warning: Math.round(start.warning + (target.warning - start.warning) * p),
        };
        countsRef.current = next;
        setCounts(next);
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [reducedMotion],
  );

  const updateThumb = useCallback(() => {
    const control = segControlRef.current;
    const thumb = segThumbRef.current;
    const button = versionBtnRefs.current[version];
    if (!control || !thumb || !button) return;
    thumb.style.width = `${button.offsetWidth}px`;
    thumb.style.transform = `translateX(${button.offsetLeft - 4}px)`;
  }, [version]);

  // Measured after paint, matching the original page, which also positioned the
  // thumb from a deferred timeout. useEffect (not useLayoutEffect) keeps this
  // component safe to render on the server.
  useEffect(() => {
    updateThumb();
  }, [updateThumb]);

  useEffect(() => {
    const onResize = () => updateThumb();
    window.addEventListener("resize", onResize);
    const initial = window.setTimeout(updateThumb, 40);
    return () => {
      window.removeEventListener("resize", onResize);
      window.clearTimeout(initial);
    };
  }, [updateThumb]);

  const switchVersion = useCallback(
    (next: VersionKey) => {
      const config = VERSION_CONFIGS[next];
      setVersion(next);
      animateCounts({ all: config.all, breaking: config.breaking, warning: config.warning });

      const settle = () => {
        setMorphing(false);
        selectFinding(config.select);
      };

      if (reducedMotion.current) {
        settle();
        return;
      }
      setMorphing(true);
      timersRef.current.push(window.setTimeout(settle, 150));
    },
    [animateCounts, reducedMotion, selectFinding],
  );

  // Step through the release history once, the first time the window is seen.
  useEffect(() => {
    const el = windowRef.current;
    if (!el || reducedMotion.current) return;
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || autoplayedRef.current) continue;
          autoplayedRef.current = true;
          observer.disconnect();
          timersRef.current.push(window.setTimeout(() => switchVersion("v1.0.0"), 350));
          timersRef.current.push(window.setTimeout(() => switchVersion("v1.1.0"), 1500));
          timersRef.current.push(window.setTimeout(() => switchVersion("v2.0-rc1"), 2650));
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reducedMotion, switchVersion]);

  // Arrow / J / K navigation, active only while the window is on screen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase() ?? "";
      if (tag === "input" || tag === "textarea" || event.metaKey || event.ctrlKey || event.altKey) return;
      if (!["ArrowDown", "ArrowUp", "j", "k"].includes(event.key)) return;

      const rect = windowRef.current?.getBoundingClientRect();
      if (!rect || rect.bottom < 0 || rect.top > window.innerHeight) return;

      const visible = order.filter((index) => filter === "all" || FINDINGS[index].severity === filter);
      if (!visible.length) return;
      const position = visible.indexOf(activeRow);

      event.preventDefault();
      stopAutoplay();
      const delta = event.key === "ArrowDown" || event.key === "j" ? 1 : -1;
      selectFinding(visible[(position + delta + visible.length) % visible.length]);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [activeRow, filter, order, selectFinding, stopAutoplay]);

  const active = FINDINGS[activeRow];

  const filterChips: Array<{ key: Filter; label: string; className: string }> = [
    { key: "all", label: `All (${counts.all})`, className: "tag ti" },
    { key: "breaking", label: `${counts.breaking} breaking`, className: "tag tb" },
    { key: "warning", label: `${counts.warning} warning`, className: "tag tw" },
  ];

  return (
    <section className="w window-stage hero-anim-4">
      <div
        id="product-window"
        className="workbench-frame"
        ref={windowRef}
        onPointerDown={stopAutoplay}
        onKeyDown={stopAutoplay}
      >
        <div className="wb-chrome" aria-hidden="true">
          <span className="wb-lights"><i /><i /><i /></span>
          <span className="wb-chrome-title m">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <rect x="3.25" y="7" width="9.5" height="6.5" rx="1.75" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>driftmap.in/workbench</span>
          </span>
        </div>

        <div className="wb-topbar">
          <span className="m" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            order.shipped: v1.0.0 → {version}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} role="group" aria-label="Filter findings by severity">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className={`${chip.className} filter-chip${filter === chip.key ? " active" : ""}`}
                aria-pressed={filter === chip.key}
                onClick={() => {
                  stopAutoplay();
                  setFilter(chip.key);
                  const first = order.find((index) => chip.key === "all" || FINDINGS[index].severity === chip.key);
                  if (first !== undefined) selectFinding(first);
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div className="wb-subbar">
          <div className="seg-control" ref={segControlRef} role="tablist" aria-label="Release baseline comparison">
            <span className="seg-thumb" ref={segThumbRef} aria-hidden="true" />
            {VERSIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`tl${version === item.key ? " on" : ""}`}
                role="tab"
                aria-selected={version === item.key}
                ref={(node) => {
                  versionBtnRefs.current[item.key] = node;
                }}
                onClick={() => {
                  stopAutoplay();
                  switchVersion(item.key);
                }}
              >
                <b>{item.key}</b>{" "}
                {item.changes === 0 ? `clean baseline (${item.hash})` : `${item.changes} changes (${item.hash})`}
              </button>
            ))}
          </div>
          <span className="kbd-hint">
            <kbd aria-hidden="true">↑</kbd>
            <kbd aria-hidden="true">↓</kbd>
            <span>Arrow keys step through findings</span>
          </span>
        </div>

        <div className="wb-body">
          <div className={`wb-list-pane${morphing ? " morphing" : ""}`} aria-label="Contract drift findings">
            {order.map((index) => {
              const finding = FINDINGS[index];
              const visible = filter === "all" || finding.severity === filter;
              return (
                <div
                  key={finding.path}
                  className={`tr${activeRow === index ? " active" : ""}`}
                  data-row={index}
                  data-severity={finding.severity}
                  tabIndex={0}
                  role="button"
                  aria-label={`Inspect ${finding.path}`}
                  style={visible ? undefined : { display: "none" }}
                  onClick={() => {
                    stopAutoplay();
                    selectFinding(index);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      stopAutoplay();
                      selectFinding(index);
                    }
                  }}
                >
                  <div>
                    <div className="m" style={{ fontSize: 13, color: "var(--text-primary)" }}>{finding.path}</div>
                    <div className="m" style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {finding.transition}
                    </div>
                  </div>
                  <span className={`tag ${finding.sevClass}`}>{finding.severityLabel}</span>
                  <span className="m" style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "right" }}>3/3</span>
                </div>
              );
            })}
            <div className="wb-status-row num">
              Row {activeRow + 1} of {counts.all}, classified by compatibility rule
            </div>
          </div>

          <div className={`wb-evidence-pane${fading ? " fading" : ""}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div className="m" style={{ fontSize: 16, color: "var(--text-primary)", fontWeight: 500 }}>{active.path}</div>
              <span className={`tag ${active.sevClass}`}>{active.severityLabel}</span>
            </div>

            <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,170px),1fr))" }}>
              <div className="box">
                <div className="lb">Baseline (v1)</div>
                <div className="m" style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-primary)" }}>{active.baseType}</div>
                <div className="m" style={{ marginTop: 6, fontSize: 12, color: "var(--text-tertiary)" }}>{active.baseSample}</div>
              </div>
              <div className="box">
                <div className="lb">Candidate ({version})</div>
                <div className="m" style={{ marginTop: 8, fontSize: 13.5, color: active.candColor }}>{active.candType}</div>
                <div className="m" style={{ marginTop: 6, fontSize: 12, color: "var(--text-tertiary)" }}>{active.candSample}</div>
              </div>
            </div>

            <div
              className="m"
              style={{
                background: "var(--bg-page)",
                border: "1px solid var(--line-hairline)",
                borderRadius: "var(--r-box)",
                padding: "12px 14px",
                fontSize: 12.5,
                lineHeight: 1.9,
                color: "var(--text-tertiary)",
              }}
            >
              <div>{'  "data": {'}</div>
              <div
                className="diff-hl"
                style={{ "--diff-bg": active.diffBg, color: active.diffColor } as CSSProperties}
              >
                {active.diffLine}
              </div>
              <div>{"  }"}</div>
            </div>

            <div>
              <span className={`tag ${active.sevClass} m`} style={{ fontSize: 12 }}>{active.rule}</span>
              <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>{active.desc}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section className="w" style={{ paddingTop: 48 }}>
      <div className="trust-strip">
        {TRUST_ITEMS.map((item) => (
          <div className="trust-item" key={item.label}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">{item.icon}</svg>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeading({ index, label, title, lead }: { index: string; label: string; title: string; lead?: string }) {
  return (
    <>
      <div className="eyebrow">
        <span className="m">{index}</span>
        <i aria-hidden="true" />
        <span>{label}</span>
      </div>
      <h2 className="h2">{title}</h2>
      {lead ? <p className="lead">{lead}</p> : null}
    </>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="w sec">
      <SectionHeading
        index="01"
        label="How it works"
        title="From samples to ranked findings in three steps"
        lead="No custom DSL or manual JSON Schema authoring. Drop in raw response bodies or OpenAPI documents and let the evidence guide the review."
      />
      <div className="flow-grid">
        {FLOW_STEPS.map((step) => (
          <div className="flow-step" key={step.step}>
            <div>
              <div className="flow-node">
                <span className="flow-node-dot" aria-hidden="true" />
                <span>{step.step}</span>
              </div>
              <h3 className="h3">{step.title}</h3>
              <p className="p">{step.body}</p>
            </div>
            <div style={{ marginTop: 24 }}>
              {step.rows.map(([left, right]) => (
                <div className="fl" key={left}>
                  <span className="m">{left}</span>
                  <span className="m" style={{ color: "var(--text-tertiary)" }}>{right}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flow-step">
          <div>
            <div className="flow-node">
              <span className="flow-node-dot" aria-hidden="true" />
              <span>Step 3</span>
            </div>
            <h3 className="h3">Review classified drift</h3>
            <p className="p">Each difference is scored by compatibility rules and surfaced with before and after evidence you can filter and export.</p>
          </div>
          <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span className="tag tb">Breaking (2)</span>
            <span className="tag tw">Warning (1)</span>
            <span className="tag ts">Safe (1)</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  const { copiedKey, copy } = useCopyToClipboard();
  const [collapsed, setCollapsed] = useState(false);
  const inferRef = useRef<HTMLDivElement | null>(null);
  const copied = copiedKey === "markdown";

  useEffect(() => {
    const el = inferRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setCollapsed(true);
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="capabilities" className="w sec">
      <SectionHeading
        index="02"
        label="Capabilities"
        title="Evidence, classification, and exports in one review"
        lead="Built for backend and platform engineers reviewing payload changes before they merge."
      />

      <div className="bento-grid">
        <div className="card bento-wide">
          <h3 className="h3">Contract inference from samples</h3>
          <p className="p">Array items collapse into wildcard paths like /items/*/id, so heterogeneous elements are compared together instead of by index.</p>
          <div ref={inferRef} className={`blk m infer-stage${collapsed ? " collapsed" : ""}`}>
            <div style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>observed</div>
            <div className="infer-row infer-row-1"><span>/items/0/id</span><span style={{ color: "var(--text-secondary)" }}>&quot;sku_01&quot;</span></div>
            <div className="infer-row infer-row-2"><span>/items/1/id</span><span style={{ color: "var(--text-secondary)" }}>10492</span></div>
            <div className="infer-row infer-row-3"><span>/items/2/id</span><span style={{ color: "var(--text-secondary)" }}>null</span></div>
            <div className="infer-result">
              <div style={{ color: "var(--accent)" }}>→ /items/*/id</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>type: string | number · required · nullable</div>
            </div>
          </div>
        </div>

        <div className="card bento-narrow">
          <h3 className="h3">Semantic drift classification</h3>
          <p className="p">Breaking changes are separated from warnings, safe additions, and informational notes, so the riskiest findings rise to the top.</p>
          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {SEVERITY_LEGEND.map((item) => (
              <div key={item.label} style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span className={`tag ${item.tag}`} style={{ width: 96 }}>{item.label}</span>
                <span className="p" style={{ margin: 0 }}>{item.note}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card bento-half">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 className="h3" style={{ margin: 0 }}>Markdown and workspace exports</h3>
            <button
              type="button"
              className={`copy-btn${copied ? " copied" : ""}`}
              onClick={() => copy("markdown", MD_SNIPPET)}
            >
              {copied ? "Copied" : "Copy Markdown"}
            </button>
          </div>
          <p className="p">Copy a clean Markdown summary for pull requests or incident threads, or export the full workspace as JSON to share a review session.</p>
          <div className="blk m" style={{ fontSize: 12, lineHeight: 1.85, whiteSpace: "nowrap" }}>
            <div style={{ color: "var(--text-tertiary)" }}>### DriftMap Contract Review (Order API v1 → v2)</div>
            <div>| Severity | Path | Rule | Before → After |</div>
            <div>| BREAKING | /customer/email | FIELD_REMOVED | string (req) → missing |</div>
            <div>| WARNING | /customer/age | NULLABLE_ADDED | string → string | null |</div>
          </div>
        </div>

        <div className="card bento-half">
          <h3 className="h3">Local-first privacy</h3>
          <p className="p">Payloads stay in your browser via IndexedDB by default. Nothing is uploaded unless you sign in and explicitly sync a workspace.</p>
          <div style={{ marginTop: 28, display: "flex", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}>
            <div className="num" style={{ font: "400 84px/0.9 var(--font-instrument-serif), Georgia, serif", color: "var(--accent)" }}>0</div>
            <div className="m" style={{ fontSize: 12.5, lineHeight: 1.85, color: "var(--text-secondary)" }}>
              outbound payload calls<br />
              IndexedDB (contract-atlas)<br />
              2 MB import cap per spec
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InspectorSection() {
  const [sample, setSample] = useState<"email" | "age" | "tier">("email");
  const workbench = useWorkbenchEntry();
  const detail = SAMPLES[sample];

  return (
    <section id="inspector" className="w sec">
      <div className="inspector-grid">
        <div className="inspector-sticky">
          <SectionHeading
            index="03"
            label="Inspector"
            title="Every finding keeps its context"
            lead="Line-by-line text diffs bury the real question: will existing clients fail when they parse this response? DriftMap pairs each path with the exact rule that fired and the sample evidence behind it."
          />
          <div style={{ marginTop: 32 }}>
            <div className="li">
              <span className="dot" aria-hidden="true" />
              <span><b style={{ fontWeight: 500, color: "var(--text-primary)" }}>Filter findings by severity</b> or search by JSON-pointer path across deeply nested objects.</span>
            </div>
            <div className="li">
              <span className="dot" aria-hidden="true" />
              <span><b style={{ fontWeight: 500, color: "var(--text-primary)" }}>Inspect before and after types,</b> requiredness, and observed sample values side by side.</span>
            </div>
            <div className="li">
              <span className="dot" aria-hidden="true" />
              <span><b style={{ fontWeight: 500, color: "var(--text-primary)" }}>See the compatibility rule</b> and a plain-language explanation for every classification.</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
            <Link className="btn bp" href="/workbench" onClick={workbench.toTable}>
              <span>Try the live inspector</span>
              <ArrowIcon size={15} />
            </Link>
          </div>
        </div>

        <div className="card">
          <div
            style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, paddingBottom: 16, borderBottom: "1px solid var(--line-hairline)" }}
            role="tablist"
            aria-label="Sample inspector findings"
          >
            {SAMPLE_TABS.map((tab) => {
              const on = sample === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`tl m${on ? " on" : ""}`}
                  style={{ background: on ? "var(--bg-raised)" : "transparent" }}
                  onClick={() => setSample(tab.key)}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="m" style={{ fontSize: 16, color: "var(--text-primary)" }}>{detail.path}</span>
            <span className={detail.badgeClass}>{detail.badgeText}</span>
          </div>
          <div className="m" style={{ marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>{detail.rule}</div>

          <div style={{ display: "grid", gap: 12, marginTop: 20, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,200px),1fr))" }}>
            <div className="box">
              <div className="lb">Baseline contract (v1)</div>
              <div className="m" style={{ marginTop: 8, fontSize: 13.5, color: "var(--text-primary)" }}>{detail.baseType}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>{detail.baseNote}</div>
              <div className="m" style={{ marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>{detail.baseObs}</div>
            </div>
            <div className="box">
              <div className="lb">Candidate contract (v2)</div>
              <div className="m" style={{ marginTop: 8, fontSize: 13.5, color: detail.candColor }}>{detail.candType}</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-secondary)" }}>{detail.candNote}</div>
              <div className="m" style={{ marginTop: 8, fontSize: 12, color: "var(--text-tertiary)" }}>{detail.candObs}</div>
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <div className="lb">Why this breaks consumers</div>
            <p className="p" style={{ marginTop: 8, fontSize: 14 }}>{detail.why}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Limitations() {
  return (
    <section id="limits" className="w sec">
      <SectionHeading
        index="04"
        label="Limitations"
        title="What it doesn't do yet"
        lead="DriftMap is built for fast, honest contract triage. Know the boundaries of sample-based inference before you add it to a release checklist."
      />
      <div className="limits-panel">
        {LIMITATIONS.map((item) => (
          <div className="limit-cell" key={item.title}>
            <h3 className="h3" style={{ fontSize: 17, marginTop: 0 }}>{item.title}</h3>
            <p className="p" style={{ fontSize: 14, marginTop: 8 }}>{item.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------- team / early access --- */

export function PricingSection({ onOpenWorkbench }: { onOpenWorkbench: () => void }) {
  const checkoutUrl = getProCheckoutUrl();
  const [email, setEmail] = useState("");
  const [githubOrg, setGithubOrg] = useState("");
  const [repositoryCount, setRepositoryCount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function requestEarlyAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    const result = await submitEarlyAccessRequest({
      email,
      githubOrg,
      ...(repositoryCount ? { repositoryCount: Number(repositoryCount) } : {}),
    });
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
      setMessage("Request received. Your email is saved for Team Cloud early access.");
    } else {
      setMessage(result.message);
    }
  }

  const fieldStyle: CSSProperties = {
    width: "100%",
    height: 48,
    background: "var(--bg-page)",
    border: "1px solid var(--line-strong)",
    borderRadius: "var(--r-chip)",
    padding: "0 14px",
    color: "var(--text-primary)",
    font: "400 15px var(--font-geist), sans-serif",
  };

  return (
    <section id="team" className="w sec">
      <SectionHeading
        index="05"
        label="For teams"
        title="Start local. Add shared baselines when your team needs them."
        lead="Review API changes locally today, then bring private schema gating and shared baselines into your team CI workflow. Team CI Cloud is in early access."
      />

      <div className="g2" style={{ marginTop: 48 }}>
        <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <h3 className="h3">Local review</h3>
            <p className="p">Review payload changes in your browser with files you provide.</p>
            <div style={{ marginTop: 16 }}>
              <div className="li"><span className="dot" aria-hidden="true" /><span>Unlimited local comparisons in your browser, saved to IndexedDB</span></div>
              <div className="li"><span className="dot" aria-hidden="true" /><span>Inspect baseline and candidate contracts in your browser</span></div>
              <div className="li"><span className="dot" aria-hidden="true" /><span>Export review findings for your team workflows</span></div>
            </div>
          </div>
          <div style={{ marginTop: 32 }}>
            <Link className="btn bg" href="/workbench" onClick={onOpenWorkbench}>Open the workbench</Link>
          </div>
        </div>

        <div className="card featured-rim">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span className="tag ti">Early access</span>
          </div>
          <h3 className="h3">For teams</h3>
          <p className="p">Shared contract history for teams that want CI to find the baseline automatically.</p>
          <div style={{ marginTop: 16 }}>
            <div className="li"><span className="dot" aria-hidden="true" /><span>Shared baseline tracked from the default branch</span></div>
            <div className="li"><span className="dot" aria-hidden="true" /><span>Automatic pull request comparisons across branches</span></div>
            <div className="li"><span className="dot" aria-hidden="true" /><span>Team review history for contract changes</span></div>
          </div>
          <p className="p" style={{ marginTop: 16 }}>
            Cloud comparison limits per UTC month: Free 50, Pro 1,000, Team 5,000. Local browser diffs are unlimited and do not use cloud runs.
          </p>

          {checkoutUrl ? (
            <a className="btn bp" style={{ marginTop: 24 }} href={checkoutUrl} target="_blank" rel="noopener noreferrer">
              Upgrade to Team CI Cloud <span aria-hidden="true">↗</span>
            </a>
          ) : null}

          {!submitted ? (
            <form
              aria-label="Request Team Cloud early access"
              onSubmit={requestEarlyAccess}
              style={{ marginTop: 28, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}
              noValidate
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <label htmlFor="early-access-email" className="lb" style={{ display: "block", marginBottom: 8 }}>Email address</label>
                <input
                  id="early-access-email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  maxLength={254}
                  placeholder="you@company.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label htmlFor="early-access-org" className="lb" style={{ display: "block", marginBottom: 8 }}>
                  GitHub org <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
                </label>
                <input
                  id="early-access-org"
                  type="text"
                  name="githubOrg"
                  maxLength={39}
                  placeholder="acme"
                  value={githubOrg}
                  onChange={(event) => setGithubOrg(event.target.value)}
                  style={fieldStyle}
                />
              </div>
              <div style={{ flex: 1, minWidth: 160 }}>
                <label htmlFor="early-access-repos" className="lb" style={{ display: "block", marginBottom: 8 }}>
                  Repositories <span style={{ color: "var(--text-tertiary)" }}>(optional)</span>
                </label>
                <input
                  id="early-access-repos"
                  type="number"
                  name="repositoryCount"
                  min={1}
                  max={100000}
                  step={1}
                  placeholder="12"
                  value={repositoryCount}
                  onChange={(event) => setRepositoryCount(event.target.value)}
                  style={fieldStyle}
                />
              </div>
              <button type="submit" className="btn bp" disabled={submitting}>
                {submitting ? "Sending..." : "Request Early Access"}
              </button>
            </form>
          ) : null}

          {message ? (
            <p role="status" aria-live="polite" style={{ marginTop: 12, fontSize: 13.5, color: submitted ? "var(--sev-safe)" : "var(--sev-warning)" }}>
              {message}
            </p>
          ) : null}

          <p style={{ margin: "14px 0 0", fontSize: 13, lineHeight: 1.5, color: "var(--text-tertiary)" }}>
            Team baseline tracking is planned; pricing and availability have not been announced.{" "}
            <Link href="/signin" style={{ color: "var(--accent)" }}>Sign in for Cloud Workspace Sync</Link>
          </p>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-tertiary)" }}>This page does not list a price.</p>
        </div>
      </div>
    </section>
  );
}

function ClosingCta() {
  const workbench = useWorkbenchEntry();

  return (
    <section className="w sec">
      <div className="cta-panel">
        <h2 className="h2" style={{ fontSize: "clamp(40px,5.6vw,68px)", maxWidth: "18ch", margin: "0 auto" }}>
          Check your next payload change before it ships.
        </h2>
        <p className="lead" style={{ margin: "20px auto 0" }}>
          No account required. Paste two samples and see the inferred contract diff in seconds.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginTop: 32 }}>
          <Link className="btn bp" href="/workbench" onClick={workbench.toTable}>
            <span>Open the workbench</span>
            <ArrowIcon size={15} />
          </Link>
          <Link className="btn bg" href="/signin">Sign in to sync workspaces</Link>
        </div>
      </div>
    </section>
  );
}

/** Strips the user-agent button chrome so footer actions sit flush with the
 *  links beside them, while keeping the design's `.nl` colour and size. */
const FOOTER_BUTTON_STYLE: CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  fontFamily: "inherit",
};

export function SiteFooter({ onOpenWorkbench, onLaunchGraph }: {
  onOpenWorkbench: () => void;
  onLaunchGraph: () => void;
}) {
  const openCommandPalette = useSpatialUIStore((state) => state.openCommandPalette);
  const openModal = useSpatialUIStore((state) => state.openModal);

  return (
    <footer className="w" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 20, paddingTop: 48, paddingBottom: 48, marginTop: 96, borderTop: "1px solid var(--line-hairline)" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 15, color: "var(--text-primary)" }}>
          <DriftMapMark />
          <span>DriftMap</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: "var(--text-tertiary)" }}>Private schema gating for team CI</div>
      </div>
      <nav style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }} aria-label="Footer">
        <Link className={SECTION_LINK_CLASS} href="/">Landing</Link>
        <button type="button" className={SECTION_LINK_CLASS} style={FOOTER_BUTTON_STYLE} onClick={onOpenWorkbench}>Workbench</button>
        <button type="button" className={SECTION_LINK_CLASS} style={FOOTER_BUTTON_STYLE} onClick={onLaunchGraph}>3D force graph</button>
        <button type="button" className={SECTION_LINK_CLASS} style={FOOTER_BUTTON_STYLE} onClick={openCommandPalette}>Command (⌘K)</button>
        <button type="button" className={SECTION_LINK_CLASS} style={FOOTER_BUTTON_STYLE} onClick={() => openModal("tokens")}>Design tokens</button>
        <Link className={SECTION_LINK_CLASS} href="/privacy">Privacy</Link>
        <Link className={SECTION_LINK_CLASS} href="/terms">Terms</Link>
      </nav>
    </footer>
  );
}

/* ----------------------------------------------------------------- page --- */

export function LandingV4({ faq }: { faq?: ReactNode } = {}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const setCenterMode = useSpatialUIStore((state) => state.setCenterMode);

  useScrollReveal(rootRef);
  useCardSpotlight(rootRef);

  // The footer exposes plain buttons rather than links, so it needs the
  // navigation to happen in the handler.
  const openWorkbench = useCallback(() => {
    setCenterMode("table");
    window.location.assign("/workbench");
  }, [setCenterMode]);
  const launchGraph = useCallback(() => {
    setCenterMode("graph");
    window.location.assign("/workbench?view=graph");
  }, [setCenterMode]);

  return (
    <div className="dm-landing" ref={rootRef}>
      <div className="hero-grid" aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />

      <div className="page-shell">
        <SiteHeader />
        <Hero />
        <ProductWindow />
        <TrustStrip />
        <HowItWorks />
        <Capabilities />
        <InspectorSection />
        <Limitations />
        <PricingSection onOpenWorkbench={openWorkbench} />
        {faq}
        <ClosingCta />
        <SiteFooter onOpenWorkbench={openWorkbench} onLaunchGraph={launchGraph} />
      </div>
    </div>
  );
}

export default LandingV4;
