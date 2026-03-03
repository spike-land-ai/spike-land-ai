import { describe, expect, it } from "vitest";
import { secureCompare } from "./timing";

describe("secureCompare", () => {
  it("should return true for identical strings", () => {
    expect(secureCompare("hello", "hello")).toBe(true);
  });

  it("should return false for different strings", () => {
    expect(secureCompare("hello", "world")).toBe(false);
  });

  it("should return false for different lengths", () => {
    expect(secureCompare("short", "a longer string")).toBe(false);
  });

  it("should return true for empty strings", () => {
    expect(secureCompare("", "")).toBe(true);
  });

  it("should return false when one is empty", () => {
    expect(secureCompare("", "something")).toBe(false);
    expect(secureCompare("something", "")).toBe(false);
  });

  it("should handle unicode strings", () => {
    expect(secureCompare("hello", "hello")).toBe(true);
    expect(secureCompare("hello", "hellx")).toBe(false);
  });

  it("should handle strings that differ only in last character", () => {
    expect(secureCompare("abcde", "abcdf")).toBe(false);
  });

  it("should handle special characters", () => {
    const token = "sk_live_abc123!@#$%^&*()";
    expect(secureCompare(token, token)).toBe(true);
    expect(secureCompare(token, token + "x")).toBe(false);
  });
});
