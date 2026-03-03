import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  decryptSecret,
  deriveUserKey,
  encryptSecret,
  getMasterKey,
} from "./vault";

describe("vault crypto", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.stubEnv("VAULT_MASTER_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  describe("getMasterKey", () => {
    it("should return a 32-byte key from dev fallback", () => {
      const key = getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it("should use hex-encoded env var when set", () => {
      const hexKey = "a".repeat(64);
      vi.stubEnv("VAULT_MASTER_KEY", hexKey);
      const key = getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
      expect(key.toString("hex")).toBe(hexKey);
    });

    it("should use base64-encoded env var when set", () => {
      const buf = Buffer.alloc(32, 0xab);
      vi.stubEnv("VAULT_MASTER_KEY", buf.toString("base64"));
      const key = getMasterKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.toString("hex")).toBe(buf.toString("hex"));
    });

    it("should throw in production when VAULT_MASTER_KEY is missing", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("VAULT_MASTER_KEY", "");
      expect(() => getMasterKey()).toThrow(
        "VAULT_MASTER_KEY environment variable is required in production",
      );
    });
  });

  describe("deriveUserKey", () => {
    it("should derive a 32-byte key", () => {
      const masterKey = getMasterKey();
      const userKey = deriveUserKey(masterKey, "user-123");
      expect(userKey).toBeInstanceOf(Buffer);
      expect(userKey.length).toBe(32);
    });

    it("should derive different keys for different users", () => {
      const masterKey = getMasterKey();
      const key1 = deriveUserKey(masterKey, "user-1");
      const key2 = deriveUserKey(masterKey, "user-2");
      expect(key1.toString("hex")).not.toBe(key2.toString("hex"));
    });

    it("should derive the same key for the same user deterministically", () => {
      const masterKey = getMasterKey();
      const key1 = deriveUserKey(masterKey, "user-1");
      const key2 = deriveUserKey(masterKey, "user-1");
      expect(key1.toString("hex")).toBe(key2.toString("hex"));
    });
  });

  describe("encryptSecret / decryptSecret", () => {
    it("should encrypt and decrypt a secret round-trip", () => {
      const plaintext = "my-super-secret-api-key";
      const { encryptedValue, iv, tag } = encryptSecret("user-1", plaintext);

      expect(encryptedValue).toBeTruthy();
      expect(iv).toBeTruthy();
      expect(tag).toBeTruthy();

      const decrypted = decryptSecret("user-1", encryptedValue, iv, tag);
      expect(decrypted).toBe(plaintext);
    });

    it("should produce different ciphertext for the same plaintext (random IV)", () => {
      const plaintext = "same-secret";
      const result1 = encryptSecret("user-1", plaintext);
      const result2 = encryptSecret("user-1", plaintext);

      expect(result1.iv).not.toBe(result2.iv);
      expect(result1.encryptedValue).not.toBe(result2.encryptedValue);
    });

    it("should fail to decrypt with a different user's key", () => {
      const plaintext = "user-1-secret";
      const { encryptedValue, iv, tag } = encryptSecret("user-1", plaintext);

      expect(() => decryptSecret("user-2", encryptedValue, iv, tag)).toThrow();
    });

    it("should fail to decrypt with tampered ciphertext", () => {
      const { encryptedValue, iv, tag } = encryptSecret("user-1", "secret");
      const tampered = Buffer.from(encryptedValue, "base64");
      tampered[0] = tampered[0]! ^ 0xff;
      expect(() => decryptSecret("user-1", tampered.toString("base64"), iv, tag)).toThrow();
    });

    it("should fail to decrypt with tampered tag", () => {
      const { encryptedValue, iv, tag } = encryptSecret("user-1", "secret");
      const tampered = Buffer.from(tag, "base64");
      tampered[0] = tampered[0]! ^ 0xff;
      expect(() => decryptSecret("user-1", encryptedValue, iv, tampered.toString("base64")))
        .toThrow();
    });

    it("should handle unicode and special characters", () => {
      const plaintext = "🔑 my-key with spaces & special chars: <>'\"\\n\\t";
      const { encryptedValue, iv, tag } = encryptSecret("user-1", plaintext);
      const decrypted = decryptSecret("user-1", encryptedValue, iv, tag);
      expect(decrypted).toBe(plaintext);
    });

    it("should handle empty-ish edge cases gracefully", () => {
      const plaintext = "x"; // minimal
      const { encryptedValue, iv, tag } = encryptSecret("user-1", plaintext);
      const decrypted = decryptSecret("user-1", encryptedValue, iv, tag);
      expect(decrypted).toBe(plaintext);

      // Branch coverage: empty/null secret
      expect(encryptSecret("user-1", "" as any).encryptedValue).toBe("");
      expect(encryptSecret("user-1", null as any).encryptedValue).toBe("");
    });
  });
});
