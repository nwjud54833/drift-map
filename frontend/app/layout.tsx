import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./tokens.css";
import "./globals.css";
import "./primitives.css";
import "./landing.css";
import "./workbench.css";
import { Providers } from "./providers";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ObsidianShell } from "@/components/driftmap/obsidian-shell";

// next/font self-hosts these files at build time: no external request, no
// font-swap layout shift, and no change to the CSP font-src directive.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

/**
 * Pre-paint theme resolution. Runs in the document head before the first paint
 * so an explicitly chosen theme never flashes the wrong colours. It only adds
 * the attribute; the CSS default (system) applies when nothing is stored. Every
 * step is guarded because localStorage throws in some privacy modes.
 *
 * `class="dark"` stays on <html> unconditionally — the Obsidian surface is the
 * product's visual identity, and it is what makes `dark:` variants and the
 * `.dark` Tailwind strategy resolve. `data-theme` still selects which *token
 * set* the legacy light/dark stylesheets use.
 */
const themeInitScript = `(function(){try{var k="driftmap.theme";var v=localStorage.getItem(k);if(v==="light"||v==="dark"){document.documentElement.setAttribute("data-theme",v);}else if(v==="system"){document.documentElement.removeAttribute("data-theme");}}catch(e){}})();`;

export const metadata: Metadata = {
  title: "DriftMap — API Contract Review & Semantic Drift Engine",
  description: "Import OpenAPI contracts and compare API changes to catch breaking drift before it reaches production.",
  icons: {
    icon: [
      { url: "/logos/driftmap-icon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

// A per-request CSP nonce requires dynamic rendering so Next.js can attach it
// to its inline bootstrap scripts instead of serving nonce-less prerendered HTML.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark scroll-smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${jetbrainsMono.variable} obsidian-surface min-h-screen flex flex-col selection:bg-white/20 selection:text-white`}>
        <ThemeProvider>
          <Providers>
            <ObsidianShell>{children}</ObsidianShell>
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
