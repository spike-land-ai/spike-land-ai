/**
 * Stable user ID generation.
 *
 * Extracted from auth.config.ts so it can be used independently
 * of any auth framework. This function MUST produce identical output
 * to the original — changing IDs means data loss.
 *
 * Uses a simple hash for Edge runtime / CF Workers compatibility.
 * No Node.js crypto required.
 */

/**
 * Creates a stable user ID based on email address.
 * This ensures the same user gets the same ID regardless of OAuth provider.
 *
 * Uses USER_ID_SALT (preferred) or falls back to AUTH_SECRET.
 * USER_ID_SALT should never be rotated as it would change all user IDs.
 *
 * IMPORTANT: User IDs are tied to email addresses. If a user changes their
 * email address (at the OAuth provider level), they will get a new user ID
 * and lose access to their previous data.
 */
export function createStableUserId(email: string): string {
  const salt = process.env.USER_ID_SALT || process.env.AUTH_SECRET;
  if (!salt) {
    throw new Error(
      "USER_ID_SALT or AUTH_SECRET environment variable must be set for stable user IDs",
    );
  }
  // Use simple hash for Edge runtime compatibility
  // Combines salt + email and creates a deterministic hash
  const input = `${salt}:${email.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex and pad to ensure consistent length
  const hexHash = Math.abs(hash).toString(16).padStart(8, "0");
  // Add more entropy by hashing again with different positions
  let hash2 = 0;
  for (let i = input.length - 1; i >= 0; i--) {
    const char = input.charCodeAt(i);
    hash2 = ((hash2 << 7) - hash2) + char;
    hash2 = hash2 & hash2;
  }
  const hexHash2 = Math.abs(hash2).toString(16).padStart(8, "0");
  return `user_${hexHash}${hexHash2}${hexHash}${hexHash2}`;
}
