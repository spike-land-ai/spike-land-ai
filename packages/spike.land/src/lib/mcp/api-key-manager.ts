import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { createHash, randomBytes, timingSafeEqual } from "crypto";

// API Key Format: PREFIX_<32 random bytes base64url encoded>
// Production prefix: "sk_live_", Development prefix: "sk_test_"

const KEY_PREFIX_PROD = "sk_live_";
const KEY_PREFIX_DEV = "sk_test_";

// Security: Only reveal 7 characters of the key for display (e.g., "sk_live...****")
const VISIBLE_KEY_CHARS = 7;

// Performance: Only update lastUsedAt if more than 5 minutes have passed
const LAST_USED_UPDATE_THRESHOLD_MS = 5 * 60 * 1000;

interface ApiKeyCreateResult {
  id: string;
  name: string;
  key: string; // Full key - only shown once at creation
  keyPrefix: string; // Masked version for display
  createdAt: Date;
}

interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  userId?: string;
  apiKeyId?: string;
  error?: string;
}

/**
 * Generates a new API key
 * @returns Object containing the full key, its hash, and a masked prefix
 */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const prefix = process.env.NODE_ENV === "production" ? KEY_PREFIX_PROD : KEY_PREFIX_DEV;
  const keyBody = randomBytes(32).toString("base64url");
  const fullKey = prefix + keyBody;
  const hash = createHash("sha256").update(fullKey).digest("hex");
  // Security: Only reveal VISIBLE_KEY_CHARS characters for display
  const maskedPrefix = fullKey.slice(0, VISIBLE_KEY_CHARS) + "...****";

  return { key: fullKey, hash, prefix: maskedPrefix };
}

/**
 * Hashes an API key for database lookup indexing.
 *
 * Security note: SHA-256 is appropriate here because API keys are
 * cryptographically random (randomBytes(32), ~256 bits of entropy).
 * This is NOT a password hash — it is a fast lookup index for
 * high-entropy random tokens. bcrypt/Argon2 are designed for low-entropy
 * secrets (passwords); using them here would add latency with no security
 * benefit. OWASP confirms fast hashing is acceptable for high-entropy tokens.
 * See: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html
 */
function hashApiKey(key: string): string {
  // lgtm[js/insufficient-password-hash] — not a password; high-entropy random API key
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Creates a new API key for a user
 */
export async function createApiKey(userId: string, name: string): Promise<ApiKeyCreateResult> {
  const { key, hash, prefix } = generateApiKey();

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyHash: hash,
      keyPrefix: prefix,
    },
  });

  return {
    id: apiKey.id,
    name: apiKey.name,
    key, // Return full key only at creation time
    keyPrefix: prefix,
    createdAt: apiKey.createdAt,
  };
}

/**
 * Validates an API key and returns the associated user ID
 * Uses constant-time comparison to prevent timing attacks
 */
export async function validateApiKey(providedKey: string): Promise<ApiKeyValidationResult> {
  // Validate format
  if (!providedKey.startsWith(KEY_PREFIX_PROD) && !providedKey.startsWith(KEY_PREFIX_DEV)) {
    return { isValid: false, error: "Invalid API key format" };
  }

  // Security: Reject development keys in production environment
  if (process.env.NODE_ENV === "production" && providedKey.startsWith(KEY_PREFIX_DEV)) {
    return {
      isValid: false,
      error: "Development keys not allowed in production",
    };
  }

  // Hash the provided key
  const providedHash = hashApiKey(providedKey);

  // Look up the key in the database
  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: providedHash },
    select: {
      id: true,
      userId: true,
      isActive: true,
      keyHash: true,
      lastUsedAt: true,
    },
  });

  if (!apiKey) {
    return { isValid: false, error: "Invalid API key" };
  }

  if (!apiKey.isActive) {
    return { isValid: false, error: "API key has been revoked" };
  }

  // Use constant-time comparison to prevent timing attacks
  const providedHashBuffer = Buffer.from(providedHash, "hex");
  const storedHashBuffer = Buffer.from(apiKey.keyHash, "hex");

  if (!timingSafeEqual(providedHashBuffer, storedHashBuffer)) {
    return { isValid: false, error: "Invalid API key" };
  }

  // Update lastUsedAt in the background (fire-and-forget)
  // Performance: Only update if more than 5 minutes have passed
  const now = Date.now();
  const lastUsed = apiKey.lastUsedAt?.getTime() ?? 0;
  if (now - lastUsed > LAST_USED_UPDATE_THRESHOLD_MS) {
    // Fire-and-forget: tryCatch handles errors silently (non-critical update)
    void tryCatch(
      prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      }),
    );
  }

  return {
    isValid: true,
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
  };
}

/**
 * Lists all API keys for a user (masked)
 */
export async function listApiKeys(userId: string): Promise<ApiKeyListItem[]> {
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return apiKeys;
}

/**
 * Revokes an API key (soft delete)
 */
export async function revokeApiKey(
  userId: string,
  apiKeyId: string,
): Promise<{ success: boolean; error?: string }> {
  // Verify the key belongs to the user
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
  });

  if (!apiKey) {
    return { success: false, error: "API key not found" };
  }

  if (!apiKey.isActive) {
    return { success: false, error: "API key is already revoked" };
  }

  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: { isActive: false },
  });

  return { success: true };
}

/**
 * Gets a single API key by ID (for the owner)
 */
export async function getApiKey(userId: string, apiKeyId: string): Promise<ApiKeyListItem | null> {
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      id: apiKeyId,
      userId,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      isActive: true,
      createdAt: true,
    },
  });

  return apiKey;
}

/**
 * Counts active API keys for a user
 */
export async function countActiveApiKeys(userId: string): Promise<number> {
  return prisma.apiKey.count({
    where: {
      userId,
      isActive: true,
    },
  });
}

// Maximum number of API keys per user
export const MAX_API_KEYS_PER_USER = 10;
