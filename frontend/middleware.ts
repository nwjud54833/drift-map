import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  // `next dev` serves React Refresh, which evaluates strings to hot-reload a
  // module. A strict script-src blocks that, and the thrown EvalError aborts
  // hydration, so every `ssr: false` component — the workbench editors among
  // them — never mounts. The dev server is the only thing that needs the
  // exception; a production build has no React Refresh, so it stays strict.
  const scriptSrc = process.env.NODE_ENV === "development"
    ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  const contentSecurityPolicy = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  // The SPATIAL landing page is a standalone static artifact that loads Tailwind
  // and Google Fonts from its own CDNs, so it opts out of the app's nonce CSP.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|driftmap-v3-spatial\\.html).*)"],
};
