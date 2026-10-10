import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { driftMapFaviconHref } from "@/components/driftmap/logo";

export const metadata: Metadata = {
  title: "DriftMap — API contract intelligence",
  description: "Compare real JSON payloads, infer their structure, and catch breaking API, webhook, and structured-output drift before it ships.",
  icons: { icon: driftMapFaviconHref },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
