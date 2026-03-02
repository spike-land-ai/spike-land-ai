import { describe, expect, it } from "vitest";
import { classifyError, toMcpError } from "./error-classifier";
import { McpError, McpErrorCode } from "./errors";

describe("classifyError", () => {
  describe("McpError passthrough", () => {
    it("should return classification from existing McpError", () => {
      const mcpError = new McpError("Original message", McpErrorCode.RATE_LIMITED, true);

      const result = classifyError(mcpError);

      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
      expect(result.retryable).toBe(true);
    });
  });

  describe("error code property classification", () => {
    it("should classify ETIMEDOUT as TIMEOUT", () => {
      const error = new Error("Connection failed") as Error & { code: string };
      error.code = "ETIMEDOUT";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should classify ESOCKETTIMEDOUT as TIMEOUT", () => {
      const error = new Error("Socket timeout") as Error & { code: string };
      error.code = "ESOCKETTIMEDOUT";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should classify DEADLINE_EXCEEDED as TIMEOUT", () => {
      const error = new Error("Deadline exceeded") as Error & { code: string };
      error.code = "DEADLINE_EXCEEDED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should classify RESOURCE_EXHAUSTED as RATE_LIMITED", () => {
      const error = new Error("Rate limited") as Error & { code: string };
      error.code = "RESOURCE_EXHAUSTED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should classify UNAUTHENTICATED as AUTH_ERROR", () => {
      const error = new Error("Not authenticated") as Error & { code: string };
      error.code = "UNAUTHENTICATED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should classify PERMISSION_DENIED as AUTH_ERROR", () => {
      const error = new Error("Permission denied") as Error & { code: string };
      error.code = "PERMISSION_DENIED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should classify ECONNREFUSED as GEMINI_API_ERROR", () => {
      const error = new Error("Connection refused") as Error & { code: string };
      error.code = "ECONNREFUSED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GEMINI_API_ERROR);
    });

    it("should classify INVALID_ARGUMENT as INVALID_INPUT", () => {
      const error = new Error("Invalid argument") as Error & { code: string };
      error.code = "INVALID_ARGUMENT";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.INVALID_INPUT);
    });

    it("should classify SAFETY code as CONTENT_POLICY", () => {
      const error = new Error("Safety filter triggered") as Error & {
        code: string;
      };
      error.code = "SAFETY";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
    });

    it("should classify BLOCKED code as CONTENT_POLICY", () => {
      const error = new Error("Content was blocked") as Error & {
        code: string;
      };
      error.code = "BLOCKED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
    });

    it("should classify QUOTA_EXCEEDED code as RATE_LIMITED", () => {
      const error = new Error("Quota exceeded") as Error & { code: string };
      error.code = "QUOTA_EXCEEDED";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should classify ECONNRESET as GEMINI_API_ERROR", () => {
      const error = new Error("Connection reset") as Error & { code: string };
      error.code = "ECONNRESET";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GEMINI_API_ERROR);
    });

    it("should classify ENOTFOUND as GEMINI_API_ERROR", () => {
      const error = new Error("DNS lookup failed") as Error & { code: string };
      error.code = "ENOTFOUND";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GEMINI_API_ERROR);
    });

    it("should classify INVALID_REQUEST as INVALID_INPUT", () => {
      const error = new Error("Invalid request") as Error & { code: string };
      error.code = "INVALID_REQUEST";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.INVALID_INPUT);
    });

    it("should handle partial code matches", () => {
      const error = new Error("Custom timeout error") as Error & {
        code: string;
      };
      error.code = "CUSTOM_TIMEOUT_ERROR";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should handle numeric error codes (no match)", () => {
      const error = new Error("Some error") as Error & { code: number };
      error.code = 12345;

      const result = classifyError(error);
      // Falls through to message pattern matching or default
      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
    });
  });

  describe("HTTP status code classification", () => {
    it("should classify status 400 as INVALID_INPUT", () => {
      const error = new Error("Bad request") as Error & { status: number };
      error.status = 400;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.INVALID_INPUT);
    });

    it("should classify status 401 as AUTH_ERROR", () => {
      const error = new Error("Unauthorized") as Error & { status: number };
      error.status = 401;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should classify status 403 as AUTH_ERROR", () => {
      const error = new Error("Forbidden") as Error & { status: number };
      error.status = 403;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should classify status 404 as INVALID_INPUT", () => {
      const error = new Error("Not found") as Error & { status: number };
      error.status = 404;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.INVALID_INPUT);
    });

    it("should classify status 408 as TIMEOUT", () => {
      const error = new Error("Request timeout") as Error & { status: number };
      error.status = 408;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should classify status 413 as INVALID_IMAGE", () => {
      const error = new Error("Payload too large") as Error & {
        status: number;
      };
      error.status = 413;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
    });

    it("should classify status 429 as RATE_LIMITED", () => {
      const error = new Error("Too many requests") as Error & {
        status: number;
      };
      error.status = 429;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should classify status 500 as GEMINI_API_ERROR", () => {
      const error = new Error("Internal server error") as Error & {
        status: number;
      };
      error.status = 500;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GEMINI_API_ERROR);
    });

    it("should classify status 503 as RATE_LIMITED", () => {
      const error = new Error("Service unavailable") as Error & {
        status: number;
      };
      error.status = 503;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should classify status 504 as TIMEOUT", () => {
      const error = new Error("Gateway timeout") as Error & { status: number };
      error.status = 504;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should use statusCode if status is not available", () => {
      const error = new Error("Unauthorized") as Error & { statusCode: number };
      error.statusCode = 401;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should use response.status if available", () => {
      const error = new Error("Error with response") as Error & {
        response: { status: number };
      };
      error.response = { status: 429 };

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should use response.statusCode when response.status is not available", () => {
      const error = new Error("Error with response statusCode") as Error & {
        response: { statusCode: number };
      };
      error.response = { statusCode: 401 };

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should fall through when error has status property but both status and statusCode are undefined", () => {
      const error = new Error("Some unrecognized error") as Error & {
        status: undefined;
        statusCode: undefined;
      };
      Object.assign(error, { status: undefined, statusCode: undefined });

      const result = classifyError(error);
      // Falls through status check (returns null) to message pattern or default
      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
    });

    it("should fall through when error has response but both response.status and response.statusCode are undefined", () => {
      const error = new Error("Some odd response error") as Error & {
        response: { status: undefined; statusCode: undefined };
      };
      error.response = { status: undefined, statusCode: undefined };

      const result = classifyError(error);
      // Falls through response check (returns null) to message pattern or default
      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
    });

    it("should fall through when status is not in HTTP_STATUS_MAP", () => {
      const error = new Error("Some completely unexpected error") as Error & {
        status: number;
      };
      error.status = 999; // Not in map

      const result = classifyError(error);
      // Falls through to message pattern or default
      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
    });

    it("should classify status 415 as INVALID_IMAGE", () => {
      const error = new Error("Unsupported media type") as Error & {
        status: number;
      };
      error.status = 415;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
    });

    it("should classify status 502 as GEMINI_API_ERROR", () => {
      const error = new Error("Bad gateway") as Error & { status: number };
      error.status = 502;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GEMINI_API_ERROR);
    });

    it("should handle error with status property but no code", () => {
      const error = new Error("Status only") as Error & { status: number };
      error.status = 429;
      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should handle error with statusCode property", () => {
      const error = new Error("StatusCode only") as Error & { statusCode: number };
      error.statusCode = 401;
      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should handle error with response object status", () => {
      const error = new Error("Response status") as Error & { response: { status: number } };
      error.response = { status: 503 };
      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should handle error with response object statusCode", () => {
      const error = new Error("Response statusCode") as Error & {
        response: { statusCode: number };
      };
      error.response = { statusCode: 408 };
      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should fall through if status and statusCode are undefined", () => {
      const error = new Error("Undefined status") as Error & {
        status: undefined;
        statusCode: undefined;
      };
      error.status = undefined;
      error.statusCode = undefined;
      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
    });

    it("should fall through if response status and statusCode are undefined", () => {
      const error = new Error("Undefined response status") as Error & {
        response: { status: undefined; statusCode: undefined };
      };
      error.response = { status: undefined, statusCode: undefined };
      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
    });
  });

  describe("error name classification", () => {
    it("should classify TimeoutError by name", () => {
      const error = new Error("Something happened");
      error.name = "TimeoutError";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should classify AbortError by name", () => {
      const error = new Error("Request aborted");
      error.name = "AbortError";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should classify AuthenticationError by name", () => {
      const error = new Error("Auth failed");
      error.name = "AuthenticationError";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });

    it("should classify UnauthorizedError by name", () => {
      const error = new Error("Unauthorized");
      error.name = "UnauthorizedError";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
    });
  });

  describe("message pattern classification (fallback)", () => {
    describe("timeout patterns", () => {
      it("should classify 'timeout' in message", () => {
        const result = classifyError(new Error("Connection timeout"));
        expect(result.code).toBe(McpErrorCode.TIMEOUT);
      });

      it("should classify 'timed out' in message", () => {
        const result = classifyError(new Error("Request timed out"));
        expect(result.code).toBe(McpErrorCode.TIMEOUT);
      });

      it("should classify 'deadline exceeded' in message", () => {
        const result = classifyError(new Error("Deadline exceeded"));
        expect(result.code).toBe(McpErrorCode.TIMEOUT);
      });

      it("should classify 'took too long' in message", () => {
        const result = classifyError(new Error("The operation took too long"));
        expect(result.code).toBe(McpErrorCode.TIMEOUT);
      });
    });

    describe("content policy patterns", () => {
      it("should classify 'content policy' in message", () => {
        const result = classifyError(new Error("Violates content policy"));
        expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
      });

      it("should classify 'content blocked' in message", () => {
        const result = classifyError(new Error("Content blocked by filter"));
        expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
      });

      it("should classify 'safety violation' in message", () => {
        const result = classifyError(new Error("Safety violation detected"));
        expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
      });

      it("should classify 'moderation' in message", () => {
        const result = classifyError(new Error("Failed moderation check"));
        expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
      });

      it("should classify 'unsafe content' in message", () => {
        const result = classifyError(new Error("Detected unsafe content"));
        expect(result.code).toBe(McpErrorCode.CONTENT_POLICY);
      });
    });

    describe("rate limiting patterns", () => {
      it("should classify 'rate limit' in message", () => {
        const result = classifyError(new Error("Rate limit exceeded"));
        expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
      });

      it("should classify 'too many requests' in message", () => {
        const result = classifyError(new Error("Too many requests"));
        expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
      });

      it("should classify 'quota' in message", () => {
        const result = classifyError(new Error("Quota exceeded for today"));
        expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
      });

      it("should classify '429' status code in message", () => {
        const result = classifyError(new Error("HTTP 429: Too Many Requests"));
        expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
      });

      it("should classify 'throttle' in message", () => {
        const result = classifyError(new Error("Request throttled"));
        expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
      });
    });

    describe("auth patterns", () => {
      it("should classify 'api key' in message", () => {
        const result = classifyError(new Error("Invalid API key"));
        expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
      });

      it("should classify 'unauthorized' in message", () => {
        const result = classifyError(new Error("Unauthorized access"));
        expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
      });

      it("should classify '401' in message", () => {
        const result = classifyError(new Error("HTTP 401 Unauthorized"));
        expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
      });

      it("should classify 'token expired' in message", () => {
        const result = classifyError(new Error("Token expired"));
        expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
      });

      it("should classify 'permission denied' in message", () => {
        const result = classifyError(new Error("Permission denied"));
        expect(result.code).toBe(McpErrorCode.AUTH_ERROR);
      });
    });

    describe("invalid image patterns", () => {
      it("should classify 'image invalid' in message", () => {
        const result = classifyError(new Error("Image is invalid"));
        expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
      });

      it("should classify 'invalid image' in message", () => {
        const result = classifyError(new Error("Invalid image format"));
        expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
      });

      it("should classify 'corrupt image' in message", () => {
        const result = classifyError(new Error("Image appears corrupt"));
        expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
      });

      it("should classify 'malformed input' in message", () => {
        const result = classifyError(new Error("Malformed input data"));
        expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
      });

      it("should classify 'unsupported format' in message", () => {
        const result = classifyError(new Error("Unsupported format"));
        expect(result.code).toBe(McpErrorCode.INVALID_IMAGE);
      });
    });

    describe("R2 upload patterns", () => {
      it("should classify 'r2 upload' in message", () => {
        const result = classifyError(new Error("R2 upload failed"));
        expect(result.code).toBe(McpErrorCode.R2_UPLOAD_ERROR);
      });

      it("should classify 'upload failed' in message", () => {
        const result = classifyError(new Error("Upload failed"));
        expect(result.code).toBe(McpErrorCode.R2_UPLOAD_ERROR);
      });

      it("should classify 'storage error' in message", () => {
        const result = classifyError(new Error("Storage error occurred"));
        expect(result.code).toBe(McpErrorCode.R2_UPLOAD_ERROR);
      });
    });
  });

  describe("non-Error input handling", () => {
    it("should return UNKNOWN for string input", () => {
      const result = classifyError("string error");
      expect(result.code).toBe(McpErrorCode.UNKNOWN);
    });

    it("should return UNKNOWN for null", () => {
      const result = classifyError(null);
      expect(result.code).toBe(McpErrorCode.UNKNOWN);
    });

    it("should return UNKNOWN for undefined", () => {
      const result = classifyError(undefined);
      expect(result.code).toBe(McpErrorCode.UNKNOWN);
    });

    it("should return UNKNOWN for number", () => {
      const result = classifyError(42);
      expect(result.code).toBe(McpErrorCode.UNKNOWN);
    });

    it("should return UNKNOWN for object", () => {
      const result = classifyError({ message: "not an error" });
      expect(result.code).toBe(McpErrorCode.UNKNOWN);
    });
  });

  describe("default classification", () => {
    it("should return GENERATION_ERROR with original message for unmatched errors", () => {
      const result = classifyError(new Error("Some completely unexpected error"));

      expect(result.code).toBe(McpErrorCode.GENERATION_ERROR);
      expect(result.message).toBe("Some completely unexpected error");
    });
  });

  describe("retryable property", () => {
    it("should include retryable in result", () => {
      const result = classifyError(new Error("timeout"));
      expect(result).toHaveProperty("retryable");
      expect(typeof result.retryable).toBe("boolean");
    });

    it("should return retryable=true for timeout errors", () => {
      const result = classifyError(new Error("Request timed out"));
      expect(result.retryable).toBe(true);
    });

    it("should return retryable=false for content policy errors", () => {
      const result = classifyError(new Error("Content blocked by policy"));
      expect(result.retryable).toBe(false);
    });
  });

  describe("classification priority", () => {
    it("should prioritize error code over message patterns", () => {
      // Error has timeout code but rate limit message
      const error = new Error("rate limit exceeded") as Error & {
        code: string;
      };
      error.code = "ETIMEDOUT";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });

    it("should prioritize HTTP status over message patterns", () => {
      // Error has 429 status but timeout message
      const error = new Error("Connection timeout") as Error & {
        status: number;
      };
      error.status = 429;

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.RATE_LIMITED);
    });

    it("should prioritize error name over message patterns", () => {
      // Error has timeout name but auth message
      const error = new Error("Invalid API key");
      error.name = "TimeoutError";

      const result = classifyError(error);
      expect(result.code).toBe(McpErrorCode.TIMEOUT);
    });
  });
});

describe("toMcpError", () => {
  it("should wrap a regular Error in McpError", () => {
    const originalError = new Error("Connection timeout");
    const mcpError = toMcpError(originalError);

    expect(mcpError).toBeInstanceOf(McpError);
    expect(mcpError.message).toBe("Connection timeout");
    expect(mcpError.code).toBe(McpErrorCode.TIMEOUT);
    expect(mcpError.cause).toBe(originalError);
  });

  it("should preserve the original message", () => {
    const error = new Error("Custom error message");
    const mcpError = toMcpError(error);

    expect(mcpError.message).toBe("Custom error message");
  });

  it("should handle non-Error input", () => {
    const mcpError = toMcpError("string error");

    expect(mcpError).toBeInstanceOf(McpError);
    expect(mcpError.message).toBe("string error");
    expect(mcpError.code).toBe(McpErrorCode.UNKNOWN);
    expect(mcpError.cause).toBeUndefined();
  });

  it("should set correct retryability", () => {
    const timeoutError = toMcpError(new Error("Request timed out"));
    expect(timeoutError.retryable).toBe(true);

    const authError = toMcpError(new Error("Invalid API key"));
    expect(authError.retryable).toBe(false);
  });
});
