"use client";

import { signIn, signOut } from "next-auth/react";

export function AuthControl({ user }: { user: { name?: string | null; email?: string | null } | null }) {
  return user ? (
    <div className="ca-auth-control">
      <span>{user.name ?? user.email ?? "Signed in"}</span>
      <button type="button" onClick={() => void signOut({ redirectTo: "/workbench" })}>Sign out</button>
    </div>
  ) : (
    <button className="ca-auth-button" type="button" onClick={() => void signIn("google", { redirectTo: "/workbench" })}>Sign in with Google</button>
  );
}
