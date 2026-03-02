import { describe, expect, it } from "vitest";
import { formatEsbuildError, isEsbuildError } from "./errors.js";

describe("errors", () => {
  describe("isEsbuildError", () => {
    it("identifies objects with 'errors' as esbuild errors", () => {
      expect(isEsbuildError({ errors: [] })).toBe(true);
    });

    it("identifies objects with 'message' as esbuild errors", () => {
      expect(isEsbuildError({ message: "oops" })).toBe(true);
    });

    it("returns false for null or non-objects", () => {
      expect(isEsbuildError(null)).toBe(false);
      expect(isEsbuildError("error")).toBe(false);
      expect(isEsbuildError(42)).toBe(false);
    });
  });

  describe("formatEsbuildError", () => {
    it("formats a standard Error object", () => {
      const err = new Error("something went wrong");
      const result = formatEsbuildError(err);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.errors[0].text).toContain("something went wrong");
    });

    it("formats an esbuild error with specific errors/warnings", () => {
      const err = {
        errors: [{ text: "syntax error", location: null }],
        warnings: [{ text: "unused var" }],
      } as any;
      const result = formatEsbuildError(err);

      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.errors).toHaveLength(1);
      expect(parsed.errors[0].text).toBe("syntax error");
      expect(parsed.warnings).toHaveLength(1);
    });

    it("handles esbuild errors with only message", () => {
      const err = { message: "build failed" } as any;
      const result = formatEsbuildError(err);

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.errors[0].text).toBe("build failed");
      expect(parsed.warnings).toEqual([]);
    });

    it("handles esbuild errors with only message (covers line 28 branch)", () => {
      const err = { message: "msg only" } as any;
      const result = formatEsbuildError(err);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.errors[0].text).toBe("msg only");
    });

    it("handles esbuild errors with errors array (covers line 28 branch)", () => {
      const err = { errors: [{ text: "err array" }] } as any;
      const result = formatEsbuildError(err);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.errors[0].text).toBe("err array");
    });

    it("handles esbuild errors with neither message nor errors (covers line 28 fallback)", () => {
      const err = { something: "else" } as any;
      const result = formatEsbuildError(err);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.errors[0].text).toContain("object");
    });
  });
});
