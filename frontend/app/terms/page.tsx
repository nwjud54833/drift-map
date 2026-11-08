import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · DriftMap",
  description: "Terms for using DriftMap API contract review and team CI services.",
};

const sections = [
  { title: "Using DriftMap", body: "DriftMap provides tools for reviewing API contracts and schema changes. You may use the service only in compliance with applicable law and these terms. You are responsible for your account activity and for ensuring that you have the rights needed to submit any content you choose to process or store." },
  { title: "Your content", body: "You retain your rights in the API specifications, payload samples, and other content you provide. You authorize DriftMap to process that content only as needed to provide the features you choose, including workspace sync when you enable it. Do not submit secrets, credentials, or personal information unless the feature and your permissions allow it." },
  { title: "Accounts and security", body: "Keep your sign-in credentials and connected account secure. You are responsible for managing access to your account and workspace. Notify DriftMap through the support channel provided with your account or service communications if you believe your account has been accessed without authorization." },
  { title: "Acceptable use", body: "Do not misuse, disrupt, or attempt to gain unauthorized access to DriftMap, its infrastructure, or another user's workspace. Do not use the service to violate another party's rights or applicable law." },
  { title: "Service changes", body: "Features, including early-access features, may change as DriftMap is developed. We may suspend access when reasonably necessary to protect the service, its users, or its infrastructure, or to comply with law." },
  { title: "Third-party services", body: "Some features rely on services operated by third parties, such as identity providers and cloud infrastructure. Your use of those services may also be subject to their terms and privacy notices." },
  { title: "Contact", body: "For questions about these terms, use the support channel provided with your DriftMap account or service communications." },
];

export default function TermsPage() {
  return (
    <main className="relative z-10 flex-1 bg-[#08090d] px-5 py-16 text-[#f0eee8] sm:px-8 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="font-mono text-xs text-[#a78bfa] transition hover:text-white">← DriftMap home</Link>
        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8a8b98]">Legal · Terms</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-4 text-sm leading-6 text-[#a6a5b1]">Last updated: November 9, 2026</p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#c1c1ca]">These terms describe the basic rules for using DriftMap&apos;s API contract review and team CI services.</p>
        </header>
        <div className="divide-y divide-white/[0.08]">
          {sections.map((section) => (
            <section className="py-8" key={section.title}>
              <h2 className="text-xl font-semibold">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">{section.body}</p>
            </section>
          ))}
        </div>
        <nav aria-label="Legal pages" className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-6 text-xs font-mono text-[#8a8b98]">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <Link href="/privacy" className="transition hover:text-white">Privacy Policy</Link>
        </nav>
      </article>
    </main>
  );
}
