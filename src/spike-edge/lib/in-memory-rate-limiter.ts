interface RateLimitEntry {
  count: number;
  windowStart: number;
}

interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

export function createRateLimiter(
  options: RateLimiterOptions,
): (key: string) => boolean {
  const map = new Map<string, RateLimitEntry>();
  let lastCleanup = Date.now();

  return (key: string): boolean => {
    const now = Date.now();

    // Periodically clean stale entries to prevent unbounded growth
    if (now - lastCleanup > options.windowMs * 2) {
      lastCleanup = now;
      for (const [k, entry] of map) {
        if (now - entry.windowStart > options.windowMs * 2) {
          map.delete(k);
        }
      }
    }

    const entry = map.get(key);
    if (!entry || now - entry.windowStart > options.windowMs) {
      map.set(key, { count: 1, windowStart: now });
      return false;
    }

    entry.count++;
    return entry.count > options.maxRequests;
  };
}
