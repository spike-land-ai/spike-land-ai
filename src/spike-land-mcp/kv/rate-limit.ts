/**
 * KV-backed sliding window rate limiter.
 * Replaces Upstash Redis from spike.land.
 */

const WINDOW_MS = 60 * 1000; // 60 seconds
const MAX_REQUESTS = 120;

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

export async function checkRateLimit(
  key: string,
  kv: KVNamespace,
  maxRequests = MAX_REQUESTS,
  windowMs = WINDOW_MS,
): Promise<{ isLimited: boolean; resetAt: number; remaining: number }> {
  const now = Date.now();
  const kvKey = `rl:${key}`;

  const raw = await kv.get(kvKey);
  let entry: RateLimitEntry = { count: 0, windowStart: now };

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as RateLimitEntry;
      // Reset window if expired
      if (now - parsed.windowStart > windowMs) {
        entry = { count: 0, windowStart: now };
      } else {
        entry = parsed;
      }
    } catch {
      entry = { count: 0, windowStart: now };
    }
  }

  entry.count++;
  const resetAt = entry.windowStart + windowMs;
  const isLimited = entry.count > maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  // Fire-and-forget — no need to block the response on KV write
  void kv.put(kvKey, JSON.stringify(entry), {
    expirationTtl: Math.ceil(windowMs / 1000) + 10,
  });

  return { isLimited, resetAt, remaining };
}
