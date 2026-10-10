"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useSession } from "next-auth/react";
import { GoogleAuthButton } from "./google-auth-button";

export function AuthPage({ mode }: { mode: "signin" | "signup" }) {
  const { status } = useSession();
  const isSignUp = mode === "signup";
  const title = isSignUp ? "Create your DriftMap account" : "Sign in to DriftMap";
  const description = isSignUp ? "Start saving workspaces and contract analysis in the cloud." : "Continue with your Google account to access cloud workspaces.";

  return (
    <main className="auth-page">
      <div className="auth-page-grid" aria-hidden="true" />
      <Link href="/" className="auth-back-link"><ArrowLeft size={14} aria-hidden="true" /> Back to DriftMap</Link>
      <section className="auth-panel" aria-labelledby="auth-page-title">
        <div className="auth-brand"><Image src="/logo-icon-180.png" alt="" width={26} height={26} className="object-contain" /><span>DRIFTMAP</span></div>
        <div className="auth-panel-heading">
          <span className="auth-kicker">{isSignUp ? "CLOUD ACCESS" : "WELCOME BACK"}</span>
          <h1 id="auth-page-title">{title}</h1>
          <p>{description}</p>
        </div>
        {status === "loading" ? <div className="auth-loading" role="status" aria-live="polite">Checking session…</div> : <GoogleAuthButton />}
        <div className="auth-divider"><span>or</span></div>
        <Link href="/workbench" className="auth-local-link"><span>Continue locally</span><ArrowRight size={15} aria-hidden="true" /></Link>
        <p className="auth-local-note">Your local workspace does not require an account.</p>
        <div className="auth-trust-note"><ShieldCheck size={14} aria-hidden="true" /><span>Your Google account is used only for authentication.</span></div>
        <p className="auth-switch">{isSignUp ? "Already have an account?" : "New to DriftMap?"} <Link href={isSignUp ? "/signin" : "/signup"}>{isSignUp ? "Sign in" : "Get started"}</Link></p>
      </section>
    </main>
  );
}
