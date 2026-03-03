import { describe, expect, it, vi } from "vitest";

import { validateCronSecret } from "./cron-auth";

function makeRequest(headers: Record<string, string>) {
  return {
    headers: {
      get(name: string) {
        return headers[name.toLowerCase()] ?? null;
      },
    },
  };
}

describe("validateCronSecret", () => {
  it("returns false when CRON_SECRET is not set in production", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({});
    expect(validateCronSecret(req)).toBe(false);
  });

  it("returns true when CRON_SECRET is not set in development", () => {
    vi.stubEnv("CRON_SECRET", "");
    vi.stubEnv("NODE_ENV", "development");
    const req = makeRequest({});
    expect(validateCronSecret(req)).toBe(true);
  });

  it("validates Bearer token in authorization header", () => {
    vi.stubEnv("CRON_SECRET", "my-secret-123");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({ authorization: "Bearer my-secret-123" });
    expect(validateCronSecret(req)).toBe(true);
  });

  it("rejects wrong Bearer token", () => {
    vi.stubEnv("CRON_SECRET", "my-secret-123");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({ authorization: "Bearer wrong-secret" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("validates x-cron-secret header", () => {
    vi.stubEnv("CRON_SECRET", "cron-key-abc");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({ "x-cron-secret": "cron-key-abc" });
    expect(validateCronSecret(req)).toBe(true);
  });

  it("rejects wrong x-cron-secret header", () => {
    vi.stubEnv("CRON_SECRET", "cron-key-abc");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({ "x-cron-secret": "bad-key" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("rejects when no auth headers are present", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({});
    expect(validateCronSecret(req)).toBe(false);
  });

  it("rejects authorization header without Bearer prefix", () => {
    vi.stubEnv("CRON_SECRET", "my-secret");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({ authorization: "Basic my-secret" });
    expect(validateCronSecret(req)).toBe(false);
  });

  it("rejects token with different length (timing-safe length check)", () => {
    vi.stubEnv("CRON_SECRET", "short");
    vi.stubEnv("NODE_ENV", "production");
    const req = makeRequest({ authorization: "Bearer much-longer-token-here" });
    expect(validateCronSecret(req)).toBe(false);
  });
});
