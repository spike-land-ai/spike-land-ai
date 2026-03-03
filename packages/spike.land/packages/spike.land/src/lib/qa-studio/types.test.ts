import { describe, expect, it } from "vitest";
import { isActionError } from "./types";

describe("qa-studio/types", () => {
  describe("isActionError", () => {
    it("should return true for objects with error property", () => {
      expect(isActionError({ error: "something went wrong" })).toBe(true);
    });

    it("should return true for objects with empty string error", () => {
      expect(isActionError({ error: "" })).toBe(true);
    });

    it("should return false for null", () => {
      expect(isActionError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isActionError(undefined)).toBe(false);
    });

    it("should return false for primitives", () => {
      expect(isActionError("string")).toBe(false);
      expect(isActionError(42)).toBe(false);
      expect(isActionError(true)).toBe(false);
    });

    it("should return false for objects without error property", () => {
      expect(isActionError({ url: "https://example.com" })).toBe(false);
      expect(isActionError({})).toBe(false);
    });

    it("should return true for objects with error and other properties", () => {
      expect(isActionError({ error: "fail", code: 500 })).toBe(true);
    });
  });
});
