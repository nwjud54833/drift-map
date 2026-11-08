import { createHmac, timingSafeEqual } from "node:crypto";

const TOKEN_AUDIENCE = "driftmap:workspace-baseline:read";
const TOKEN_VERSION = "v1";
const TOKEN_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export interface BaselineTokenClaims {
  userId: string;
  workspaceId: string;
  expiresAt: number;
}

function signingSecret(secret = process.env.AUTH_SECRET): string | null {
  return secret && Buffer.byteLength(secret, "utf8") >= 32 ? secret : null;
}

function signature(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createBaselineReadToken(
  userId: string,
  workspaceId: string,
  now = Date.now(),
  secretValue = process.env.AUTH_SECRET,
): { token: string; expiresAt: number } | null {
  const secret = signingSecret(secretValue);
  if (!secret || !userId || !workspaceId) return null;

  const issuedAt = Math.floor(now / 1000);
  const expiresAt = issuedAt + TOKEN_LIFETIME_SECONDS;
  const payload = Buffer.from(JSON.stringify({
    aud: TOKEN_AUDIENCE,
    sub: userId,
    wid: workspaceId,
    iat: issuedAt,
    exp: expiresAt,
  })).toString("base64url");
  const signedValue = `${TOKEN_VERSION}.${payload}`;
  return { token: `${signedValue}.${signature(signedValue, secret)}`, expiresAt };
}

export function verifyBaselineReadToken(
  token: string,
  expectedWorkspaceId: string,
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
    if (claims.aud !== TOKEN_AUDIENCE
      || typeof claims.sub !== "string" || claims.sub.length === 0
      || claims.wid !== expectedWorkspaceId
      || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp)
      || (claims.iat as number) > nowSeconds
      || (claims.exp as number) <= nowSeconds
      || (claims.exp as number) - (claims.iat as number) > TOKEN_LIFETIME_SECONDS) return null;
    return { userId: claims.sub, workspaceId: expectedWorkspaceId, expiresAt: claims.exp as number };
  } catch {
    return null;
  }
}
