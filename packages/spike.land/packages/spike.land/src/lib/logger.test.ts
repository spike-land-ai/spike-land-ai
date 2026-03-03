import { describe, expect, it } from "vitest";
import { sanitizeLogData } from "./logger";

describe("logger.ts sanitization", () => {
  it("scrubs emails string", () => {
    const input = "User test@example.com logged in";
    const sanitized = sanitizeLogData(input);
    expect(sanitized).toBe("User [REDACTED] logged in");
  });

  it("scrubs tokens from URL strings", () => {
    const input = "Failed request to /api/data?token=eyJhbGciOiJIUzI1NiIsIn.xyz";
    const sanitized = sanitizeLogData(input);
    expect(sanitized).toBe("Failed request to /api/data?token=[REDACTED]");
  });

  it("scrubs Bearer tokens", () => {
    const input = "Authorization: Bearer super-secret-jwt";
    const sanitized = sanitizeLogData(input);
    expect(sanitized).toBe("Authorization: Bearer [REDACTED]");
  });

  it("replaces keys in objects ending in 'key', 'token', 'secret', 'password'", () => {
    const input = {
      message: "Processing webhook",
      apiKey: "sk_live_123456789",
      stripeSecret: "rk_live_foo",
      userPassword: "my_password",
      refreshToken: "abc123yz",
      normal: "this is normal",
    };

    const sanitized = sanitizeLogData(input) as Record<string, unknown>;

    expect(sanitized.apiKey).toBe("[REDACTED]");
    expect(sanitized.stripeSecret).toBe("[REDACTED]");
    expect(sanitized.userPassword).toBe("[REDACTED]");
    expect(sanitized.refreshToken).toBe("[REDACTED]");
    expect(sanitized.normal).toBe("this is normal");
  });

  it("sanitizes arrays recursively", () => {
    const input = [
      "test@example.com",
      { accessToken: "foo" },
    ];

    const sanitized = sanitizeLogData(input) as unknown[];
    expect(sanitized[0]).toBe("[REDACTED]");
    expect((sanitized[1] as any).accessToken).toBe("[REDACTED]");
  });

  it("sanitizes Error objects", () => {
    const err = new Error("Failed for test@example.com");
    err.name = "MyError";

    vi.stubEnv("NODE_ENV", "production");

    const sanitized = sanitizeLogData(err) as Record<string, unknown>;

    expect(sanitized.name).toBe("MyError");
    expect(sanitized.message).toBe("Failed for [REDACTED]");
    expect(sanitized.stack).toBeUndefined(); // In prod, stack is removed

    vi.unstubAllEnvs();
  });
});
