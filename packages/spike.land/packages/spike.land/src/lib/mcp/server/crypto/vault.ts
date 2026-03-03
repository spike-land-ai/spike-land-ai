/**
 * Vault Encryption Utilities
 *
 * AES-256-GCM encryption with HKDF-derived per-user keys.
 * Key hierarchy: VAULT_MASTER_KEY -> HKDF(userId) -> userKey
 *
 * Agents can store secrets but NEVER read them back through MCP tools.
 * Decryption is only used internally for proxy-use in tool execution.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "crypto";
import logger from "@/lib/logger";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM standard
const KEY_LENGTH = 32; // 256 bits
const TAG_LENGTH = 16; // GCM auth tag

/**
 * Derive a per-user encryption key from the master key using HMAC-based KDF.
 * Uses HMAC-SHA256 as a simplified HKDF-Extract+Expand for deterministic key derivation.
 */
export function deriveUserKey(masterKey: Buffer, userId: string): Buffer {
  const hmac = createHmac("sha256", masterKey);
  hmac.update(`vault-secret-key:${userId}`);
  return hmac.digest();
}

/**
 * Get the master key from environment.
 * VAULT_MASTER_KEY must be set in all environments.
 * In development, generate one with: node -e "logger.info(require('crypto').randomBytes(32).toString('hex'))"
 */
export function getMasterKey(): Buffer {
  const envKey = process.env.VAULT_MASTER_KEY;
  if (envKey) {
    // Accept hex-encoded or base64-encoded keys
    if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
      return Buffer.from(envKey, "hex");
    }
    return Buffer.from(envKey, "base64");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "VAULT_MASTER_KEY environment variable is required in production. "
        + "Generate one with: node -e \"logger.info(require('crypto').randomBytes(32).toString('hex'))\"",
    );
  }
  // Dev-only fallback -- logged as warning
  logger.warn(
    "[VAULT] Using dev fallback key. Set VAULT_MASTER_KEY for production.",
  );
  const fallback = createHmac("sha256", "spike-land-dev-vault-key");
  fallback.update("dev-master-key");
  return fallback.digest();
}

export interface EncryptedData {
  encryptedValue: string; // base64
  iv: string; // base64
  tag: string; // base64
}

/**
 * Encrypt a plaintext secret for a specific user.
 */
export function encryptSecret(
  userId: string,
  plaintext: string,
): EncryptedData {
  if (!plaintext) {
    return {
      encryptedValue: "",
      iv: "",
      tag: "",
    };
  }

  const masterKey = getMasterKey();
  const userKey = deriveUserKey(masterKey, userId);

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(
    ALGORITHM,
    userKey.subarray(0, KEY_LENGTH),
    iv,
    {
      authTagLength: TAG_LENGTH,
    },
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return {
    encryptedValue: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypt a secret for a specific user.
 * Internal use only -- never exposed through MCP tools.
 */
export function decryptSecret(
  userId: string,
  encryptedValue: string,
  iv: string,
  tag: string,
): string {
  const masterKey = getMasterKey();
  const userKey = deriveUserKey(masterKey, userId);

  const decipher = createDecipheriv(
    ALGORITHM,
    userKey.subarray(0, KEY_LENGTH),
    Buffer.from(iv, "base64"),
    { authTagLength: TAG_LENGTH },
  );

  decipher.setAuthTag(Buffer.from(tag, "base64"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
