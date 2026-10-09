"use client";

import { LoaderCircle } from "lucide-react";
import Image from "next/image";
import { signOut, useSession } from "next-auth/react";
import { useState } from "react";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";

export function AuthControl({ user }: { user: { name?: string | null; email?: string | null; image?: string | null } | null }) {
  const { status } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  if (status === "loading") return <span className="ca-auth-loading" role="status" aria-label="Loading account"><LoaderCircle size={14} className="ca-auth-spinner" /></span>;
  if (user && !signingOut) return <div className="ca-auth-control"><span className="ca-auth-avatar">{user.image ? <Image src={user.image} alt="" width={22} height={22} unoptimized /> : (user.name ?? user.email ?? "S").slice(0, 1).toUpperCase()}</span><span className="ca-auth-name">{user.name ?? "Signed in"}</span><button type="button" onClick={() => { setSigningOut(true); void signOut({ redirectTo: "/workbench" }); }}>Sign out</button></div>;
  if (signingOut) return <span className="ca-auth-loading" role="status" aria-live="polite">Signing out…</span>;
  return <GoogleAuthButton callbackUrl="/workbench" compact />;
}
