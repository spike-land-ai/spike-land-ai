/**
 * Client-safe persona cookie helpers.
 *
 * Cookie name: `spike-persona`
 * Value: persona slug (e.g. "ai-indie", "solo-explorer")
 *
 * For server-side cookie reading, use `get-persona-cookie.server.ts` instead.
 */

const COOKIE_NAME = "spike-persona";
const MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Read the persona cookie on the client.
 * Returns the persona slug or null if not set.
 */
export function getPersonaCookieClient(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find(row => row.startsWith(`${COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.split("=")[1]!) : null;
}

/**
 * Set the persona cookie on the client via document.cookie.
 */
export function setPersonaCookieClient(slug: string): void {
  if (typeof document === "undefined") return;

  document.cookie = `${COOKIE_NAME}=${
    encodeURIComponent(slug)
  }; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

export {
  COOKIE_NAME as PERSONA_COOKIE_NAME,
  MAX_AGE as PERSONA_COOKIE_MAX_AGE,
};
