import type { Metadata } from "next";
import DriftmapLanding from "@/components/landing/driftmap-landing";
import "./landing.css";

export const metadata: Metadata = {
  title: "DriftMap — Catch structural drift early",
  description: "A local-first workbench for comparing JSON payload contracts.",
};

export default function HomePage() { return <DriftmapLanding />; }
