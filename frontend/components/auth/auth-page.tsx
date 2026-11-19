"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { AuthProviderButtons } from "./google-auth-button";
import { browserPreferenceStorage, writeWorkbenchMode } from "@/lib/workbench/preferences";

export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const { status } = useSession();
  const isSignUp = mode === "signup";
  const title = isSignUp ? "Create your DriftMap account" : "Sign in to DriftMap";
  const description = isSignUp ? "Start saving workspaces and contract analysis in the cloud." : "Continue with Google or GitHub to access cloud workspaces.";

  return (
    <main className="auth-page grid-cols-[minmax(0,1fr)]">
      <div className="auth-page-grid" aria-hidden="true" />
      <div aria-hidden="true" className="pointer-events-none absolute -top-40 left-1/2 h-[360px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/[0.07] blur-[110px]" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[3%] left-[8%] h-[220px] w-[300px] rounded-full bg-emerald-500/[0.04] blur-[100px]" />
      <Link href="/" className="auth-back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to DriftMap</Link>
      <section className="auth-panel" aria-labelledby="auth-page-title">
        <div className="mb-6 flex items-center justify-between gap-2">
          <div className="auth-brand"><Image src="/logo-icon-180.png" alt="" width={26} height={26} className="object-contain" /><span>DRIFTMAP</span></div>
        </div>
        <div className="auth-panel-heading">
          <span className="auth-kicker">{isSignUp ? "CLOUD ACCESS" : "WELCOME BACK"}</span>
          <h1 id="auth-page-title">{title}</h1>
          <p>{description}</p>
        </div>
        {status === "loading" ? <div className="auth-loading" role="status" aria-live="polite">Checking session…</div> : <AuthProviderButtons beforeSignIn={() => writeWorkbenchMode(browserPreferenceStorage(), "cloud")} />}
        <div className="auth-divider"><span>or</span></div>
        <Link href="/workbench" onClick={() => writeWorkbenchMode(browserPreferenceStorage(), "local")} className="auth-local-link"><span>Continue locally</span><ArrowRight size={15} aria-hidden="true" /></Link>
        <p className="auth-local-note">Your local workspace does not require an account.</p>
        <div className="auth-trust-note"><ShieldCheck size={14} aria-hidden="true" /><span>Sign-in associates your cloud workspace with your account.</span></div>
        <p className="auth-switch">{isSignUp ? "Already have an account?" : "New to DriftMap?"} <Link href={isSignUp ? "/signin" : "/signup"}>{isSignUp ? "Sign in" : "Get started"}</Link></p>
      </section>
      <footer className="absolute bottom-5 left-1/2 z-10 flex w-[calc(100%-40px)] max-w-[920px] -translate-x-1/2 flex-wrap items-center justify-end gap-4 text-[11px] text-[var(--text-soft)]">
        <Link href="/privacy" className="transition-colors hover:text-[var(--text-muted)]">Privacy</Link>
        <Link href="/terms" className="transition-colors hover:text-[var(--text-muted)]">Terms</Link>
      </footer>
    </main>
  );
}
