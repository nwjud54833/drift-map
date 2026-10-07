"use client";
import Link from "next/link";
import React from "react";

interface NavbarProps {
  onOpenWorkbench: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenWorkbench }) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1A202A] bg-[#050609]/85 backdrop-blur-md transition-all duration-200">
      <div className="mx-auto flex h-13 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Brand Wordmark (Single element) */}
        <Link href="/"
          className="group flex items-center gap-2 text-sm font-semibold tracking-wide text-[#F5F7FA]"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-[#3B82F6] text-[11px] font-bold text-white shadow-[0_0_14px_rgba(59,130,246,0.45)]">
            Δ
          </span>
          <span className="font-mono text-[14px] font-bold tracking-tight text-white group-hover:text-[#F5F7FA] transition-colors">
            DRIFTMAP
          </span>
        </Link>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#8993A5]">
          <a href="#how-it-works" className="hover:text-[#F5F7FA] transition-colors duration-150">
            How it works
          </a>
          <a href="#semantic-drift" className="hover:text-[#F5F7FA] transition-colors duration-150">
            Why DriftMap
          </a>
          <a href="#workbench" className="hover:text-[#F5F7FA] transition-colors duration-150">
            Workbench
          </a>
          <a href="#use-cases" className="hover:text-[#F5F7FA] transition-colors duration-150">
            Developers
          </a>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-[#F5F7FA] transition-colors duration-150"
          >
            GitHub <span className="text-[11px] text-[#8993A5]">↗</span>
          </a>
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenWorkbench}
            className="group flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white bg-[#0E1219] hover:bg-[#151B24] border border-[#1A202A] hover:border-[#3B82F6]/50 rounded-[4px] transition-all duration-200 whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          >
            <span>Open Workbench</span>
            <span className="text-[#3B82F6] group-hover:translate-x-0.5 transition-transform duration-150">→</span>
          </button>
        </div>
      </div>
    </header>
  );
};
