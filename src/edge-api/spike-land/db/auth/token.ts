/**
 * Shared token hashing utility for auth modules.
 * Used by both the auth middleware and OAuth route.
 */
export async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
