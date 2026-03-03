/**
 * Error Classification for MCP Generation Jobs
 *
 * This module provides robust error classification that prioritizes:
 * 1. Error code/type properties (most reliable)
 * 2. HTTP status codes
 * 3. Error name/constructor
 * 4. Message patterns (fallback only)
 *
 * This approach is more resilient than pure regex matching on error messages,
 * which can break when upstream services change their error text.
 *
 * @module mcp/error-classifier
 */

import {
  type ClassifiedError,
  MCP_ERROR_MESSAGES,
  MCP_ERROR_RETRYABLE,
  McpError,
  McpErrorCode,
} from "./errors";

/**
 * Interface for errors that have a code property.
 * Many libraries (like Prisma, Node.js) use this pattern.
 */
interface ErrorWithCode extends Error {
  code?: string | number;
}

/**
 * Interface for errors that have an HTTP status code.
 */
interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Interface for errors with a response object (like fetch errors).
 */
interface ErrorWithResponse extends Error {
  response?: {
    status?: number;
    statusCode?: number;
  };
}

/**
 * Type guard to check if an error has a code property.
 */
function hasCodeProperty(error: unknown): error is ErrorWithCode {
  return (
    error instanceof Error
    && "code" in error
    && (typeof (error as ErrorWithCode).code === "string"
      || typeof (error as ErrorWithCode).code === "number")
  );
}

/**
 * Type guard to check if an error has status properties.
 */
function hasStatusProperty(error: unknown): error is ErrorWithStatus {
  return (
    error instanceof Error
    && ("status" in error || "statusCode" in error)
  );
}

/**
 * Type guard to check if an error has a response object.
 */
function hasResponseProperty(error: unknown): error is ErrorWithResponse {
  return (
    error instanceof Error
    && "response" in error
    && typeof (error as ErrorWithResponse).response === "object"
  );
}

/**
 * Map of known error codes to MCP error codes.
 * Handles various upstream error code formats.
 */
const ERROR_CODE_MAP: Record<string, McpErrorCode> = {
  // Timeout codes
  ETIMEDOUT: McpErrorCode.TIMEOUT,
  ESOCKETTIMEDOUT: McpErrorCode.TIMEOUT,
  TIMEOUT: McpErrorCode.TIMEOUT,
  DEADLINE_EXCEEDED: McpErrorCode.TIMEOUT,

  // Network/connection codes
  ECONNREFUSED: McpErrorCode.GEMINI_API_ERROR,
  ECONNRESET: McpErrorCode.GEMINI_API_ERROR,
  ENOTFOUND: McpErrorCode.GEMINI_API_ERROR,

  // Authentication codes
  UNAUTHENTICATED: McpErrorCode.AUTH_ERROR,
  PERMISSION_DENIED: McpErrorCode.AUTH_ERROR,

  // Rate limiting codes
  RESOURCE_EXHAUSTED: McpErrorCode.RATE_LIMITED,
  QUOTA_EXCEEDED: McpErrorCode.RATE_LIMITED,

  // Invalid input codes
  INVALID_ARGUMENT: McpErrorCode.INVALID_INPUT,
  INVALID_REQUEST: McpErrorCode.INVALID_INPUT,

  // Content policy codes (Gemini-specific)
  SAFETY: McpErrorCode.CONTENT_POLICY,
  BLOCKED: McpErrorCode.CONTENT_POLICY,
};

/**
 * Map of HTTP status codes to MCP error codes.
 */
const HTTP_STATUS_MAP: Record<number, McpErrorCode> = {
  400: McpErrorCode.INVALID_INPUT,
  401: McpErrorCode.AUTH_ERROR,
  403: McpErrorCode.AUTH_ERROR,
  404: McpErrorCode.INVALID_INPUT,
  408: McpErrorCode.TIMEOUT,
  413: McpErrorCode.INVALID_IMAGE, // Payload too large
  415: McpErrorCode.INVALID_IMAGE, // Unsupported media type
  429: McpErrorCode.RATE_LIMITED,
  500: McpErrorCode.GEMINI_API_ERROR,
  502: McpErrorCode.GEMINI_API_ERROR,
  503: McpErrorCode.RATE_LIMITED, // Often indicates overload
  504: McpErrorCode.TIMEOUT,
};

