import { NextResponse } from "next/server";
import { auth } from "@/auth";

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

export async function readJsonBody(request: Request): Promise<unknown> {
  const rawContentLength = request.headers.get("content-length");
  const contentLength = rawContentLength === null ? null : Number(rawContentLength);
  if (contentLength !== null && (!Number.isSafeInteger(contentLength) || contentLength < 0)) {
    throw new SyntaxError("Request body has an invalid content length.");
  }
  if (contentLength !== null && contentLength > MAX_API_BODY_BYTES) {
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
      if (byteLength > MAX_API_BODY_BYTES) {
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
