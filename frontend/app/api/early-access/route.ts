import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { consumeEarlyAccessLimit, rateLimitKey } from "@/lib/server/early-access-rate-limit";

const MAX_BODY_BYTES = 2 * 1024;
const requestSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  githubOrg: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(39).regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/).optional(),
  ),
  repositoryCount: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.number().int().min(1).max(100_000).optional(),
  ),
}).strict();

async function readSmallJson(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > MAX_BODY_BYTES)) {
    throw new RangeError("Request body is too large.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError("Request body is required.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new RangeError("Request body is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new SyntaxError("Request body must be valid JSON.");
  }
}

function rateLimitedResponse(retryAfter: number) {
  return NextResponse.json(
    { error: "Too many requests. Try again later." },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json({ error: "Cross-origin requests are not accepted." }, { status: 403, headers: { "Cache-Control": "no-store" } });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Content-Type must be application/json." }, { status: 415, headers: { "Cache-Control": "no-store" } });
  }

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",").map((part) => part.trim()).filter(Boolean);
  const address = request.headers.get("x-real-ip")?.trim() || forwardedFor?.at(-1) || "unknown";
  const ipLimit = consumeEarlyAccessLimit(`ip:${rateLimitKey(address)}`, 10);
  if (!ipLimit.allowed) return rateLimitedResponse(ipLimit.retryAfter);

  let body: unknown;
  try {
    body = await readSmallJson(request);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;
    return NextResponse.json({ error: error instanceof RangeError ? error.message : "Request must contain valid JSON." }, { status, headers: { "Cache-Control": "no-store" } });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and optional GitHub organization and repository count." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const emailLimit = consumeEarlyAccessLimit(`email:${rateLimitKey(parsed.data.email)}`, 3);
  if (!emailLimit.allowed) return rateLimitedResponse(emailLimit.retryAfter);

  try {
    await prisma.earlyAccessRequest.upsert({
      where: { email: parsed.data.email },
      create: {
        email: parsed.data.email,
        ...(parsed.data.githubOrg ? { githubOrg: parsed.data.githubOrg } : {}),
        ...(parsed.data.repositoryCount ? { repositoryCount: parsed.data.repositoryCount } : {}),
      },
      update: {
        ...(parsed.data.githubOrg ? { githubOrg: parsed.data.githubOrg } : {}),
        ...(parsed.data.repositoryCount ? { repositoryCount: parsed.data.repositoryCount } : {}),
      },
      select: { id: true },
    });
    return NextResponse.json({ status: "accepted" }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Early access requests are temporarily unavailable. Try again later." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
