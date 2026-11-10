import Link from "next/link";
import { SEO_METADATA } from "@/lib/seo/metadata";

export const metadata = SEO_METADATA.privacy;

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
              Local Workbench comparisons process imported samples in the browser and store local workspace data in IndexedDB. Cloud sync sends the workspace snapshots you choose to sync to DriftMap. If you create a local Share Review Link, compressed review data is embedded in its URL; anyone who receives the URL can inspect that review, and opening it makes a request to DriftMap. Submitting the early-access or onboarding forms sends the fields you enter to DriftMap.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Google sign-in</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              Google OAuth requests the openid, email, and profile scopes from Google. DriftMap uses the returned account identity to authenticate you and associate synced workspaces with their owner. If your Google profile includes a photo, the browser requests that image from its image URL to display your avatar.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">External resources</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              The standalone landing prototype at <code>/driftmap-v3-spatial.html</code> loads its fonts from Google Fonts. Those asset requests send ordinary request metadata to the provider. The prototype comparison code does not submit the sample payloads.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Synced workspaces and survey responses</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              If you enable workspace sync, selected snapshots and related workspace data are stored in DriftMap’s PostgreSQL database through the Neon adapter. Workspace routes require an authenticated owner session. If you complete the optional onboarding survey, your company-size range, primary API type, and CI/CD tool are stored with your user profile. The admin survey export returns aggregate category counts rather than individual survey records or email addresses.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Retention and deletion</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              Local workspaces are stored in IndexedDB and can be deleted in the Workbench or by clearing this site&apos;s browser storage. The Workbench also provides deletion for synced workspaces and snapshots. The application does not currently provide a self-service account, survey-profile, or waitlist deletion control, and this page does not state a retention period or deletion timeline.
            </p>
          </section>

          <section className="py-8">
            <h2 className="text-xl font-semibold">Contact</h2>
            <p className="mt-3 text-sm leading-7 text-[#b1b1bd]">
              The application does not currently publish a privacy contact address or an in-app data deletion request form. Do not send account identifiers or other sensitive details through public channels.
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
