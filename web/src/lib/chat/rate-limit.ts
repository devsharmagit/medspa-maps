/**
 * rate-limit.ts — minimal in-memory fixed-window rate limiter.
 *
 * Scope (intentionally simple "for now"): per-process, in-memory. Good for a
 * single Node server (the current setup). On multi-instance / serverless
 * deployments each instance keeps its own counters, so move to a shared store
 * (e.g. Upstash Redis) when you scale out.
 *
 * SERVER-SIDE ONLY.
 */
interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the window rolls over
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

/** Drop expired buckets occasionally so the map doesn't grow unbounded. */
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < windowMs) return;
  lastSweep = now;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

export interface RateResult {
  ok: boolean;
  /** requests left in the current window */
  remaining: number;
  /** seconds until the window resets (for Retry-After) */
  retryAfter: number;
}

/**
 * Counts one request against `key`. Allows up to `limit` requests per
 * `windowMs`. Returns ok:false (without counting) once the window is exhausted.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateResult {
  const now = Date.now();
  sweep(now, windowMs);

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfter: 0 };
  }

  if (b.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }

  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfter: 0 };
}
