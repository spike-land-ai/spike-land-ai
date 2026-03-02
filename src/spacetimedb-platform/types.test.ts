import { describe, expect, it } from "vitest";
import { errorResult, jsonResult } from "./types.js";

describe("jsonResult", () => {
  it("serializes data as pretty JSON", () => {
    const result = jsonResult({ status: "ok", count: 42 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(JSON.parse(result.content[0].text)).toEqual({ status: "ok", count: 42 });
    expect(result.isError).toBeUndefined();
  });

  it("handles null", () => {
    const result = jsonResult(null);
    expect(JSON.parse(result.content[0].text)).toBeNull();
  });

  it("handles arrays", () => {
    const result = jsonResult([1, 2, 3]);
    expect(JSON.parse(result.content[0].text)).toEqual([1, 2, 3]);
  });

  it("handles strings", () => {
    const result = jsonResult("hello");
    expect(JSON.parse(result.content[0].text)).toBe("hello");
  });
});

describe("errorResult", () => {
  it("creates an error result with code and message", () => {
    const result = errorResult("NOT_CONNECTED", "Not connected to database");
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.error).toBe("NOT_CONNECTED");
    expect(parsed.message).toBe("Not connected to database");
    expect(parsed.retryable).toBe(false);
  });

  it("supports retryable flag", () => {
    const result = errorResult("CONNECTION_FAILED", "Timeout", true);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.retryable).toBe(true);
  });

  it("supports all error codes", () => {
    const codes = [
      "NOT_CONNECTED",
      "CONNECTION_FAILED",
      "REDUCER_FAILED",
      "QUERY_FAILED",
      "NOT_FOUND",
      "INVALID_INPUT",
      "ALREADY_CONNECTED",
      "UNAUTHORIZED",
      "PERMISSION_DENIED",
    ] as const;

    for (const code of codes) {
      const result = errorResult(code, `Error: ${code}`);
      expect(result.isError).toBe(true);
      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toBe(code);
    }
  });
});
