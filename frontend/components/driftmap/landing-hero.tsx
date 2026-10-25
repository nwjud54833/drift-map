"use client";

import { useRouter } from "next/navigation";

export function LandingHero() {
  const router = useRouter();
  return (
    <section id="hero-section" className="relative overflow-hidden border-b border-white/[0.07]">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(56,189,248,0.10),transparent_55%)]" />
      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.08] text-white">Know if your API changes will break your app.</h1>
          <p className="mt-6 text-base sm:text-lg text-[#A5A6B0] leading-relaxed max-w-2xl mx-auto">Compare API responses, find breaking changes, and understand what needs fixing before you ship.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
            <button type="button" onClick={() => router.push("/workbench?sample=1")} className="btn-geist-primary min-h-12 px-6 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2">Try it with a sample <span aria-hidden="true">→</span></button>
            <button type="button" onClick={() => router.push("/workbench")} className="btn-geist-secondary min-h-12 px-6 rounded-xl text-sm inline-flex items-center justify-center">Open workbench</button>
          </div>
          <ul className="mt-9 flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm text-[#B7B8C0]">
            {["Find breaking changes", "Understand what changed", "Fix compatibility issues before deployment"].map((benefit) => <li key={benefit} className="inline-flex items-center gap-2"><span className="text-emerald-400" aria-hidden="true">✓</span>{benefit}</li>)}
          </ul>
        </div>
      </div>
    </section>
  );
}
