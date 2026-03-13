const SENSITIVE_PARAMS = new Set([
  "key",
  "token",
  "secret",
  "password",
  "api_key",
  "apikey",
  "access_token",
  "authorization",
]);

/**
 * Timing-safe string comparison to prevent timing attacks.
 * XORs each character code and accumulates the result,
 * ensuring constant-time execution for equal-length strings.
 */
export function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Strips sensitive query parameters from a URL, replacing their
 * values with "[REDACTED]". Returns the original string if the
 * URL cannot be parsed.
 */
export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);

    for (const param of SENSITIVE_PARAMS) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, "[REDACTED]");
      }
    }

    return parsed.toString();
  } catch {
    return url;
  }
}
