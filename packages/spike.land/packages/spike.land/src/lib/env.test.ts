import { describe, expect, it, vi } from "vitest";
import {
  clientEnvSchema,
  serverEnvSchema,
  validateClientEnv,
  validateServerEnv,
} from "./env";

describe("env validation", () => {
  it("accepts valid required env vars", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/testdb");
    vi.stubEnv("AUTH_SECRET", "test-secret-value");
    vi.stubEnv("NODE_ENV", "test");

    const env = validateServerEnv();
    expect(env.DATABASE_URL).toBe("postgresql://localhost:5432/testdb");
    expect(env.AUTH_SECRET).toBe("test-secret-value");
    expect(env.NODE_ENV).toBe("test");

    vi.unstubAllEnvs();
  });

  it("throws when DATABASE_URL is missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("AUTH_SECRET", "test-secret");

    expect(() => validateServerEnv()).toThrow("DATABASE_URL");

    vi.unstubAllEnvs();
  });

  it("throws when AUTH_SECRET is missing", () => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/testdb");
    vi.stubEnv("AUTH_SECRET", "");

    expect(() => validateServerEnv()).toThrow("AUTH_SECRET");

    vi.unstubAllEnvs();
  });

  it("defaults NODE_ENV to development when not set", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://localhost:5432/testdb",
      AUTH_SECRET: "secret123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NODE_ENV).toBe("development");
    }
  });

  it("rejects invalid NODE_ENV values", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://localhost:5432/testdb",
      AUTH_SECRET: "secret123",
      NODE_ENV: "staging",
    });

    expect(result.success).toBe(false);
  });

  it("coerces PORT to a number", () => {
    const result = serverEnvSchema.safeParse({
      DATABASE_URL: "postgresql://localhost:5432/testdb",
      AUTH_SECRET: "secret123",
      PORT: "3000",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.PORT).toBe(3000);
    }
  });

  it("validates client env schema", () => {
    const result = clientEnvSchema.safeParse({
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_123",
    });

    expect(result.success).toBe(true);
  });

  it("client env validates without any keys", () => {
    vi.stubEnv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "");

    const env = validateClientEnv();
    expect(env).toBeDefined();

    vi.unstubAllEnvs();
  });
});
