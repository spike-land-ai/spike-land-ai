/**
 * Tests for Social API Type Guards
 *
 * Resolves #797: Type Safety Improvements
 */

import { describe, expect, it } from "vitest";

import {
  isFacebookErrorResponse,
  isLinkedInErrorResponse,
  isSocialPlatformErrorResponse,
  isTwitterErrorResponse,
} from "./social-api-guards";

describe("Social API Type Guards", () => {
  describe("isFacebookErrorResponse", () => {
    it("should return true for valid Facebook error response", () => {
      const validResponse = {
        error: {
          message: "Rate limit exceeded",
          type: "OAuthException",
          code: 4,
        },
      };
      expect(isFacebookErrorResponse(validResponse)).toBe(true);
    });

    it("should return true for minimal Facebook error response", () => {
      const minimalResponse = {
        error: {},
      };
      expect(isFacebookErrorResponse(minimalResponse)).toBe(true);
    });

    it("should return false for non-object values", () => {
      expect(isFacebookErrorResponse(null)).toBe(false);
      expect(isFacebookErrorResponse(undefined)).toBe(false);
      expect(isFacebookErrorResponse("string")).toBe(false);
      expect(isFacebookErrorResponse(123)).toBe(false);
      expect(isFacebookErrorResponse(true)).toBe(false);
    });

    it("should return false for objects without error field", () => {
      expect(isFacebookErrorResponse({})).toBe(false);
      expect(isFacebookErrorResponse({ data: "value" })).toBe(false);
    });
  });

  describe("isLinkedInErrorResponse", () => {
    it("should return true for LinkedIn error with numeric status and string message", () => {
      const response = {
        status: 429,
        message: "Rate limit exceeded",
      };
      expect(isLinkedInErrorResponse(response)).toBe(true);
    });

    it("should return true for LinkedIn error with serviceErrorCode", () => {
      const response = {
        serviceErrorCode: 65600,
      };
      expect(isLinkedInErrorResponse(response)).toBe(true);
    });

    it("should return true for LinkedIn error with serviceErrorCode and other fields", () => {
      const response = {
        status: 429,
        message: "Rate limit exceeded",
        serviceErrorCode: 65600,
      };
      expect(isLinkedInErrorResponse(response)).toBe(true);
    });

    it("should return false for message-only objects (too ambiguous)", () => {
      // A plain { message } object could be any API — not specific enough to LinkedIn
      const response = {
        message: "Something went wrong",
      };
      expect(isLinkedInErrorResponse(response)).toBe(false);
    });

    it("should return false for status-only objects without message", () => {
      // status alone without message is not a LinkedIn error
      const response = {
        status: 429,
      };
      expect(isLinkedInErrorResponse(response)).toBe(false);
    });

    it("should return false for status as string (not a number)", () => {
      const response = {
        status: "429",
        message: "Rate limit exceeded",
      };
      expect(isLinkedInErrorResponse(response)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isLinkedInErrorResponse(null)).toBe(false);
      expect(isLinkedInErrorResponse(undefined)).toBe(false);
      expect(isLinkedInErrorResponse("string")).toBe(false);
    });

    it("should return false for objects without LinkedIn error fields", () => {
      expect(isLinkedInErrorResponse({})).toBe(false);
      expect(isLinkedInErrorResponse({ error: "something" })).toBe(false);
    });
  });

  describe("isTwitterErrorResponse", () => {
    it("should return true for valid Twitter error response", () => {
      const response = {
        errors: [
          {
            code: 88,
            message: "Rate limit exceeded",
          },
        ],
      };
      expect(isTwitterErrorResponse(response)).toBe(true);
    });

    it("should return true for empty errors array", () => {
      const response = {
        errors: [],
      };
      expect(isTwitterErrorResponse(response)).toBe(true);
    });

    it("should return false for non-array errors field", () => {
      const response = {
        errors: "not an array",
      };
      expect(isTwitterErrorResponse(response)).toBe(false);
    });

    it("should return false for non-object values", () => {
      expect(isTwitterErrorResponse(null)).toBe(false);
      expect(isTwitterErrorResponse(undefined)).toBe(false);
      expect(isTwitterErrorResponse("string")).toBe(false);
    });

    it("should return false for objects without errors field", () => {
      expect(isTwitterErrorResponse({})).toBe(false);
      expect(isTwitterErrorResponse({ error: {} })).toBe(false);
    });
  });

  describe("isSocialPlatformErrorResponse", () => {
    it("should return true for Facebook error", () => {
      const response = {
        error: { code: 4 },
      };
      expect(isSocialPlatformErrorResponse(response)).toBe(true);
    });

    it("should return true for LinkedIn error", () => {
      const response = {
        status: 429,
        message: "Rate limit exceeded",
      };
      expect(isSocialPlatformErrorResponse(response)).toBe(true);
    });

    it("should return true for Twitter error", () => {
      const response = {
        errors: [{ code: 88, message: "Rate limit" }],
      };
      expect(isSocialPlatformErrorResponse(response)).toBe(true);
    });

    it("should return false for non-error objects", () => {
      expect(isSocialPlatformErrorResponse({})).toBe(false);
      expect(isSocialPlatformErrorResponse({ data: "value" })).toBe(false);
      expect(isSocialPlatformErrorResponse(null)).toBe(false);
    });
  });
});
