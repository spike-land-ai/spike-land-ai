import { describe, expect, it } from "vitest";
import { generateIdentity, signToken, verifyToken } from "./identity";

const TEST_SECRET = "test-secret-key-for-identity";

describe("identity system", () => {
  it("generateIdentity returns 64-char hex identity and non-empty token", async () => {
    const { identity, token } = await generateIdentity(TEST_SECRET);
    expect(identity).toMatch(/^[0-9a-f]{64}$/);
    expect(token.length).toBeGreaterThan(0);
  });

  it("verifyToken returns identity for valid token", async () => {
    const { identity, token } = await generateIdentity(TEST_SECRET);
    const result = await verifyToken(token, TEST_SECRET);
    expect(result).toBe(identity);
  });

  it("verifyToken returns null for tampered identity", async () => {
    const { token } = await generateIdentity(TEST_SECRET);
    const parts = token.split(".");
    parts[0] = "a".repeat(64);
    const tampered = parts.join(".");
    const result = await verifyToken(tampered, TEST_SECRET);
    expect(result).toBeNull();
  });

  it("verifyToken returns null for tampered signature", async () => {
    const { token } = await generateIdentity(TEST_SECRET);
    const parts = token.split(".");
    parts[2] = "invalid-signature";
    const tampered = parts.join(".");
    const result = await verifyToken(tampered, TEST_SECRET);
    expect(result).toBeNull();
  });

  it("verifyToken returns null for expired token", async () => {
    const { token } = await generateIdentity(TEST_SECRET);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const result = await verifyToken(token, TEST_SECRET, 1);
    expect(result).toBeNull();
  });

  it("signToken creates valid token for existing identity", async () => {
    const { identity } = await generateIdentity(TEST_SECRET);
    const newToken = await signToken(identity, TEST_SECRET);
    const result = await verifyToken(newToken, TEST_SECRET);
    expect(result).toBe(identity);
  });

  it("multiple tokens for same identity all verify correctly", async () => {
    const { identity } = await generateIdentity(TEST_SECRET);
    const tokens = await Promise.all([
      signToken(identity, TEST_SECRET),
      signToken(identity, TEST_SECRET),
      signToken(identity, TEST_SECRET),
    ]);
    for (const token of tokens) {
      const result = await verifyToken(token, TEST_SECRET);
      expect(result).toBe(identity);
    }
  });

  it("token parts are correctly formatted (3 dot-separated parts)", async () => {
    const { token } = await generateIdentity(TEST_SECRET);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]{64}$/); // identity
    expect(Number(parts[1])).toBeGreaterThan(0); // timestamp
    expect(parts[2].length).toBeGreaterThan(0); // signature
  });
});
