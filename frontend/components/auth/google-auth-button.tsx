"use client";

import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function GoogleAuthButton({ callbackUrl = "/workbench", compact = false }: { callbackUrl?: string; compact?: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function continueWithGoogle() {
    if (pending) return;
    setPending(true);
    setError(false);
    try {
      const result = await signIn("google", { callbackUrl, redirect: false });
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
      <button type="button" className="auth-google-button" onClick={() => void continueWithGoogle()} disabled={pending} aria-busy={pending}>
        {pending ? <LoaderCircle size={16} className="auth-spinner" aria-hidden="true" /> : <span className="auth-google-mark" aria-hidden="true">G</span>}
        <span>{pending ? "Connecting…" : "Continue with Google"}</span>
      </button>
      {error && <p className="auth-inline-error" role="alert">Google sign-in couldn&apos;t be completed. <button type="button" onClick={() => void continueWithGoogle()}>Try again</button></p>}
    </div>
  );
}
