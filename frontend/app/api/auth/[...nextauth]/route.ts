import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { tooManyRequests } from "@/lib/server/api";
import { AUTH_RATE_LIMIT, checkRateLimit, clientIpFromRequest } from "@/lib/server/rate-limit";

export const GET = handlers.GET;

// Sign-in attempts are limited per client address. This is an in-process
// stopgap: on serverless each instance counts independently. See
// lib/server/rate-limit.ts for the documented limitation.
export async function POST(request: NextRequest) {
  const limit = checkRateLimit("auth:post", clientIpFromRequest(request), AUTH_RATE_LIMIT.limit, AUTH_RATE_LIMIT.windowMs);
  if (!limit.allowed) return tooManyRequests(limit.retryAfterSeconds);
  return handlers.POST(request);
}
