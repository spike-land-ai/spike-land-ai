import { describe, expect, it } from "vitest";
import { errorResult, jsonResult } from "./types.js";

describe("types", () => {
  describe("jsonResult", () => {
    it("wraps data in MCP content format", () => {
      const result = jsonResult({ foo: "bar", count: 42 });
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe("text");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.foo).toBe("bar");
      expect(parsed.count).toBe(42);
    });

    it("handles null and undefined", () => {
      const result = jsonResult(null);
      expect(JSON.parse(result.content[0].text)).toBeNull();
    });

    it("handles arrays", () => {
      const result = jsonResult([1, 2, 3]);
      expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
    });

    it("does not set isError", () => {
      const result = jsonResult({ ok: true });
      expect(result.isError).toBeUndefined();
    });
  });

  describe("errorResult", () => {
    it("creates error result with code and message", () => {
      const result = errorResult("NOT_CONNECTED", "No active connection");
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe("NOT_CONNECTED");
      expect(parsed.message).toBe("No active connection");
      expect(parsed.retryable).toBe(false);
    });

    it("supports retryable flag", () => {
      const result = errorResult("CONNECTION_FAILED", "Timeout", true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(true);
    });

    it("defaults retryable to false", () => {
      const result = errorResult("INVALID_INPUT", "Bad data");
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.retryable).toBe(false);
    });
  });
});
