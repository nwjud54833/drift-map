import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    // Baseline security headers for every route. The Content-Security-Policy for
    // application routes is set per-request in `middleware.ts` using a nonce
    // (see that file); `headers()` cannot vary a nonce per response.
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=()" },
      // Browsers ignore Strict-Transport-Security on plain HTTP, so this is
      // inert during local `npm run dev` and enforced by the HTTPS deployment.
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
    ];
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The standalone v3.0 spatial artifact is served as a static file and
        // loads Tailwind and Google Fonts from CDNs, so `middleware.ts` excludes
        // it from the app's nonce policy. This rule gives it a CSP that names
        // exactly the origins it uses, instead of shipping it with no policy.
        source: "/driftmap-v3-spatial.html",
        headers: [
          ...securityHeaders,
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' https://cdn.tailwindcss.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data:",
              "connect-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
