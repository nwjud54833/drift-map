import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contract Atlas — local-first contract drift workbench",
  description:
    "Turn real JSON payload samples into an inferred contract and highlight semantic API, webhook, and structured output drift. Fully local: nothing leaves your browser.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
