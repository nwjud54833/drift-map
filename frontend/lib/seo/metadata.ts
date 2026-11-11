import type { Metadata } from "next";

type SeoPage = {
  title: string;
  description: string;
  canonical: string;
  noIndex?: boolean;
};

function pageMetadata({ title, description, canonical, noIndex = false }: SeoPage): Metadata {
  const image = {
    url: "/brand/driftmap-social.png",
    width: 1200,
    height: 630,
    alt: "DriftMap API contract review with breaking, warning, safe, and informational findings",
  };

  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: !noIndex, follow: true },
    openGraph: {
      type: "website",
      siteName: "DriftMap",
      title,
      description,
      url: canonical,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

export const SEO_METADATA = {
  home: pageMetadata({
    title: "DriftMap API Contract Testing",
    description: "Compare JSON payloads and OpenAPI 3.0 contracts. DriftMap infers schemas, classifies compatibility changes, and supports browser review and CI.",
    canonical: "/",
  }),
  workbench: pageMetadata({
    title: "API Contract Workbench | DriftMap",
    description: "Compare JSON samples or OpenAPI 3.0 documents, inspect inferred contracts, and review breaking, warning, safe, and informational findings.",
    canonical: "/workbench",
  }),
  onboarding: pageMetadata({
    title: "Workspace Setup | DriftMap",
    description: "Set up your DriftMap workspace by sharing your company size, primary API type, and CI/CD tool.",
    canonical: "/onboarding",
    noIndex: true,
  }),
  contractAtlas: pageMetadata({
    title: "Contract Atlas | DriftMap",
    description: "Open the DriftMap contract workbench to compare JSON payload samples and OpenAPI 3.0 documents.",
    canonical: "/workbench",
    noIndex: true,
  }),
  signIn: pageMetadata({
    title: "Sign In | DriftMap",
    description: "Sign in with Google to access synced DriftMap workspaces and shared API contract baselines.",
    canonical: "/signin",
    noIndex: true,
  }),
  signUp: pageMetadata({
    title: "Create Account | DriftMap",
    description: "Create a DriftMap account to enable cloud workspace sync for API contract reviews.",
    canonical: "/signup",
    noIndex: true,
  }),
  privacy: pageMetadata({
    title: "Privacy Policy | DriftMap",
    description: "Learn how DriftMap handles browser data, Google sign-in, synced workspaces, and onboarding survey responses.",
    canonical: "/privacy",
  }),
  terms: pageMetadata({
    title: "Terms of Service | DriftMap",
    description: "Read the terms for using DriftMap API contract review and team CI services.",
    canonical: "/terms",
  }),
} satisfies Record<"home" | "workbench" | "onboarding" | "contractAtlas" | "signIn" | "signUp" | "privacy" | "terms", Metadata>;
