/**
 * Constant-time comparison to prevent timing attacks.
 * Uses Web Crypto API compatible approach for Edge runtime (no Node.js crypto dependency).
 *
 * This function is safe to use in:
 * - Edge Middleware
 * - Edge Functions
 * - Node.js Runtime
 *
 * It prevents timing attacks by:
 * 1. Avoiding early returns on length mismatch
 * 2. Performing bitwise XOR on all bytes
 * 3. Including length difference in the final result check
 *
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal, false otherwise
 */
export function secureCompare(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);

  // Include length difference in result to avoid early return on mismatch
  // XORing lengths ensures result is non-zero if lengths differ
  let result = aBytes.length ^ bBytes.length;

  for (let i = 0; i < maxLen; i++) {
    // Accessing out of bounds returns undefined in JS, check for nullish
    // Using ?? 0 ensures consistent bitwise operations even if one string is shorter
    result |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return result === 0;
}
