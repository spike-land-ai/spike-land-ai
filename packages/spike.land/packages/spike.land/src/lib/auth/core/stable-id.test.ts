import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStableUserId } from "./stable-id";

describe("createStableUserId", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.USER_ID_SALT = "test-salt-for-stable-ids";
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("generates deterministic IDs for the same email", () => {
    const id1 = createStableUserId("test@example.com");
    const id2 = createStableUserId("test@example.com");
    expect(id1).toBe(id2);
  });

  it("generates different IDs for different emails", () => {
    const id1 = createStableUserId("alice@example.com");
    const id2 = createStableUserId("bob@example.com");
    expect(id1).not.toBe(id2);
  });

  it("normalizes email to lowercase", () => {
    const id1 = createStableUserId("Test@Example.com");
    const id2 = createStableUserId("test@example.com");
    expect(id1).toBe(id2);
  });

  it("trims whitespace from email", () => {
    const id1 = createStableUserId("  test@example.com  ");
    const id2 = createStableUserId("test@example.com");
    expect(id1).toBe(id2);
  });

  it("returns a string starting with user_", () => {
    const id = createStableUserId("test@example.com");
    expect(id).toMatch(/^user_[a-f0-9]+$/);
  });

  it("falls back to AUTH_SECRET when USER_ID_SALT is not set", () => {
    delete process.env.USER_ID_SALT;
    process.env.AUTH_SECRET = "fallback-secret";
    const id = createStableUserId("test@example.com");
    expect(id).toMatch(/^user_[a-f0-9]+$/);
  });

  it("throws when neither USER_ID_SALT nor AUTH_SECRET is set", () => {
    delete process.env.USER_ID_SALT;
    delete process.env.AUTH_SECRET;
    expect(() => createStableUserId("test@example.com")).toThrow(
      "USER_ID_SALT or AUTH_SECRET environment variable must be set",
    );
  });

  it("prefers USER_ID_SALT over AUTH_SECRET", () => {
    process.env.USER_ID_SALT = "salt-a";
    process.env.AUTH_SECRET = "secret-b";
    const idWithSalt = createStableUserId("test@example.com");

    delete process.env.USER_ID_SALT;
    const idWithSecret = createStableUserId("test@example.com");

    expect(idWithSalt).not.toBe(idWithSecret);
  });
});
