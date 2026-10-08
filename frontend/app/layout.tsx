import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Contract Atlas — Catch contract drift before it breaks your integration",
  description: "Compare real JSON payloads, infer their structure, and see semantic API, webhook, and structured-output drift locally.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
