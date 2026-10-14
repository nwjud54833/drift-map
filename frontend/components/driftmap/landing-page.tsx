"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSpatialUIStore } from "@/stores/spatial-ui-store";
import { toast } from "@/components/ui/toast";
import { LandingHero } from "./landing-hero";
import { HowItWorksSection } from "./landing-how-it-works";
import { CapabilitiesSection } from "./landing-capabilities";
import { LandingCta, DeepInspectionSection, LimitationsSection, SiteFooter } from "./landing-sections";

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
  const router = useRouter();
  const setCenterMode = useSpatialUIStore((state) => state.setCenterMode);

  const openWorkbench = useCallback(() => {
    setCenterMode("table");
    router.push("/workbench");
  }, [router, setCenterMode]);

  const launchGraph = useCallback(() => {
    setCenterMode("graph");
    router.push("/workbench?view=graph");
  }, [router, setCenterMode]);

  const copySampleMarkdown = useCallback(() => {
    const sample = [
      "### DriftMap Contract Review (Order API v1 → v2)",
      "| Severity | Path | Rule | Before → After |",
      "| :--- | :--- | :--- | :--- |",
      "| 🔴 **BREAKING** | `/customer/email` | `RULE_REQUIRED_FIELD_REMOVED` | `string (req)` → `missing` |",
      "| 🟡 **WARNING** | `/customer/age` | `RULE_FIELD_BECAME_NULLABLE` | `string` → `string \\| null` |",
    ].join("\n");
    void navigator.clipboard
      .writeText(sample)
      .then(() => toast.success("PR Markdown snippet copied"))
      .catch(() => toast.error("Clipboard permission is unavailable in this browser. Select the text and copy it manually."));
  }, []);

  return (
    <main id="view-landing" className="relative z-10 flex-1">
      <LandingHero />
      <HowItWorksSection />
      <CapabilitiesSection onLaunchGraph={launchGraph} onCopySampleMarkdown={copySampleMarkdown} />
      <DeepInspectionSection onOpenWorkbench={openWorkbench} onLaunchGraph={launchGraph} />
      <LimitationsSection />
      <LandingCta onOpenWorkbench={openWorkbench} />
      <SiteFooter onOpenWorkbench={openWorkbench} onLaunchGraph={launchGraph} />
    </main>
  );
}
