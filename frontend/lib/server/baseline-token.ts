import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_AUDIENCE = "driftmap:workspace-baseline";
const TOKEN_VERSION = "v1";
const TOKEN_LIFETIME_SECONDS = 90 * 24 * 60 * 60;
export type BaselineTokenScope = "read" | "promote";

export interface BaselineTokenClaims {
  userId: string;
  workspaceId: string;
  expiresAt: number;
  scope: BaselineTokenScope;
}

function signingSecret(secret = process.env.AUTH_SECRET): string | null {
  return secret && Buffer.byteLength(secret, "utf8") >= 32 ? secret : null;
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createBaselineToken(
  userId: string,
  workspaceId: string,
  scope: BaselineTokenScope = "read",
  now = Date.now(),
  secretValue = process.env.AUTH_SECRET,
): { token: string; expiresAt: number } | null {
  const secret = signingSecret(secretValue);
  if (!secret || !userId || !workspaceId) return null;

  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + TOKEN_LIFETIME_SECONDS;
  const payload = Buffer.from(JSON.stringify({
    aud: TOKEN_AUDIENCE,
    scope,
    sub: userId,
    wid: workspaceId,
    iat: issuedAt,
    exp: expiresAt,
  })).toString("base64url");
  const signedValue = `${TOKEN_VERSION}.${payload}`;
  return { token: `${signedValue}.${signature(signedValue, secret)}`, expiresAt };
}

export function verifyBaselineToken(
  token: string,
  expectedWorkspaceId: string,
  requiredScope: BaselineTokenScope = "read",
  now = Date.now(),
  secretValue = process.env.AUTH_SECRET,
): BaselineTokenClaims | null {
  const secret = signingSecret(secretValue);
  if (!secret || token.length > 4096) return null;

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  const signedValue = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(signature(signedValue, secret));
  const supplied = Buffer.from(parts[2]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

  try {
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
    const nowSeconds = Math.floor(now / 1000);
    const scope = claims.scope === undefined ? "read" : claims.scope;
    if (claims.aud !== TOKEN_AUDIENCE && claims.aud !== "driftmap:workspace-baseline:read"
      || typeof claims.sub !== "string" || claims.sub.length === 0
      || claims.wid !== expectedWorkspaceId
      || (scope !== "read" && scope !== "promote")
      || scope !== requiredScope
      || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
      || (claims.iat as number) > nowSeconds
      || (claims.exp as number) <= nowSeconds
      || (claims.exp as number) - (claims.iat as number) > TOKEN_LIFETIME_SECONDS) return null;
    return { userId: claims.sub, workspaceId: expectedWorkspaceId, expiresAt: claims.exp as number, scope };
  } catch {
    return null;
  }
}

/** Backwards-compatible helper for callers and tests using the v2.5.2 API. */
export function createBaselineReadToken(userId: string, workspaceId: string, now = Date.now(), secretValue = process.env.AUTH_SECRET) {
  return createBaselineToken(userId, workspaceId, "read", now, secretValue);
}

export const verifyBaselineReadToken = (token: string, workspaceId: string, now = Date.now(), secretValue = process.env.AUTH_SECRET) =>
  verifyBaselineToken(token, workspaceId, "read", now, secretValue);
