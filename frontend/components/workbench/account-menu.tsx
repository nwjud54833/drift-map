"use client";

import { useState } from "react";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";
import { Avatar } from "@/components/ui/avatar";
import { Menu, MenuHeader, MenuItem, MenuSeparator } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { browserPreferenceStorage, writeWorkbenchMode } from "@/lib/workbench/preferences";

interface AccountUser {
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

/**
 * Account menu. Signed out it becomes a "Sign in with Google" action (cloud
 * mode only — the caller decides when to render it). The trigger shows an
 * avatar with an initials fallback, so it never depends on a remote image.
 */
export function AccountMenu({ user }: { user: AccountUser | null }) {
  const [signingOut, setSigningOut] = useState(false);

  if (!user) {
    return (
      <GoogleAuthButton
        callbackUrl="/workbench"
        compact
        beforeSignIn={() => writeWorkbenchMode(browserPreferenceStorage(), "cloud")}
      />
    );
  }

  if (signingOut) {
    return <span className="ca-auth-loading" role="status" aria-live="polite">Signing out…</span>;
  }

  const label = user.name ?? user.email ?? "Account";

  return (
    <Menu
      label={`Account menu for ${label}`}
      triggerClassName="dm-account-trigger"
      trigger={() => (
        <>
          <Avatar name={user.name} email={user.email} image={user.image} size={24} />
          <ChevronDown size={14} aria-hidden="true" />
        </>
      )}
    >
      {({ close }) => (
        <>
          <MenuHeader name={user.name ?? "Signed in"} meta={user.email ?? undefined} />
          <MenuItem onSelect={() => { close(); void signOut({ redirectTo: "/workbench" }); setSigningOut(true); }} danger>
            <LogOut size={14} aria-hidden="true" /> Sign out
          </MenuItem>
          <MenuSeparator />
          <div className="dm-account-note">
            <UserRound size={13} aria-hidden="true" />
            Cloud workspaces are saved to your account. Local browser data is not uploaded.
          </div>
        </>
      )}
    </Menu>
  );
}

/**
 * Session placeholder that reserves the account control's exact height, so
 * resolving the session does not move the rest of the top bar.
 */
export function AccountMenuSkeleton() {
  return (
    <span className="dm-account-skeleton" role="status" aria-label="Checking sign-in status">
      <Skeleton width={58} height={24} radius="999px" />
    </span>
  );
}
