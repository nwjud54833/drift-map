import type { Metadata } from "next";
import ContractAtlasClient from "@/components/contract-atlas/contract-atlas-client";
import "./contract-atlas.css";

export const metadata: Metadata = { title: "Contract Atlas", description: "Local-first semantic contract drift workbench." };
export default function ContractAtlasPage() { return <ContractAtlasClient />; }
