import type { Metadata } from "next";
import DriftmapLanding from "@/components/landing/driftmap-landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "DriftMap — Catch breaking API changes before production",
  description: "Compare OpenAPI contracts and JSON payloads to understand structural API changes and compatibility risks.",
};

export default function HomePage() { return <DriftmapLanding />; }
