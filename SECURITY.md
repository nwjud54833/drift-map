# Security policy

## Reporting a vulnerability

<!-- TODO(owner): replace the advisory-only instruction below with the contact
     method DriftMap should receive security reports at (for example a dedicated
     email address or a security form), then delete this comment. -->

DriftMap currently accepts vulnerability reports through GitHub security
advisories only:

<https://github.com/nwjud54833/drift-map/security/advisories/new>

Please do not open public issues for suspected vulnerabilities. Include steps to
reproduce, affected routes or files, and impact where possible.

## What is hardened

The following measures are in place. This list describes specific controls — it
is not a certification of the application:

- Baseline response headers on every route (`frontend/next.config.ts`):
  `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
  `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy`
  disabling camera, geolocation, microphone, and payment, and a two-year
  `Strict-Transport-Security` with `includeSubDomains`.
- A per-request nonce Content-Security-Policy (`frontend/middleware.ts`) with
  `strict-dynamic` scripting for application routes, plus a narrow,
  origin-specific CSP for the standalone `driftmap-v3-spatial.html` artifact.
- API routes require an authenticated session and scope every database query to
  the session user's own workspaces, snapshots, and diffs.
- Request bodies are schema-validated (zod) and size-capped before parsing.
- CI runs lint, typecheck, hermetic tests, and a production build on every pull
  request, a gitleaks secret scan of full history, and CodeQL analysis for
  JavaScript/TypeScript. Third-party actions are pinned to commit SHAs and
  checkouts do not persist credentials.

## What remains open

- `style-src 'unsafe-inline'` is still required (Tailwind and React inline
  styles); script injection is constrained by the nonce policy instead.
- The standalone spatial artifact loads Tailwind and Google Fonts from public
  CDNs under its dedicated CSP.
- Rate limiting on API writes is an in-process, per-instance stopgap; see the
  API hardening pull request for details.
- Sample payloads may contain PII; exports include them unless redaction is
  enabled for cloud-mode exports.
