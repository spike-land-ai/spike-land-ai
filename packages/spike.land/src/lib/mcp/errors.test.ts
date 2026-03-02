import { describe, expect, it } from "vitest";
import {
  type ClassifiedError,
  MCP_ERROR_MESSAGES,
  MCP_ERROR_RETRYABLE,
  McpError,
  McpErrorCode,
} from "./errors";

describe("McpErrorCode", () => {
  it("should have all expected error codes", () => {
    expect(McpErrorCode.TIMEOUT).toBe("TIMEOUT");
    expect(McpErrorCode.CONTENT_POLICY).toBe("CONTENT_POLICY");
    expect(McpErrorCode.RATE_LIMITED).toBe("RATE_LIMITED");
    expect(McpErrorCode.AUTH_ERROR).toBe("AUTH_ERROR");
    expect(McpErrorCode.INVALID_IMAGE).toBe("INVALID_IMAGE");
    expect(McpErrorCode.INVALID_INPUT).toBe("INVALID_INPUT");
    expect(McpErrorCode.GEMINI_API_ERROR).toBe("GEMINI_API_ERROR");
    expect(McpErrorCode.R2_UPLOAD_ERROR).toBe("R2_UPLOAD_ERROR");
    expect(McpErrorCode.GENERATION_ERROR).toBe("GENERATION_ERROR");
    expect(McpErrorCode.WORKSPACE_NOT_FOUND).toBe("WORKSPACE_NOT_FOUND");
    expect(McpErrorCode.APP_NOT_FOUND).toBe("APP_NOT_FOUND");
    expect(McpErrorCode.PERMISSION_DENIED).toBe("PERMISSION_DENIED");
    expect(McpErrorCode.INSUFFICIENT_CREDITS).toBe("INSUFFICIENT_CREDITS");
    expect(McpErrorCode.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    expect(McpErrorCode.CONFLICT).toBe("CONFLICT");
    expect(McpErrorCode.UPSTREAM_SERVICE_ERROR).toBe("UPSTREAM_SERVICE_ERROR");
    expect(McpErrorCode.UNKNOWN).toBe("UNKNOWN");
  });
});

describe("MCP_ERROR_MESSAGES", () => {
  it("should have user-friendly messages for all error codes", () => {
    const codes = Object.values(McpErrorCode);
    for (const code of codes) {
      expect(MCP_ERROR_MESSAGES[code]).toBeDefined();
      expect(typeof MCP_ERROR_MESSAGES[code]).toBe("string");
      expect(MCP_ERROR_MESSAGES[code].length).toBeGreaterThan(0);
    }
  });

  it("should have helpful timeout message", () => {
    expect(MCP_ERROR_MESSAGES[McpErrorCode.TIMEOUT]).toContain("too long");
  });

  it("should have policy message for content violations", () => {
    expect(MCP_ERROR_MESSAGES[McpErrorCode.CONTENT_POLICY]).toContain("policies");
  });
});

describe("MCP_ERROR_RETRYABLE", () => {
  it("should have retryable config for all error codes", () => {
    const codes = Object.values(McpErrorCode);
    for (const code of codes) {
      expect(typeof MCP_ERROR_RETRYABLE[code]).toBe("boolean");
    }
  });

  it("should mark transient errors as retryable", () => {
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.TIMEOUT]).toBe(true);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.RATE_LIMITED]).toBe(true);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.GEMINI_API_ERROR]).toBe(true);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.R2_UPLOAD_ERROR]).toBe(true);
  });

  it("should mark permanent errors as non-retryable", () => {
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.CONTENT_POLICY]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.AUTH_ERROR]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.INVALID_IMAGE]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.INVALID_INPUT]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.WORKSPACE_NOT_FOUND]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.APP_NOT_FOUND]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.PERMISSION_DENIED]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.INSUFFICIENT_CREDITS]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.VALIDATION_ERROR]).toBe(false);
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.CONFLICT]).toBe(false);
  });

  it("should mark upstream service errors as retryable", () => {
    expect(MCP_ERROR_RETRYABLE[McpErrorCode.UPSTREAM_SERVICE_ERROR]).toBe(true);
  });
});

