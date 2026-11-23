"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { AuthProviderButtons } from "./google-auth-button";
import { browserPreferenceStorage, writeWorkbenchMode } from "@/lib/workbench/preferences";

/* ── Inline SVG icons matching the design file ────────────────────────── */

function TerminalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2.75" width="12" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5 6.75L7 8.5L5 10.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 10.25H11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const { status } = useSession();
  const isSignUp = mode === "signup";
  const title = isSignUp ? "Create your DriftMap account" : "Sign in to DriftMap";
  const description = isSignUp
    ? "Start saving workspaces and contract analysis in the cloud."
    : "Continue with Google or GitHub to access cloud workspaces.";

  return (
    <main className="auth-page">
      {/* Grid background */}
      <div className="auth-page-grid" aria-hidden="true" />

      {/* Ambient radial glows */}
      <div aria-hidden="true" className="pointer-events-none absolute -top-[14%] left-1/2 h-[320px] w-[500px] -translate-x-1/2 rounded-full bg-indigo-500/[0.065] blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[4%] left-[12%] h-[220px] w-[300px] rounded-full bg-emerald-500/[0.04] blur-[100px]" />

      {/* Top header */}
      <header className="auth-header">
        <Link href="/" className="auth-back-link">
          <ArrowLeft size={14} className="text-zinc-500 transition-colors group-hover:text-zinc-200" aria-hidden="true" />
          <span>Back to DriftMap</span>
        </Link>
      </header>

      {/* Centered auth card */}
      <section className="auth-panel" aria-labelledby="auth-page-title">
        {/* Brand mark */}
        <div className="mb-6 flex items-center gap-2.5">
          <div className="auth-brand-icon">
            <Image src="/logo-icon-180.png" alt="" width={18} height={18} className="object-contain" />
          </div>
          <span className="auth-brand-wordmark">DRIFTMAP</span>
        </div>

        {/* Heading section */}
        <div className="auth-panel-heading">
          <span className="auth-kicker">{isSignUp ? "CLOUD ACCESS" : "WELCOME BACK"}</span>
          <h1 id="auth-page-title">{title}</h1>
          <p>{description}</p>
        </div>

        {/* Provider buttons */}
        {status === "loading" ? (
          <div className="auth-loading" role="status" aria-live="polite">Checking session…</div>
        ) : (
          <AuthProviderButtons beforeSignIn={() => writeWorkbenchMode(browserPreferenceStorage(), "cloud")} />
        )}

        {/* Divider */}
        <div className="auth-divider"><span>OR</span></div>

        {/* Continue locally card-button */}
        <Link
          href="/workbench"
          onClick={() => writeWorkbenchMode(browserPreferenceStorage(), "local")}
          className="auth-local-card group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="auth-local-icon">
              <TerminalIcon className="w-4 h-4 text-zinc-400 transition-colors group-hover:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[13.5px] font-semibold text-zinc-100 group-hover:text-white">
                Continue locally
              </div>
              <p className="auth-local-subtitle">
                Zero-account browser workspace · Data stays on device
              </p>
            </div>
          </div>
          <span className="text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all text-sm font-medium shrink-0" aria-hidden="true">→</span>
        </Link>

        {/* Trust note + get started */}
        <div className="auth-footer-section">
          <div className="auth-trust-note">
            <ShieldCheck size={16} className="text-emerald-400/85 shrink-0 mt-0.5" aria-hidden="true" />
            <span>Sign-in associates your cloud workspace with your account.</span>
          </div>
          <p className="auth-switch">
            {isSignUp ? "Already have an account?" : "New to DriftMap?"}
            {" "}
            <Link href={isSignUp ? "/signin" : "/signup"}>
              {isSignUp ? "Sign in" : "Get started"} <span aria-hidden="true">→</span>
            </Link>
          </p>
        </div>
      </section>

      {/* Legal footer */}
      <footer className="auth-legal-footer">
        <span>© 2026 DriftMap Inc.</span>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="transition-colors hover:text-zinc-300">Privacy</Link>
          <Link href="/terms" className="transition-colors hover:text-zinc-300">Terms</Link>
        </div>
      </footer>
    </main>
  );
}
