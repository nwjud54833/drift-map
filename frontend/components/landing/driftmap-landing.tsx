"use client";

import Link from "next/link";
import { DriftBackgroundSystem } from "@/components/landing/drift-background-system";
import { Navbar } from "@/components/landing/navbar";
import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { SemanticDriftSection } from "@/components/landing/semantic-drift-section";
import { ClassificationSection } from "@/components/landing/classification-section";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { LocalFirstSection } from "@/components/landing/local-first-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { CallToAction } from "@/components/landing/call-to-action";
import { Footer } from "@/components/landing/footer";
import { ScrollSequence } from "@/components/landing/scroll-sequence";

export default function DriftmapLanding() {
  const openWorkbench = () => { window.location.href = "/workbench"; };
  return <div className="driftmap-page"><DriftBackgroundSystem/><Navbar onOpenWorkbench={openWorkbench}/><main className="relative z-10"><HeroSection onOpenWorkbench={openWorkbench}/><ProblemSection/><ScrollSequence/><SemanticDriftSection/><ClassificationSection/><section id="workbench" className="driftmap-workbench-cta"><div><span className="driftmap-kicker">THE REAL WORKBENCH</span><h2>Inspect your payloads<br/><span>with the same signal.</span></h2><p>Open the local Contract Atlas workbench to import samples, compare snapshots, and export a report.</p><Link href="/workbench" className="driftmap-primary-link">Open Contract Atlas →</Link></div></section><WorkflowSection/><LocalFirstSection/><UseCasesSection/><CallToAction onOpenWorkbench={openWorkbench}/></main><Footer onOpenWorkbench={openWorkbench}/></div>;
}
