import type { Metadata } from "next";
import { LandingPage } from "@/components/driftmap/landing-page";

export const metadata: Metadata = {
  title: "DriftMap — API Contract Review & Semantic Drift Engine",
  description: "Compare OpenAPI contracts and JSON payloads to understand structural API changes and compatibility risks.",
};

export default function HomePage() {
  return <LandingPage />;
}
