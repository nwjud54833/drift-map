import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "DriftMap — API contract intelligence",
  description: "Compare real JSON payloads, infer their structure, and catch breaking API, webhook, and structured-output drift before it ships.",
  icons: { icon: "/logos/driftmap-icon.svg" },
};

// A per-request CSP nonce requires dynamic rendering so Next.js can attach it
// to its inline bootstrap scripts instead of serving nonce-less prerendered HTML.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
