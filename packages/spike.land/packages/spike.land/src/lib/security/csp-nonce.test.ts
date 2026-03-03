import { describe, expect, it } from "vitest";
import { CSP_NONCE_HEADER, generateNonce } from "./csp-nonce";

describe("csp-nonce", () => {
  it("should export the correct header name", () => {
    expect(CSP_NONCE_HEADER).toBe("x-nonce");
  });

  it("should generate a non-empty base64 nonce", () => {
    const nonce = generateNonce();
    expect(nonce).toBeTruthy();
    expect(typeof nonce).toBe("string");
    expect(nonce.length).toBeGreaterThan(0);
  });

  it("should generate unique nonces", () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).not.toBe(nonce2);
  });

  it("should produce valid base64 output", () => {
    const nonce = generateNonce();
    // Base64 characters: A-Z, a-z, 0-9, +, /, =
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});
