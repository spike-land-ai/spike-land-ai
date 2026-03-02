import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt } from "./jwt";

const SECRET = "test-jwt-secret-at-least-32-chars-long";

describe("JWT sign + verify", () => {
  it("roundtrip: sign then verify returns original payload", async () => {
    const payload = { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signJwt(payload, SECRET);

    expect(typeof token).toBe("string");
    expect(token.split(".")).toHaveLength(3);

    const result = await verifyJwt(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe("user-123");
    expect(result!.iat).toBeTypeOf("number");
  });

  it("preserves custom fields in payload", async () => {
    const payload = { sub: "user-456", exp: Math.floor(Date.now() / 1000) + 3600, role: "admin" };
    const token = await signJwt(payload, SECRET);
    const result = await verifyJwt(token, SECRET);

    expect(result).not.toBeNull();
    expect(result!.role).toBe("admin");
  });

  it("rejects token signed with different secret", async () => {
    const payload = { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signJwt(payload, SECRET);

    const result = await verifyJwt(token, "wrong-secret-that-is-different!!");
    expect(result).toBeNull();
  });

  it("rejects expired token", async () => {
    // Create a token that expired 10 seconds ago
    const payload = { sub: "user-123", exp: Math.floor(Date.now() / 1000) - 10 };
    const token = await signJwt(payload, SECRET);

    const result = await verifyJwt(token, SECRET);
    expect(result).toBeNull();
  });

  it("rejects malformed token (missing parts)", async () => {
    const result = await verifyJwt("not.a.valid.token.with.extra", SECRET);
    expect(result).toBeNull();

    const result2 = await verifyJwt("onlyonepart", SECRET);
    expect(result2).toBeNull();
  });

  it("rejects token with tampered payload", async () => {
    const payload = { sub: "user-123", exp: Math.floor(Date.now() / 1000) + 3600 };
    const token = await signJwt(payload, SECRET);
    const parts = token.split(".");

    // Tamper with the payload (change a character)
    const tamperedPayload = parts[1]!.slice(0, -1) + "X";
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const result = await verifyJwt(tamperedToken, SECRET);
    expect(result).toBeNull();
  });
});
