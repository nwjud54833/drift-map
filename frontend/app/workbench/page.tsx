import type { Metadata } from "next";
import ContractAtlasClient from "@/components/contract-atlas/contract-atlas-client";
import "../contract-atlas.css";

export const metadata: Metadata = {
  title: "Workbench · Contract Atlas",
  description: "Compare real JSON payloads and inspect semantic contract drift locally.",
};

export default function WorkbenchPage() {
  return <ContractAtlasClient />;
}
