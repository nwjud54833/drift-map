import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMonthKeyResetsAt } from "@/lib/plans/limits";
import type { UsageState } from "@/lib/plans/usage";

export const MAX_API_BODY_BYTES = 4 * 1024 * 1024;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function authenticatedUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireAuthenticatedUser(): Promise<{ ok: true; userId: string } | { ok: false; response: NextResponse }> {
  try {
    const userId = await authenticatedUserId();
    return userId
      ? { ok: true, userId }
      : { ok: false, response: apiError("Sign in is required.", 401) };
  } catch {
    return { ok: false, response: apiError("Unable to verify your session.", 500) };
  }
}

export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * The 429 a metered endpoint returns once a user's monthly cloud-run allowance
 * is spent. Unlike `apiError`, `error` carries a stable machine-readable code
 * and the human-readable sentence lives in `message`, so clients can branch on
 * the code while still surfacing something a person can read.
 */
export function usageLimitResponse(usage: UsageState) {
  return NextResponse.json(
    {
      error: "usage_limit_reached",
      message: `You've used ${usage.cloudRuns} of ${usage.limit} cloud runs this month. Local diffs are still unlimited.`,
      resetsAt: getMonthKeyResetsAt(usage.monthKey).toISOString(),
    },
    { status: 429 },
  );
}

export async function readJsonBody(request: Request, maxBytes = MAX_API_BODY_BYTES): Promise<unknown> {
  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength === null ? null : Number(rawContentLength);
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) {
    throw new SyntaxError("Request body has an invalid content length.");
  }
  if (contentLength !== null && contentLength > maxBytes) {
    throw new RangeError("Request body is too large.");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Request body must be valid JSON.");
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw new RangeError("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const raw = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new SyntaxError("Request body must be valid JSON.");
  }
}
