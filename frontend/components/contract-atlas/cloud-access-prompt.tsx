"use client";

import { Cloud, LoaderCircle, X } from "lucide-react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export function CloudAccessPrompt({ onStayLocal }: { onStayLocal: () => void }) {
  return <div className="ca-cloud-prompt-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onStayLocal(); }}>
    <section className="ca-cloud-prompt" role="dialog" aria-modal="true" aria-labelledby="ca-cloud-prompt-title">
      <button type="button" className="ca-cloud-prompt-close" aria-label="Stay in Local mode" onClick={onStayLocal}><X size={15} /></button>
      <span className="ca-cloud-prompt-icon"><Cloud size={19} aria-hidden="true" /></span>
      <span className="ca-overline">Cloud workspaces</span>
      <h2 id="ca-cloud-prompt-title">Take your contracts with you.</h2>
      <p>Sign in with Google to save DriftMap workspaces and access them across sessions.</p>
      <GoogleAuthButton />
      <button type="button" className="ca-cloud-prompt-local" onClick={onStayLocal}>Stay in Local Mode</button>
    </section>
  </div>;
}

export function SessionStatus({ status }: { status: "loading" | "authenticated" | "unauthenticated" }) {
  if (status !== "loading") return null;
  return <span className="ca-session-status" role="status" aria-live="polite"><LoaderCircle size={13} className="ca-auth-spinner" /> Checking session…</span>;
}
