/**
 * User-friendly error message mapping
 * Converts technical errors to human-readable messages with helpful suggestions
 */

interface ErrorMessage {
  title: string;
  message: string;
  suggestion?: string;
  retryable: boolean;
}

export type ErrorCode =
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "INSUFFICIENT_TOKENS"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_FILE_TYPE"
  | "PROCESSING_FAILED"
  | "UPLOAD_FAILED"
  | "DOWNLOAD_FAILED"
  | "DATABASE_ERROR"
  | "EXTERNAL_SERVICE_ERROR"
  | "UNKNOWN_ERROR";

/**
 * Map of error codes to user-friendly messages
 */
export const ERROR_MESSAGES: Record<ErrorCode, ErrorMessage> = {
  NETWORK_ERROR: {
    title: "Connection Problem",
    message: "We're having trouble connecting to our servers.",
    suggestion: "Please check your internet connection and try again in a moment.",
    retryable: true,
  },
  TIMEOUT: {
    title: "Request Timeout",
    message: "The request took too long to complete.",
    suggestion: "This might be due to a slow connection or server load. Please try again.",
    retryable: true,
  },
  RATE_LIMIT: {
    title: "Too Many Requests",
    message: "You've made too many requests in a short time.",
    suggestion:
      "Please wait a few minutes before trying again. This helps us maintain quality service for everyone.",
    retryable: true,
  },
  INSUFFICIENT_TOKENS: {
    title: "Not Enough Tokens",
    message: "You don't have enough tokens for this operation.",
    suggestion: "Purchase more tokens or wait for your tokens to regenerate.",
    retryable: false,
  },
  UNAUTHORIZED: {
    title: "Authentication Required",
    message: "You need to be signed in to perform this action.",
    suggestion: "Click the Sign In button to continue.",
    retryable: false,
  },
  FORBIDDEN: {
    title: "Access Denied",
    message: "You don't have permission to perform this action.",
    suggestion: "This resource may belong to another user or require special permissions.",
    retryable: false,
  },
  NOT_FOUND: {
    title: "Not Found",
    message: "The requested resource could not be found.",
    suggestion: "The item may have been deleted or the link may be incorrect.",
    retryable: false,
  },
  INVALID_INPUT: {
    title: "Invalid Input",
    message: "The provided information is invalid.",
    suggestion: "Please check your input and try again.",
    retryable: false,
  },
  FILE_TOO_LARGE: {
    title: "File Too Large",
    message: "The selected file exceeds the maximum allowed size.",
    suggestion: "Please choose a smaller file. Maximum size is 10MB per image.",
    retryable: false,
  },
  UNSUPPORTED_FILE_TYPE: {
    title: "Unsupported File Type",
    message: "The selected file type is not supported.",
    suggestion: "Please upload a JPEG, PNG, or WebP image file.",
    retryable: false,
  },
  PROCESSING_FAILED: {
    title: "Processing Failed",
    message: "We encountered an error while processing your request.",
    suggestion: "This is usually temporary. Your tokens have been refunded. Please try again.",
    retryable: true,
  },
  UPLOAD_FAILED: {
    title: "Upload Failed",
    message: "We couldn't upload your file.",
    suggestion:
      "Please check your connection and try again. If the problem persists, try a different file.",
    retryable: true,
  },
  DOWNLOAD_FAILED: {
    title: "Download Failed",
    message: "We couldn't retrieve the file from storage.",
    suggestion: "Please try again in a moment.",
    retryable: true,
  },
  DATABASE_ERROR: {
    title: "Database Error",
    message: "We're having trouble accessing our database.",
    suggestion: "This is usually temporary. Please try again in a few moments.",
    retryable: true,
  },
  EXTERNAL_SERVICE_ERROR: {
    title: "Service Unavailable",
    message: "An external service we depend on is currently unavailable.",
    suggestion: "We're working to resolve this. Please try again in a few minutes.",
    retryable: true,
  },
  UNKNOWN_ERROR: {
    title: "Something Went Wrong",
    message: "An unexpected error occurred.",
    suggestion: "Please try again. If the problem persists, contact support.",
    retryable: true,
  },
};

/**
 * Detect error code from error message or status
 */
export function detectErrorCode(error: Error | string, statusCode?: number): ErrorCode {
  const errorMessage =
    typeof error === "string" ? error.toLowerCase() : error.message.toLowerCase();

  // Check status code first
  if (statusCode) {
    if (statusCode === 401) return "UNAUTHORIZED";
    if (statusCode === 403) return "FORBIDDEN";
    if (statusCode === 404) return "NOT_FOUND";
    if (statusCode === 402) return "INSUFFICIENT_TOKENS";
    if (statusCode === 429) return "RATE_LIMIT";
    if (statusCode >= 500) return "EXTERNAL_SERVICE_ERROR";
  }

  // Check error message patterns
  if (
    errorMessage.includes("network") ||
    errorMessage.includes("fetch failed") ||
    errorMessage.includes("enotfound") ||
    errorMessage.includes("econnrefused")
  ) {
    return "NETWORK_ERROR";
  }

  if (errorMessage.includes("timeout") || errorMessage.includes("timed out")) {
    return "TIMEOUT";
  }

  if (errorMessage.includes("rate limit") || errorMessage.includes("too many requests")) {
    return "RATE_LIMIT";
  }

  if (errorMessage.includes("insufficient") || errorMessage.includes("not enough tokens")) {
    return "INSUFFICIENT_TOKENS";
  }

  if (errorMessage.includes("unauthorized") || errorMessage.includes("unauthenticated")) {
    return "UNAUTHORIZED";
  }

  if (errorMessage.includes("forbidden") || errorMessage.includes("access denied")) {
    return "FORBIDDEN";
  }

  if (errorMessage.includes("not found")) {
    return "NOT_FOUND";
  }

  if (errorMessage.includes("file too large") || errorMessage.includes("exceeds maximum")) {
    return "FILE_TOO_LARGE";
  }

  if (errorMessage.includes("unsupported") || errorMessage.includes("invalid file type")) {
    return "UNSUPPORTED_FILE_TYPE";
  }

  if (errorMessage.includes("invalid") || errorMessage.includes("validation failed")) {
    return "INVALID_INPUT";
  }

  if (errorMessage.includes("upload failed") || errorMessage.includes("upload error")) {
    return "UPLOAD_FAILED";
  }

  if (errorMessage.includes("download failed") || errorMessage.includes("failed to download")) {
    return "DOWNLOAD_FAILED";
  }

  if (
    errorMessage.includes("database") ||
    errorMessage.includes("prisma") ||
    errorMessage.includes("transaction")
  ) {
    return "DATABASE_ERROR";
  }

  if (errorMessage.includes("enhancement failed") || errorMessage.includes("processing failed")) {
    return "PROCESSING_FAILED";
  }

  return "UNKNOWN_ERROR";
}

/**
 * Get user-friendly error message from error
 */
export function getUserFriendlyError(error: Error | string, statusCode?: number): ErrorMessage {
  const errorCode = detectErrorCode(error, statusCode);
  return ERROR_MESSAGES[errorCode];
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error | string, statusCode?: number): boolean {
  const errorCode = detectErrorCode(error, statusCode);
  return ERROR_MESSAGES[errorCode].retryable;
}