/**
 * Classify an error based on its code property.
 * @internal
 */
function classifyByErrorCode(error: ErrorWithCode): McpErrorCode | null {
  const code = String(error.code).toUpperCase();

  // Direct mapping
  if (code in ERROR_CODE_MAP) {
    return ERROR_CODE_MAP[code]!;
  }

  // Check for partial matches (e.g., "TIMEOUT_ERROR" contains "TIMEOUT")
  for (const [key, mcpCode] of Object.entries(ERROR_CODE_MAP)) {
    if (code.includes(key)) {
      return mcpCode;
    }
  }

  return null;
}

/**
 * Get HTTP status from error if available.
 * @internal
 */
function getHttpStatus(error: Error): number | null {
  if (hasStatusProperty(error)) {
    return error.status ?? error.statusCode ?? null;
  }
  if (hasResponseProperty(error) && error.response) {
    return error.response.status ?? error.response.statusCode ?? null;
  }
  return null;
}

/**
 * Classify an error based on HTTP status code.
 * @internal
 */
function classifyByHttpStatus(error: Error): McpErrorCode | null {
  const status = getHttpStatus(error);
  if (status !== null && status in HTTP_STATUS_MAP) {
    return HTTP_STATUS_MAP[status]!;
  }
  return null;
}

/**
 * Classify an error based on its name/constructor.
 * @internal
 */
function classifyByErrorName(error: Error): McpErrorCode | null {
  const errorName = error.name.toLowerCase();

  if (errorName.includes("timeout")) {
    return McpErrorCode.TIMEOUT;
  }
  if (errorName.includes("abort")) {
    return McpErrorCode.TIMEOUT;
  }
  if (errorName.includes("auth") || errorName.includes("unauthorized")) {
    return McpErrorCode.AUTH_ERROR;
  }

  return null;
}

/**
 * Message pattern matchers for fallback classification.
 * Ordered by specificity (more specific patterns first).
 * @internal
 */
const MESSAGE_PATTERNS: Array<{
  patterns: RegExp[];
  code: McpErrorCode;
}> = [
  // Timeout patterns
  {
    patterns: [
      /timed?\s*out/i,
      /timeout/i,
      /deadline\s*exceeded/i,
      /took\s*too\s*long/i,
      /request\s*exceeded/i,
    ],
    code: McpErrorCode.TIMEOUT,
  },
  // Content policy patterns
  {
    patterns: [
      /content.*policy/i,
      /content.*blocked/i,
      /safety.*violation/i,
      /policy.*violation/i,
      /blocked.*content/i,
      /moderation/i,
      /unsafe\s*content/i,
    ],
    code: McpErrorCode.CONTENT_POLICY,
  },
  // Rate limiting patterns
  {
    patterns: [
      /rate\s*limit/i,
      /too\s*many\s*requests/i,
      /quota/i,
      /\b429\b/,
      /resource\s*exhausted/i,
      /throttl/i,
    ],
    code: McpErrorCode.RATE_LIMITED,
  },
  // Auth patterns
  {
    patterns: [
      /api\s*key/i,
      /unauthorized/i,
      /unauthenticated/i,
      /\b401\b/,
      /\b403\b/,
      /forbidden/i,
      /invalid.*token/i,
      /token.*expired/i,
      /permission\s*denied/i,
    ],
    code: McpErrorCode.AUTH_ERROR,
  },
  // Invalid image patterns
  {
    patterns: [
      /image.*invalid/i,
      /invalid.*image/i,
      /corrupt.*image/i,
      /image.*corrupt/i,
      /malformed.*input/i,
      /unsupported.*format/i,
      /format.*unsupported/i,
      /cannot.*process.*image/i,
      /image.*not.*readable/i,
    ],
    code: McpErrorCode.INVALID_IMAGE,
  },
  // R2/Storage patterns
  {
    patterns: [
      /r2.*upload/i,
      /upload.*r2/i,
      /storage.*error/i,
      /upload.*failed/i,
      /s3.*error/i,
    ],
    code: McpErrorCode.R2_UPLOAD_ERROR,
  },
];

