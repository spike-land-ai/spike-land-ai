import { describe, expect, it } from "vitest";

import {
  detectErrorCode,
  ERROR_MESSAGES,
  type ErrorCode,
  getUserFriendlyError,
  isRetryableError,
} from "./error-messages";

describe("ERROR_MESSAGES", () => {
  it("has entries for all error codes", () => {
    const codes: ErrorCode[] = [
      "NETWORK_ERROR",
      "TIMEOUT",
      "RATE_LIMIT",
      "INSUFFICIENT_TOKENS",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NOT_FOUND",
      "INVALID_INPUT",
      "FILE_TOO_LARGE",
      "UNSUPPORTED_FILE_TYPE",
      "PROCESSING_FAILED",
      "UPLOAD_FAILED",
      "DOWNLOAD_FAILED",
      "DATABASE_ERROR",
      "EXTERNAL_SERVICE_ERROR",
      "UNKNOWN_ERROR",
    ];
    for (const code of codes) {
      const msg = ERROR_MESSAGES[code];
      expect(msg.title).toBeTruthy();
      expect(msg.message).toBeTruthy();
      expect(typeof msg.retryable).toBe("boolean");
    }
  });

  it("marks network errors as retryable", () => {
    expect(ERROR_MESSAGES.NETWORK_ERROR.retryable).toBe(true);
  });

  it("marks unauthorized as non-retryable", () => {
    expect(ERROR_MESSAGES.UNAUTHORIZED.retryable).toBe(false);
  });
});

describe("detectErrorCode", () => {
  it("detects from status code 401", () => {
    expect(detectErrorCode("any", 401)).toBe("UNAUTHORIZED");
  });

  it("detects from status code 403", () => {
    expect(detectErrorCode("any", 403)).toBe("FORBIDDEN");
  });

  it("detects from status code 404", () => {
    expect(detectErrorCode("any", 404)).toBe("NOT_FOUND");
  });

  it("detects from status code 402", () => {
    expect(detectErrorCode("any", 402)).toBe("INSUFFICIENT_TOKENS");
  });

  it("detects from status code 429", () => {
    expect(detectErrorCode("any", 429)).toBe("RATE_LIMIT");
  });

  it("detects from status code 500+", () => {
    expect(detectErrorCode("any", 500)).toBe("EXTERNAL_SERVICE_ERROR");
    expect(detectErrorCode("any", 503)).toBe("EXTERNAL_SERVICE_ERROR");
  });

  it("detects network error from message", () => {
    expect(detectErrorCode("Network error occurred")).toBe("NETWORK_ERROR");
    expect(detectErrorCode("fetch failed")).toBe("NETWORK_ERROR");
    expect(detectErrorCode("ENOTFOUND")).toBe("NETWORK_ERROR");
    expect(detectErrorCode("ECONNREFUSED")).toBe("NETWORK_ERROR");
  });

  it("detects timeout from message", () => {
    expect(detectErrorCode("Request timeout")).toBe("TIMEOUT");
    expect(detectErrorCode("Connection timed out")).toBe("TIMEOUT");
  });

  it("detects rate limit from message", () => {
    expect(detectErrorCode("Rate limit exceeded")).toBe("RATE_LIMIT");
    expect(detectErrorCode("Too many requests")).toBe("RATE_LIMIT");
  });

  it("detects insufficient tokens from message", () => {
    expect(detectErrorCode("Insufficient credits")).toBe("INSUFFICIENT_TOKENS");
    expect(detectErrorCode("Not enough tokens")).toBe("INSUFFICIENT_TOKENS");
  });

  it("detects unauthorized from message", () => {
    expect(detectErrorCode("Unauthorized access")).toBe("UNAUTHORIZED");
    expect(detectErrorCode("User is unauthenticated")).toBe("UNAUTHORIZED");
  });

  it("detects forbidden from message", () => {
    expect(detectErrorCode("Forbidden resource")).toBe("FORBIDDEN");
    expect(detectErrorCode("Access denied")).toBe("FORBIDDEN");
  });

  it("detects not found from message", () => {
    expect(detectErrorCode("Resource not found")).toBe("NOT_FOUND");
  });

  it("detects file too large from message", () => {
    expect(detectErrorCode("File too large")).toBe("FILE_TOO_LARGE");
    expect(detectErrorCode("Exceeds maximum size")).toBe("FILE_TOO_LARGE");
  });

  it("detects unsupported file type from message", () => {
    expect(detectErrorCode("Unsupported format")).toBe("UNSUPPORTED_FILE_TYPE");
    expect(detectErrorCode("Invalid file type")).toBe("UNSUPPORTED_FILE_TYPE");
  });

  it("detects invalid input from message", () => {
    expect(detectErrorCode("Validation failed for field")).toBe("INVALID_INPUT");
  });

  it("detects upload failed from message", () => {
    expect(detectErrorCode("Upload failed")).toBe("UPLOAD_FAILED");
    expect(detectErrorCode("Upload error")).toBe("UPLOAD_FAILED");
  });

  it("detects download failed from message", () => {
    expect(detectErrorCode("Download failed")).toBe("DOWNLOAD_FAILED");
    expect(detectErrorCode("Failed to download")).toBe("DOWNLOAD_FAILED");
  });

  it("detects database error from message", () => {
    expect(detectErrorCode("Database connection failed")).toBe("DATABASE_ERROR");
    expect(detectErrorCode("Prisma error")).toBe("DATABASE_ERROR");
    expect(detectErrorCode("Transaction failed")).toBe("DATABASE_ERROR");
  });

  it("detects processing failed from message", () => {
    expect(detectErrorCode("Enhancement failed")).toBe("PROCESSING_FAILED");
    expect(detectErrorCode("Processing failed")).toBe("PROCESSING_FAILED");
  });

  it("returns UNKNOWN_ERROR for unrecognized message", () => {
    expect(detectErrorCode("Something weird happened")).toBe("UNKNOWN_ERROR");
  });

  it("accepts Error objects", () => {
    expect(detectErrorCode(new Error("Network error"))).toBe("NETWORK_ERROR");
  });
});

describe("getUserFriendlyError", () => {
  it("returns friendly message for known error", () => {
    const result = getUserFriendlyError("Network error");
    expect(result.title).toBe("Connection Problem");
    expect(result.retryable).toBe(true);
  });

  it("returns friendly message for status code", () => {
    const result = getUserFriendlyError("any error", 401);
    expect(result.title).toBe("Authentication Required");
  });

  it("returns unknown error for unrecognized", () => {
    const result = getUserFriendlyError("blah");
    expect(result.title).toBe("Something Went Wrong");
  });
});

describe("isRetryableError", () => {
  it("returns true for retryable errors", () => {
    expect(isRetryableError("Network error")).toBe(true);
    expect(isRetryableError("Request timeout")).toBe(true);
  });

  it("returns false for non-retryable errors", () => {
    expect(isRetryableError("Unauthorized")).toBe(false);
    expect(isRetryableError("Access denied")).toBe(false);
  });

  it("uses status code", () => {
    expect(isRetryableError("any", 429)).toBe(true);
    expect(isRetryableError("any", 403)).toBe(false);
  });
});
