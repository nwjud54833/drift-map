const STEPS = [
  { number: "01", title: "Add your API responses", body: "Paste JSON into the baseline and new-version editors, or import an OpenAPI document." },
  { number: "02", title: "Compare versions", body: "DriftMap checks the responses and automatically highlights what changed." },
  { number: "03", title: "Understand the impact", body: "See which changes may break clients, which are risky, and which are safe." },
] as const;

export function HowItWorksSection() {
  return <section id="how-it-works" className="py-16 md:py-24 border-b border-white/[0.07]"><div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="max-w-2xl mb-10"><p className="text-xs font-medium uppercase tracking-[0.14em] text-[#858691] mb-3">How it works</p><h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">A clear answer in three steps</h2></div><div className="grid md:grid-cols-3 gap-4">{STEPS.map((step) => <article key={step.number} className="rounded-2xl border border-white/[0.08] bg-[#09090C] p-5 sm:p-6"><span className="inline-grid place-items-center w-9 h-9 rounded-lg border border-sky-400/20 bg-sky-400/[0.08] font-mono text-xs text-sky-300">{step.number}</span><h3 className="mt-5 text-base font-semibold text-white">{step.title}</h3><p className="mt-2 text-sm text-[#A5A6B0] leading-relaxed">{step.body}</p></article>)}</div></div></section>;
}

export function LandingFeatures() {
  const features = [
    { title: "Catch breaking changes", body: "Find removed fields and other changes that can affect existing clients.", color: "text-rose-300" },
    { title: "See what changed", body: "Review the old and new values side by side, with evidence from your samples.", color: "text-sky-300" },
    { title: "Get practical guidance", body: "Understand why a change matters and what to check before release.", color: "text-amber-300" },
    { title: "Keep control of your data", body: "Compare locally in your browser. Sign in only if you want cloud sync.", color: "text-emerald-300" },
  ];
  return <section id="features" className="py-16 md:py-24 border-b border-white/[0.07]"><div className="max-w-6xl mx-auto px-4 sm:px-6"><div className="max-w-2xl mb-10"><p className="text-xs font-medium uppercase tracking-[0.14em] text-[#858691] mb-3">Made for safer releases</p><h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Know what deserves your attention</h2></div><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{features.map((feature) => <article key={feature.title} className="rounded-2xl border border-white/[0.08] bg-[#09090C] p-5"><span className={`text-sm font-semibold ${feature.color}`}>{feature.title}</span><p className="mt-3 text-sm text-[#A5A6B0] leading-relaxed">{feature.body}</p></article>)}</div></div></section>;
}
