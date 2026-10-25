"use client";

import { LandingHero } from "./landing-hero";
import { HowItWorksSection, LandingFeatures } from "./landing-how-it-works";
import { CompareSection } from "./landing-compare";
import { LandingCta, SiteFooter } from "./landing-sections";

/**
 * Landing page composition for `/`.
 *
 * Mirrors the section order of the reference build's `#view-landing`: hero with
 * the 3D stage, how it works, the capabilities bento grid, deep inspection, the
 * engineering-scope table, the closing call to action, and the footer. The
 * sticky glass header, command palette and modals are provided once by the root
 * layout so both routes share them.
 */
export function LandingPage() {


  return (
    <main id="view-landing" className="relative z-10 flex-1">
      <LandingHero />
      <HowItWorksSection />
      <CompareSection />
      <LandingFeatures />
      <LandingCta />
      <SiteFooter />
    </main>
  );
}
