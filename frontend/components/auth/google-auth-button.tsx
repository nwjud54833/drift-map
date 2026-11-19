"use client";

import { GitBranch, LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

type AuthButtonProps = { callbackUrl?: string; compact?: boolean; beforeSignIn?: () => void };
type AuthProvider = "google" | "github";

function ProviderAuthButton({ provider, callbackUrl = "/workbench", compact = false, beforeSignIn }: AuthButtonProps & { provider: AuthProvider }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const providerName = provider === "google" ? "Google" : "GitHub";

  async function continueWithProvider() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      beforeSignIn?.();
      const result = await signIn(provider, { callbackUrl, redirect: false });
      if (result?.url) {
        window.location.assign(result.url);
        return;
      }
      setError(true);
      setPending(false);
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <div className={compact ? "auth-google-action auth-google-action-compact" : "auth-google-action"}>
      <button type="button" className="auth-google-button" onClick={() => void continueWithProvider()} disabled={pending} aria-busy={pending}>
        {pending ? <LoaderCircle size={16} className="auth-spinner" aria-hidden="true" /> : provider === "google" ? <span className="auth-google-mark" aria-hidden="true">G</span> : <GitBranch size={17} aria-hidden="true" />}
        <span>{pending ? "Connecting…" : `Continue with ${providerName}`}</span>
      </button>
      {error && <p className="auth-inline-error" role="alert">{providerName} sign-in couldn&apos;t be completed. <button type="button" onClick={() => void continueWithProvider()}>Try again</button></p>}
    </div>
  );
}

export function GoogleAuthButton(props: AuthButtonProps) {
  return <ProviderAuthButton {...props} provider="google" />;
}

export function GitHubAuthButton(props: AuthButtonProps) {
  return <ProviderAuthButton {...props} provider="github" />;
}

export function AuthProviderButtons(props: AuthButtonProps) {
  return (
    <div className="grid gap-2">
      <GoogleAuthButton {...props} />
      <GitHubAuthButton {...props} />
    </div>
  );
}
