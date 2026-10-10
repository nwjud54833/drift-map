"use client";

/** Geometric DriftMap mark: a contract path that forks into a diverging (drifted) branch. */
export function DriftMapLogo({ size = 22, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      {/* base contract path */}
      <path d="M3 12h6.2" stroke="#94A3B8" strokeWidth="2.1" strokeLinecap="round" />
      {/* stable fork */}
      <path d="M9.2 12c2.4 0 3.1-2.4 4.6-4.6" stroke="#36D6F5" strokeWidth="2.1" strokeLinecap="round" />
      {/* drifted fork */}
      <path d="M9.2 12c1.8 0 3.6 2.1 5.4 4.9" stroke="#818CF8" strokeWidth="2.1" strokeLinecap="round" />
      {/* nodes */}
      <circle cx="17.4" cy="5.9" r="2.1" fill="#36D6F5" />
      <circle cx="17.4" cy="18.1" r="2.1" fill="#818CF8" />
    </svg>
  );
}

/** Inline favicon (SVG data URL) so no static file is required. */
export const driftMapFaviconHref =
  (() => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#0B1020"/><path d="M3 12h6.2" stroke="#94A3B8" stroke-width="2.1" strokeLinecap="round"/><path d="M9.2 12c2.4 0 3.1-2.4 4.6-4.6" stroke="#36D6F5" stroke-width="2.1" strokeLinecap="round"/><path d="M9.2 12c1.8 0 3.6 2.1 5.4 4.9" stroke="#818CF8" stroke-width="2.1" strokeLinecap="round"/><circle cx="17.4" cy="5.9" r="2.1" fill="#36D6F5"/><circle cx="17.4" cy="18.1" r="2.1" fill="#818CF8"/></svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  })();
