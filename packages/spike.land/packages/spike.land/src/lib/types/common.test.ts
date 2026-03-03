import { describe, expect, it } from "vitest";

import {
  hasCodeProperty,
  hasResponseProperty,
  hasStatusProperty,
  isFacebookErrorResponse,
  isLinkedInErrorResponse,
  isLinkedInRateLimitError,
} from "./common";

describe("isFacebookErrorResponse", () => {
  it("returns true for valid Facebook error", () => {
    const body = { error: { code: 190, message: "Invalid token" } };
    expect(isFacebookErrorResponse(body)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isFacebookErrorResponse(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isFacebookErrorResponse("string")).toBe(false);
  });

  it("returns false when error is not object", () => {
    expect(isFacebookErrorResponse({ error: "string" })).toBe(false);
  });

  it("returns false when error is null", () => {
    expect(isFacebookErrorResponse({ error: null })).toBe(false);
  });

  it("returns false when error has no code", () => {
    expect(isFacebookErrorResponse({ error: { message: "test" } })).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isFacebookErrorResponse({})).toBe(false);
  });
});

describe("isLinkedInRateLimitError", () => {
  it("returns true for status 429", () => {
    expect(isLinkedInRateLimitError({ status: 429 })).toBe(true);
  });

  it("returns true for rate limit message", () => {
    expect(
      isLinkedInRateLimitError({ message: "Rate Limit Exceeded" }),
    ).toBe(true);
  });

  it("returns false for regular error", () => {
    expect(
      isLinkedInRateLimitError({ status: 500, message: "Server error" }),
    ).toBe(false);
  });

  it("returns false for null", () => {
    expect(isLinkedInRateLimitError(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isLinkedInRateLimitError(42)).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isLinkedInRateLimitError({})).toBe(false);
  });
});

describe("isLinkedInErrorResponse", () => {
  it("returns true when status present", () => {
    expect(isLinkedInErrorResponse({ status: 400 })).toBe(true);
  });

  it("returns true when message present", () => {
    expect(isLinkedInErrorResponse({ message: "error" })).toBe(true);
  });

  it("returns true when serviceErrorCode present", () => {
    expect(isLinkedInErrorResponse({ serviceErrorCode: 123 })).toBe(true);
  });

  it("returns false for null", () => {
    expect(isLinkedInErrorResponse(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(isLinkedInErrorResponse("string")).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(isLinkedInErrorResponse({})).toBe(false);
  });
});

describe("hasCodeProperty", () => {
  it("returns true for error with string code", () => {
    const err = Object.assign(new Error("test"), { code: "ENOENT" });
    expect(hasCodeProperty(err)).toBe(true);
  });

  it("returns true for error with number code", () => {
    const err = Object.assign(new Error("test"), { code: 42 });
    expect(hasCodeProperty(err)).toBe(true);
  });

  it("returns false for plain Error", () => {
    expect(hasCodeProperty(new Error("test"))).toBe(false);
  });

  it("returns false for non-Error", () => {
    expect(hasCodeProperty({ code: "ENOENT" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(hasCodeProperty(null)).toBe(false);
  });
});

describe("hasStatusProperty", () => {
  it("returns true for error with number status", () => {
    const err = Object.assign(new Error("test"), { status: 404 });
    expect(hasStatusProperty(err)).toBe(true);
  });

  it("returns false for error with string status", () => {
    const err = Object.assign(new Error("test"), { status: "not found" });
    expect(hasStatusProperty(err)).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(hasStatusProperty(new Error("test"))).toBe(false);
  });

  it("returns false for non-Error", () => {
    expect(hasStatusProperty({ status: 404 })).toBe(false);
  });
});

describe("hasResponseProperty", () => {
  it("returns true for error with response containing status", () => {
    const err = Object.assign(new Error("test"), {
      response: { status: 500 },
    });
    expect(hasResponseProperty(err)).toBe(true);
  });

  it("returns false for error with response missing status", () => {
    const err = Object.assign(new Error("test"), {
      response: { data: "test" },
    });
    expect(hasResponseProperty(err)).toBe(false);
  });

  it("returns false for error with null response", () => {
    const err = Object.assign(new Error("test"), { response: null });
    expect(hasResponseProperty(err)).toBe(false);
  });

  it("returns false for plain Error", () => {
    expect(hasResponseProperty(new Error("test"))).toBe(false);
  });

  it("returns false for non-Error", () => {
    expect(hasResponseProperty({ response: { status: 500 } })).toBe(false);
  });
});
