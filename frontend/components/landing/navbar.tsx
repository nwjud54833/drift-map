"use client";
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { LogOut, UserRound, Cloud } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

interface NavbarProps { onOpenWorkbench: () => void; }

export const Navbar: React.FC<NavbarProps> = ({ onOpenWorkbench }) => {
  const { data: session, status } = useSession();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    function close(event: MouseEvent) { if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false); }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [accountOpen]);

  const authenticated = status === "authenticated" && session?.user;
  const displayName = session?.user?.name ?? session?.user?.email ?? "Signed in";
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1A202A] bg-[#050609]/85 backdrop-blur-md transition-all duration-200">
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-2 text-sm font-semibold tracking-wide text-[#F5F7FA]" aria-label="DriftMap home">
          <span className="relative h-5 w-5 shrink-0"><Image src="/logo-icon-180.png" alt="" fill className="object-contain" sizes="20px" /></span>
          <span className="font-mono text-[14px] font-bold tracking-tight text-white group-hover:text-[#F5F7FA] transition-colors">DRIFTMAP</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#8993A5]" aria-label="Primary navigation">
          <a href="#how-it-works" className="hover:text-[#F5F7FA] transition-colors duration-150">How it works</a>
          <a href="#semantic-drift" className="hover:text-[#F5F7FA] transition-colors duration-150">Why DriftMap</a>
          <a href="#workbench" className="hover:text-[#F5F7FA] transition-colors duration-150">Workbench</a>
          <a href="#use-cases" className="hover:text-[#F5F7FA] transition-colors duration-150">Developers</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[#F5F7FA] transition-colors duration-150">GitHub <span className="text-[11px] text-[#8993A5]">↗</span></a>
        </nav>
        <div className="flex items-center gap-2">
          {!authenticated && status !== "loading" && <Link href="/signin" className="driftmap-nav-signin">Sign In</Link>}
          {!authenticated && status !== "loading" && <Link href="/signup" className="driftmap-nav-start">Get Started <span aria-hidden="true">→</span></Link>}
          {authenticated && <div ref={accountRef} className="driftmap-account-wrap">
            <button type="button" className="driftmap-account-button" aria-expanded={accountOpen} aria-haspopup="menu" onClick={() => setAccountOpen((open) => !open)}>
              <span className="driftmap-account-avatar">{initials}</span><span className="hidden sm:inline">{displayName}</span><span aria-hidden="true">⌄</span>
            </button>
            {accountOpen && <div className="driftmap-account-menu" role="menu">
              <div className="driftmap-account-summary"><span className="driftmap-account-avatar">{initials}</span><span><strong>{displayName}</strong><small>Authenticated with Google</small></span></div>
              <Link href="/workbench" role="menuitem" onClick={() => setAccountOpen(false)}><Cloud size={14} aria-hidden="true" />Cloud Workspaces</Link>
              <Link href="/workbench" role="menuitem" onClick={() => setAccountOpen(false)}><UserRound size={14} aria-hidden="true" />Account</Link>
              <button type="button" role="menuitem" onClick={() => void signOut({ redirectTo: "/" })}><LogOut size={14} aria-hidden="true" />Sign out</button>
            </div>}
          </div>}
          <button onClick={onOpenWorkbench} className="group hidden items-center gap-2 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white bg-[#0E1219] hover:bg-[#151B24] border border-[#1A202A] hover:border-[#3B82F6]/50 rounded-[4px] transition-all duration-200 whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.5)] sm:flex"><span>Open Workbench</span><span className="text-[#3B82F6] group-hover:translate-x-0.5 transition-transform duration-150">→</span></button>
        </div>
      </div>
    </header>
  );
};
