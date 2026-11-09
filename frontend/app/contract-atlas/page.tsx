import { redirect } from "next/navigation";
import { SEO_METADATA } from "@/lib/seo/metadata";

export const metadata = SEO_METADATA.contractAtlas;

export default function LegacyContractAtlasRoute() {
  redirect("/workbench");
}
