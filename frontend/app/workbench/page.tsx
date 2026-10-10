import type { Metadata } from "next";
import ContractAtlasClient from "@/components/contract-atlas/contract-atlas-client";
import "../contract-atlas.css";

export const metadata: Metadata = {
  title: "Workbench · DriftMap",
  description: "Compare real JSON payloads, infer their contracts, and inspect semantic drift with a clear summary of breaking changes.",
};

export default function WorkbenchPage() {
  return <ContractAtlasClient />;
}
