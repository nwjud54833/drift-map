import type { Metadata } from "next";
import { LandingPage } from "@/components/driftmap/landing-page";

export const metadata: Metadata = {
  title: "DriftMap — API Contract Review & Semantic Drift Engine",
  description: "Review API contract changes with private schema gating built for secure team CI.",
};

export default function HomePage() {
  return <LandingPage />;
}
