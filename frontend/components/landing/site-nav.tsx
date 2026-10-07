"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { GITHUB_URL, Logo } from "./ui";

const links = [{ label: "How it works", href: "#how-it-works" }, { label: "Why Contract Atlas", href: "#why" }, { label: "Developers", href: "#developers" }, { label: "GitHub", href: GITHUB_URL, external: true }];

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => { const onScroll = () => setScrolled(window.scrollY > 14); onScroll(); window.addEventListener("scroll", onScroll, { passive: true }); return () => window.removeEventListener("scroll", onScroll); }, []);
  return <header className={`site-nav ${scrolled ? "is-scrolled" : ""}`}><nav aria-label="Main navigation" className="site-nav-inner"><Link href="/" aria-label="Contract Atlas home"><Logo /></Link><div className="site-nav-links">{links.map((link) => <a key={link.label} href={link.href} {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}>{link.label}{link.external && <ArrowUpRight size={12} />}</a>)}</div><div className="site-nav-actions"><a className="site-nav-quiet" href="#why">Why Atlas</a><a className="site-nav-cta" href="/workbench">Open Workbench <ArrowUpRight size={14} /></a><button className="site-nav-menu" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen((value) => !value)}>{open ? <X size={19} /> : <Menu size={19} />}</button></div></nav>{open && <div className="mobile-nav-panel">{links.map((link) => <a key={link.label} href={link.href} onClick={() => setOpen(false)}>{link.label}{link.external && <ArrowUpRight size={13} />}</a>)}<a className="site-nav-cta" href="/workbench" onClick={() => setOpen(false)}>Open Workbench <ArrowUpRight size={14} /></a></div>}</header>;
}
