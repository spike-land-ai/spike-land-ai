/**
 * Token Encryption Utilities
 *
 * AES-256-GCM encryption for sensitive tokens (OAuth access/refresh tokens)
 * Uses Node.js crypto module for secure encryption.
 */

import { tryCatchSync } from "@/lib/try-catch";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

/**
 * Get the encryption key from environment
 * @throws Error if key is not configured or invalid
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;

  if (!keyHex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY environment variable is not configured. "
        + "Generate one with: node -e \"logger.info(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }

  const key = Buffer.from(keyHex, "hex");

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY must be a ${
        KEY_LENGTH * 2
      }-character hex string (${KEY_LENGTH} bytes). `
        + `Current length: ${keyHex.length} characters.`,
    );
  }

  return key;
}

/**
 * Encrypt a plaintext token
 *
 * @param plaintext - The token to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex encoded)
 * @throws Error if encryption fails or key is not configured
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    throw new Error("Cannot encrypt empty token");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted token
 *
 * @param encryptedData - The encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext token
 * @throws Error if decryption fails, data is corrupted, or key is wrong
 */
export function decryptToken(encryptedData: string): string {
  if (!encryptedData) {
    throw new Error("Cannot decrypt empty data");
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error(
      "Invalid encrypted data format. Expected format: iv:authTag:ciphertext",
    );
  }

  const [ivHex, authTagHex, encrypted] = parts;

  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error("Invalid encrypted data: missing components");
  }

  const key = getEncryptionKey();

  const { data: decrypted, error } = tryCatchSync<string>(() => {
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex"),
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

    let res = decipher.update(encrypted, "hex", "utf8");
    res += decipher.final("utf8");
    return res;
  });

  if (error) {
    // Don't expose crypto details in error message
    throw new Error(
      "Failed to decrypt token. The data may be corrupted or the encryption key may have changed.",
    );
  }

  return decrypted!;
}

/**
 * Check if a string appears to be encrypted
 * (has the expected format: iv:authTag:ciphertext)
 *
 * @param data - String to check
 * @returns true if the string appears to be encrypted
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false;

  const parts = data.split(":");
  if (parts.length !== 3) return false;

  const ivHex = parts[0];
  const authTagHex = parts[1];
  const encrypted = parts[2];

  // Ensure all parts are defined (TypeScript narrowing)
  if (!ivHex || !authTagHex || !encrypted) return false;

  // Check that all parts are valid hex strings of expected lengths
  // IV: 16 bytes = 32 hex chars
  // AuthTag: 16 bytes = 32 hex chars
  // Encrypted: variable length
  const HEX_REGEX = /^[a-fA-F0-9]+$/;

  return (
    ivHex.length === 32
    && HEX_REGEX.test(ivHex)
    && authTagHex.length === 32
    && HEX_REGEX.test(authTagHex)
    && encrypted.length > 0
    && HEX_REGEX.test(encrypted)
  );
}

/**
 * Safely encrypt a token, returning the original if encryption is not configured
 * This is useful for development environments where encryption may not be set up
 *
 * @param plaintext - The token to encrypt
 * @param options - Options for handling missing key
 * @returns Encrypted token or original if encryption unavailable
 */
export function safeEncryptToken(
  plaintext: string,
  options?: { throwOnMissingKey?: boolean; },
): string {
  if (!plaintext) return plaintext;

  const { data: encrypted, error } = tryCatchSync<string>(() => encryptToken(plaintext));

  if (error) {
    // Only catch the "not configured" error, not "wrong length" errors
    if (
      error instanceof Error
      && error.message.includes("is not configured")
    ) {
      if (options?.throwOnMissingKey) {
        throw error;
      }
      // Log warning in development
      if (process.env.NODE_ENV === "development") {
        logger.warn(
          "[token-encryption] TOKEN_ENCRYPTION_KEY not configured. Tokens will be stored unencrypted.",
        );
      }
      return plaintext;
    }
    throw error;
  }

  return encrypted!;
}

/**
 * Safely decrypt a token, returning the original if it doesn't appear encrypted
 * This handles migration from unencrypted to encrypted tokens
 *
 * @param data - The token to decrypt (may be encrypted or plaintext)
 * @returns Decrypted token or original if not encrypted
 */
export function safeDecryptToken(data: string): string {
  if (!data) return data;

  // If it doesn't look encrypted, return as-is (migration support)
  if (!isEncrypted(data)) {
    return data;
  }

  const { data: decrypted, error } = tryCatchSync<string>(() => decryptToken(data));

  if (error) {
    // If decryption fails, it might be an old unencrypted token that
    // happens to match the format. Return as-is.
    if (process.env.NODE_ENV === "development") {
      logger.warn(
        "[token-encryption] Failed to decrypt token, returning as-is",
        { error: error instanceof Error ? error.message : "Unknown error" },
      );
    }
    return data;
  }

  return decrypted!;
}