describe("McpError", () => {
  describe("constructor", () => {
    it("should create error with message and code", () => {
      const error = new McpError("Test message", McpErrorCode.TIMEOUT);

      expect(error.message).toBe("Test message");
      expect(error.code).toBe(McpErrorCode.TIMEOUT);
      expect(error.name).toBe("McpError");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(McpError);
    });

    it("should use default retryable from MCP_ERROR_RETRYABLE", () => {
      const timeoutError = new McpError("Timeout", McpErrorCode.TIMEOUT);
      expect(timeoutError.retryable).toBe(true);

      const authError = new McpError("Auth failed", McpErrorCode.AUTH_ERROR);
      expect(authError.retryable).toBe(false);
    });

    it("should allow overriding retryable", () => {
      // Override a normally retryable error to not be retryable
      const error = new McpError("Special case", McpErrorCode.TIMEOUT, false);
      expect(error.retryable).toBe(false);

      // Override a normally non-retryable error to be retryable
      const error2 = new McpError("Special case", McpErrorCode.AUTH_ERROR, true);
      expect(error2.retryable).toBe(true);
    });

    it("should store the cause error", () => {
      const originalError = new Error("Original error");
      const error = new McpError(
        "Wrapped error",
        McpErrorCode.GEMINI_API_ERROR,
        true,
        originalError,
      );

      expect(error.cause).toBe(originalError);
    });

    it("should handle undefined cause", () => {
      const error = new McpError("No cause", McpErrorCode.UNKNOWN);
      expect(error.cause).toBeUndefined();
    });
  });

  describe("getUserMessage", () => {
    it("should return user-friendly message for error code", () => {
      const error = new McpError("Technical details", McpErrorCode.TIMEOUT);
      expect(error.getUserMessage()).toBe(MCP_ERROR_MESSAGES[McpErrorCode.TIMEOUT]);
    });

    it("should return correct message for RATE_LIMITED", () => {
      const error = new McpError("Too many", McpErrorCode.RATE_LIMITED);
      expect(error.getUserMessage()).toBe(MCP_ERROR_MESSAGES[McpErrorCode.RATE_LIMITED]);
    });

    it("should return correct message for AUTH_ERROR", () => {
      const error = new McpError("Auth failed", McpErrorCode.AUTH_ERROR);
      expect(error.getUserMessage()).toBe(MCP_ERROR_MESSAGES[McpErrorCode.AUTH_ERROR]);
    });

    it("should return different messages for different codes", () => {
      const timeoutError = new McpError("msg", McpErrorCode.TIMEOUT);
      const authError = new McpError("msg", McpErrorCode.AUTH_ERROR);

      expect(timeoutError.getUserMessage()).not.toBe(authError.getUserMessage());
    });
  });

  describe("toJSON", () => {
    it("should serialize to a plain object", () => {
      const error = new McpError("Test message", McpErrorCode.RATE_LIMITED, true);

      const json = error.toJSON();

      expect(json).toEqual({
        name: "McpError",
        message: "Test message",
        code: McpErrorCode.RATE_LIMITED,
        retryable: true,
        userMessage: MCP_ERROR_MESSAGES[McpErrorCode.RATE_LIMITED],
      });
    });

    it("should include all required fields", () => {
      const error = new McpError("Any message", McpErrorCode.UNKNOWN);
      const json = error.toJSON();

      expect(json).toHaveProperty("name");
      expect(json).toHaveProperty("message");
      expect(json).toHaveProperty("code");
      expect(json).toHaveProperty("retryable");
      expect(json).toHaveProperty("userMessage");
    });
  });

  describe("stack trace", () => {
    it("should have a proper stack trace", () => {
      const error = new McpError("Test", McpErrorCode.UNKNOWN);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("McpError");
    });

    it("should use Error.captureStackTrace when available", () => {
      // Error.captureStackTrace is available in V8 environments (Node.js)
      expect(Error.captureStackTrace).toBeDefined();
      const error = new McpError("Stack test", McpErrorCode.TIMEOUT);
      // Stack should not include McpError constructor frame
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("Stack test");
    });

    it("should still work if Error.captureStackTrace is not available", () => {
      const originalCapture = Error.captureStackTrace;
      // Temporarily remove captureStackTrace
      delete (Error as { captureStackTrace?: typeof Error.captureStackTrace }).captureStackTrace;
      try {
        const error = new McpError("No capture", McpErrorCode.UNKNOWN);
        expect(error.message).toBe("No capture");
        expect(error.code).toBe(McpErrorCode.UNKNOWN);
        // Stack may still exist from the super() call
        expect(error.name).toBe("McpError");
      } finally {
        Error.captureStackTrace = originalCapture;
      }
    });
  });
});

describe("ClassifiedError type", () => {
  it("should be compatible with expected structure", () => {
    // Type check - this will fail at compile time if the type is wrong
    const classified: ClassifiedError = {
      code: McpErrorCode.TIMEOUT,
      message: "Test message",
      retryable: true,
    };

    expect(classified.code).toBe(McpErrorCode.TIMEOUT);
    expect(classified.message).toBe("Test message");
    expect(classified.retryable).toBe(true);
  });
});
