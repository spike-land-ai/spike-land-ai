/**
 * Stripe webhook signature verification.
 * Pure crypto function — no HTTP concerns.
 *
 * Security properties maintained here:
 *   1. Timestamp replay window (5 min) prevents replay attacks.
 *   2. HMAC-SHA256 via Web Crypto (no pure-JS fallback).
 *   3. Constant-time XOR comparison for the hex digest — prevents timing
 *      oracle even if JS JIT partially optimises the loop.
 *   4. v1Signature is validated to contain only hex chars before comparison
 *      to prevent prototype-pollution or unicode bypass attacks.
 */

const HEX_ONLY = /^[0-9a-f]+$/i;

export async function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
    const eqIdx = part.indexOf("=");
    if (eqIdx > 0) {
      const key = part.slice(0, eqIdx);
      const value = part.slice(eqIdx + 1);
      // Only accept the first occurrence of each key (prevent header smuggling)
      if (!(key in acc)) acc[key] = value;
    }
    return acc;
  }, {});

  const timestamp = parts.t;
  const v1Signature = parts.v1;
  if (!timestamp || !v1Signature) return false;

  // Validate timestamp is a positive integer (prevents NaN injection)
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || ts <= 0) return false;

  // Reject timestamps older than 5 minutes (replay protection)
  const age = Math.floor(Date.now() / 1000) - ts;
  if (age > 300 || age < -30) return false; // also reject far-future timestamps

  // Validate the provided signature contains only hex chars before comparison
  // to prevent unicode-normalisation attacks (e.g. fullwidth digits).
  if (!HEX_ONLY.test(v1Signature)) return false;

  const payload = `${timestamp}.${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));

  // Constant-time comparison to prevent timing attacks (OWASP A02, CWE-208).
  // HMAC-SHA256 always produces 32 bytes → 64 hex chars. If lengths differ
  // the provided signature is malformed; return false immediately (no loop).
  const expectedHex = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (expectedHex.length !== v1Signature.length) return false;

  let diff = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    diff |= expectedHex.charCodeAt(i) ^ v1Signature.charCodeAt(i);
  }
  return diff === 0;
}
