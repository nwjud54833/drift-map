import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · DriftMap",
  description: "How DriftMap handles browser data, Google sign-in, synced workspaces, and onboarding survey responses.",
};

export default function PrivacyPage() {
  return (
    <main className="relative z-10 flex-1 bg-[#08090d] px-5 py-16 text-[#f0eee8] sm:px-8 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <Link href="/" className="font-mono text-xs text-[#a78bfa] transition hover:text-white">← DriftMap home</Link>
        <header className="mt-8 border-b border-white/10 pb-8">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#8a8b98]">Legal · Privacy</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm leading-6 text-[#a6a5b1]">Last updated: November 9, 2026</p>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#c1c1ca]">
            DriftMap helps teams review API contract changes. This policy describes what happens to the payloads, workspace information, and account details you choose to use with the service.
          </p>
        </header>

        <div className="divide-y divide-white/[0.08]">
          <section className="py-8">
            <h2 className="text-xl font-semibold">Local-first by default</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              The browser Workbench processes imported samples and inferred contracts locally and stores its default workspace data in IndexedDB. Your payloads are not uploaded to DriftMap by default. Cloud storage is used only when you explicitly enable and use workspace sync; data sent to a synced workspace is handled as described below.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Google sign-in</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              Google OAuth is used to authenticate you and identify the owner of a synced workspace. DriftMap uses the account identity required for sign-in and workspace ownership, not for advertising or unrelated profiling.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Synced workspaces and survey responses</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              If you enable workspace sync, cloud baselines and related workspace data are securely stored in DriftMap’s access-controlled Neon PostgreSQL database. If you complete the optional onboarding survey, your company-size range, primary API type, and CI/CD tool are stored with your user profile. Admin reporting uses aggregate category counts and does not return individual survey records or email addresses.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Retention and deletion</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              Browser data remains in your browser until you clear it. Synced baselines and survey responses remain in cloud storage until they are removed or you request deletion. To request deletion of cloud data associated with your account, contact DriftMap support through the support channel provided with your account or service communications and identify the account or workspace you control. We may verify ownership before processing the request.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Contact</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              For privacy questions or data requests, use the support channel provided with your account or service communications. Do not send account identifiers or other sensitive details through public channels.
            </p>
          </section>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-6 text-xs font-mono text-[#8a8b98]">
          <Link href="/" className="transition hover:text-white">Home</Link>
          <Link href="/workbench" className="transition hover:text-white">Workbench</Link>
          <Link href="/terms" className="transition hover:text-white">Terms</Link>
        </div>
      </article>
    </main>
  );
}
