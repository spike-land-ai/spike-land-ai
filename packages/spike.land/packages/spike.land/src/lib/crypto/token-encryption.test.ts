import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";

// Generate a valid 256-bit key for testing
const TEST_KEY = crypto.randomBytes(32).toString("hex");

describe("token-encryption", () => {
  beforeEach(() => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Re-import fresh each time to pick up env changes
  async function getModule() {
    return import("./token-encryption");
  }

  describe("encryptToken", () => {
    it("should encrypt a plaintext token", async () => {
      const { encryptToken } = await getModule();
      const encrypted = encryptToken("my-secret-token");
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe("my-secret-token");
      // Format: iv:authTag:ciphertext
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
    });

    it("should produce different ciphertexts for same input (random IV)", async () => {
      const { encryptToken } = await getModule();
      const a = encryptToken("same-token");
      const b = encryptToken("same-token");
      expect(a).not.toBe(b);
    });

    it("should throw for empty token", async () => {
      const { encryptToken } = await getModule();
      expect(() => encryptToken("")).toThrow("Cannot encrypt empty token");
    });
  });

  describe("decryptToken", () => {
    it("should decrypt back to original plaintext", async () => {
      const { encryptToken, decryptToken } = await getModule();
      const encrypted = encryptToken("hello-world");
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe("hello-world");
    });

    it("should throw for empty data", async () => {
      const { decryptToken } = await getModule();
      expect(() => decryptToken("")).toThrow("Cannot decrypt empty data");
    });

    it("should throw for invalid format (not 3 parts)", async () => {
      const { decryptToken } = await getModule();
      expect(() => decryptToken("invalid")).toThrow("Invalid encrypted data format");
    });

    it("should throw for empty components", async () => {
      const { decryptToken } = await getModule();
      expect(() => decryptToken("::")).toThrow("missing components");
    });

    it("should throw for corrupted ciphertext", async () => {
      const { encryptToken, decryptToken } = await getModule();
      const encrypted = encryptToken("test");
      const parts = encrypted.split(":");
      // Corrupt the ciphertext
      parts[2] = "00".repeat(parts[2]!.length / 2);
      expect(() => decryptToken(parts.join(":"))).toThrow("Failed to decrypt");
    });
  });

  describe("isEncrypted", () => {
    it("should return true for encrypted data", async () => {
      const { encryptToken, isEncrypted } = await getModule();
      const encrypted = encryptToken("test");
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it("should return false for empty string", async () => {
      const { isEncrypted } = await getModule();
      expect(isEncrypted("")).toBe(false);
    });

    it("should return false for plain text", async () => {
      const { isEncrypted } = await getModule();
      expect(isEncrypted("just-a-plain-token")).toBe(false);
    });

    it("should return false for wrong number of parts", async () => {
      const { isEncrypted } = await getModule();
      expect(isEncrypted("part1:part2")).toBe(false);
      expect(isEncrypted("part1:part2:part3:part4")).toBe(false);
    });

    it("should return false for non-hex parts", async () => {
      const { isEncrypted } = await getModule();
      expect(isEncrypted("zzzz:yyyy:xxxx")).toBe(false);
    });

    it("should return false for wrong IV length", async () => {
      const { isEncrypted } = await getModule();
      // IV should be 32 hex chars (16 bytes)
      expect(isEncrypted("aa:bb:cc")).toBe(false);
    });
  });

  describe("safeEncryptToken", () => {
    it("should encrypt when key is available", async () => {
      const { safeEncryptToken, isEncrypted } = await getModule();
      const result = safeEncryptToken("my-token");
      expect(isEncrypted(result)).toBe(true);
    });

    it("should return empty string for empty input", async () => {
      const { safeEncryptToken } = await getModule();
      expect(safeEncryptToken("")).toBe("");
    });

    it("should return plaintext when key is not configured", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      const { safeEncryptToken } = await getModule();
      const result = safeEncryptToken("my-token");
      expect(result).toBe("my-token");
    });

    it("should throw when throwOnMissingKey is true and key missing", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      const { safeEncryptToken } = await getModule();
      expect(() => safeEncryptToken("my-token", { throwOnMissingKey: true })).toThrow(
        "is not configured",
      );
    });

    it("should throw for invalid key length", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "aabbcc"); // too short
      const { safeEncryptToken } = await getModule();
      expect(() => safeEncryptToken("my-token")).toThrow("must be a");
    });
  });

  describe("safeDecryptToken", () => {
    it("should decrypt encrypted data", async () => {
      const { encryptToken, safeDecryptToken } = await getModule();
      const encrypted = encryptToken("secret");
      const result = safeDecryptToken(encrypted);
      expect(result).toBe("secret");
    });

    it("should return empty string for empty input", async () => {
      const { safeDecryptToken } = await getModule();
      expect(safeDecryptToken("")).toBe("");
    });

    it("should return plaintext for non-encrypted data", async () => {
      const { safeDecryptToken } = await getModule();
      expect(safeDecryptToken("plain-token")).toBe("plain-token");
    });

    it("should return data as-is if decryption fails (migration support)", async () => {
      const { safeDecryptToken } = await getModule();
      // Craft data that looks encrypted but has wrong key
      const fakeIv = "a".repeat(32);
      const fakeTag = "b".repeat(32);
      const fakeCipher = "cc";
      const fakeEncrypted = `${fakeIv}:${fakeTag}:${fakeCipher}`;
      // Should return as-is since decryption fails
      const result = safeDecryptToken(fakeEncrypted);
      expect(result).toBe(fakeEncrypted);
    });
  });

  describe("missing encryption key", () => {
    it("should throw when encrypting without key", async () => {
      vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
      const { encryptToken } = await getModule();
      expect(() => encryptToken("test")).toThrow("is not configured");
    });
  });
});