/**
 * Classify an error based on message patterns (fallback).
 * @internal
 */
function classifyByMessagePattern(error: Error): McpErrorCode | null {
  const message = error.message.toLowerCase();

  for (const { patterns, code } of MESSAGE_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return code;
      }
    }
  }

  return null;
}

/**
 * Classify an upstream error into an MCP error code.
 *
 * Uses a priority-based approach:
 * 1. If already an McpError, return its classification
 * 2. Check error code property (most reliable)
 * 3. Check HTTP status code
 * 4. Check error name/constructor
 * 5. Check message patterns (fallback)
 * 6. Return GENERATION_ERROR for Error instances, UNKNOWN for others
 *
 * @param error - The error to classify
 * @returns Classified error with code, message, and retryability
 *
 * @example
 * ```typescript
 * const classified = classifyError(new Error("Request timed out"));
 * logger.info(classified.code); // "TIMEOUT"
 * logger.info(classified.message); // "Generation took too long. Try a lower quality tier."
 * logger.info(classified.retryable); // true
 * ```
 */
export function classifyError(error: unknown): ClassifiedError {
  // Handle non-Error types
  if (!(error instanceof Error)) {
    return {
      code: McpErrorCode.UNKNOWN,
      message: MCP_ERROR_MESSAGES[McpErrorCode.UNKNOWN],
      retryable: MCP_ERROR_RETRYABLE[McpErrorCode.UNKNOWN],
    };
  }

  // If it's already an McpError, extract its classification
  if (error instanceof McpError) {
    return {
      code: error.code,
      message: error.getUserMessage(),
      retryable: error.retryable,
    };
  }

  // Priority 1: Check error code property
  if (hasCodeProperty(error)) {
    const codeResult = classifyByErrorCode(error);
    if (codeResult !== null) {
      return {
        code: codeResult,
        message: MCP_ERROR_MESSAGES[codeResult],
        retryable: MCP_ERROR_RETRYABLE[codeResult],
      };
    }
  }

  // Priority 2: Check HTTP status code
  const statusResult = classifyByHttpStatus(error);
  if (statusResult !== null) {
    return {
      code: statusResult,
      message: MCP_ERROR_MESSAGES[statusResult],
      retryable: MCP_ERROR_RETRYABLE[statusResult],
    };
  }

  // Priority 3: Check error name
  const nameResult = classifyByErrorName(error);
  if (nameResult !== null) {
    return {
      code: nameResult,
      message: MCP_ERROR_MESSAGES[nameResult],
      retryable: MCP_ERROR_RETRYABLE[nameResult],
    };
  }

  // Priority 4: Check message patterns (fallback)
  const patternResult = classifyByMessagePattern(error);
  if (patternResult !== null) {
    return {
      code: patternResult,
      message: MCP_ERROR_MESSAGES[patternResult],
      retryable: MCP_ERROR_RETRYABLE[patternResult],
    };
  }

  // Default: Return original message with GENERATION_ERROR code
  return {
    code: McpErrorCode.GENERATION_ERROR,
    message: error.message,
    retryable: MCP_ERROR_RETRYABLE[McpErrorCode.GENERATION_ERROR],
  };
}

/**
 * Create an McpError from an unknown error.
 * Classifies the error and wraps it in an McpError with the original as the cause.
 *
 * @param error - The error to wrap
 * @returns An McpError with proper classification
 */
export function toMcpError(error: unknown): McpError {
  const classified = classifyError(error);

  const originalMessage = error instanceof Error
    ? error.message
    : String(error);
  const originalError = error instanceof Error ? error : undefined;

  return new McpError(
    originalMessage,
    classified.code,
    classified.retryable,
    originalError,
  );
}
