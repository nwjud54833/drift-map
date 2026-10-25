/**
 * In-process fixed-window rate limiter.
 *
 * STOPGAP, knowingly accepted: the counters live in the API server's memory.
 * On Vercel the deployment runs as multiple isolated instances that scale to
 * zero, so each instance counts independently and the effective limit is
 * `limit × instance-count`, not a global guarantee. A shared store (for
 * example Upstash Redis or Vercel KV keyed by user or IP) is the follow-up
 * work; until then this bounds casual abuse per instance.
 */

interface WindowState {
  count: number;
  resetAt: number;
}

const windows = new Map<string, WindowState>();

/** Bound on tracked keys so a flood of unique keys cannot grow memory forever. */
const MAX_WINDOWS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the window resets; meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

export function checkRateLimit(bucket: string, key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (windows.size > MAX_WINDOWS) {
    for (const [name, state] of windows) if (state.resetAt <= now) windows.delete(name);
    if (windows.size > MAX_WINDOWS) windows.clear();
  }
  const name = `${bucket}:${key}`;
  const state = windows.get(name);
  if (!state || state.resetAt <= now) {
    windows.set(name, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  state.count += 1;
  if (state.count > limit) {
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((state.resetAt - now) / 1000)) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Best-effort client address for unauthenticated endpoints: the first hop of
 * `x-forwarded-for` (set by Vercel and most proxies). Trusted only as a coarse
 * key, never as an identity.
 */
export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Test hook: forget every counter. */
export function resetRateLimits(): void {
  windows.clear();
}

/** Per-user budget for authenticated API writes. */
export const WRITE_RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const;

/** Per-address budget for unauthenticated auth traffic (sign-in attempts). */
export const AUTH_RATE_LIMIT = { limit: 30, windowMs: 60_000 } as const;
