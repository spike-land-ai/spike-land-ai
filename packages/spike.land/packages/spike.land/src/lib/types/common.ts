/**
 * Common Type Definitions
 *
 * Shared type utilities and common patterns used across the codebase.
 * This file provides type-safe alternatives to `any` and generic `unknown` usage.
 *
 * @see Issue #797: Type Safety Improvements
 */

import type { Prisma } from "@prisma/client";

// =============================================================================
// Cache Types
// =============================================================================

/**
 * Generic cache entry with typed data and expiration
 */
export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

/**
 * Type-safe cache map
 */
export type TypedCache<T> = Map<string, CacheEntry<T>>;

// =============================================================================
// API Response Body Types
// =============================================================================

/**
 * Facebook/Meta API error response structure
 */
export interface FacebookApiError {
  code: number;
  message?: string;
  type?: string;
  error_subcode?: number;
  fbtrace_id?: string;
}

/**
 * Facebook API response with potential error
 */
export interface FacebookApiResponseBody {
  error?: FacebookApiError;
  data?: unknown;
}

/**
 * LinkedIn API error response structure
 */
export interface LinkedInApiErrorBody {
  status?: number;
  message?: string;
  serviceErrorCode?: number;
}

/**
 * Type guard for Facebook API error response
 */
export function isFacebookErrorResponse(
  body: unknown,
): body is { error: FacebookApiError; } {
  return (
    typeof body === "object"
    && body !== null
    && "error" in body
    && typeof (body as Record<string, unknown>).error === "object"
    && (body as Record<string, unknown>).error !== null
    && "code"
      in ((body as Record<string, unknown>).error as Record<string, unknown>)
  );
}

/**
 * Type guard for LinkedIn rate limit error
 */
export function isLinkedInRateLimitError(
  body: unknown,
): body is LinkedInApiErrorBody {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const errorBody = body as Record<string, unknown>;
  return (
    errorBody.status === 429
    || (typeof errorBody.message === "string"
      && errorBody.message.toLowerCase().includes("rate limit"))
  );
}

// =============================================================================
// Prisma Query Types
// =============================================================================

/**
 * Generic Prisma where clause for content suggestions
 */
export interface ContentSuggestionWhereInput {
  workspaceId: string;
  status?: { in: string[]; };
  contentType?: { in: string[]; };
  suggestedPlatforms?: { hasSome: string[]; };
  overallScore?: { gte: number; };
  expiresAt?: { lt: Date; };
}

/**
 * Generic Prisma order by clause
 */
export interface PrismaOrderBy {
  [key: string]: "asc" | "desc";
}

/**
 * Type for Prisma transaction callback
 */
export type PrismaTransactionClient = Omit<
  typeof Prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Generic validation result type
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Type for form field validation errors
 */
export type FieldValidationErrors = Record<string, string[]>;

// =============================================================================
// Error Handling Types
// =============================================================================

/**
 * Base error with optional code property
 */
export interface ErrorWithCode extends Error {
  code: string | number;
}

/**
 * Error with HTTP status property
 */
export interface ErrorWithStatus extends Error {
  status: number;
}

/**
 * Error with response object
 */
export interface ErrorWithResponse extends Error {
  response: {
    status: number;
    data?: unknown;
  };
}

/**
 * Type guard for errors with code property
 */
export function hasCodeProperty(error: unknown): error is ErrorWithCode {
  return (
    error instanceof Error
    && "code" in error
    && (typeof (error as ErrorWithCode).code === "string"
      || typeof (error as ErrorWithCode).code === "number")
  );
}

/**
 * Type guard for errors with status property
 */
export function hasStatusProperty(error: unknown): error is ErrorWithStatus {
  return (
    error instanceof Error
    && "status" in error
    && typeof (error as ErrorWithStatus).status === "number"
  );
}

/**
 * Type guard for errors with response property
 */
export function hasResponseProperty(
  error: unknown,
): error is ErrorWithResponse {
  return (
    error instanceof Error
    && "response" in error
    && typeof (error as ErrorWithResponse).response === "object"
    && (error as ErrorWithResponse).response !== null
    && "status" in (error as ErrorWithResponse).response
  );
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Make specific keys of an object required
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific keys of an object optional
 */
export type OptionalKeys<T, K extends keyof T> =
  & Omit<T, K>
  & Partial<Pick<T, K>>;

/**
 * Extract non-null values from a type
 */
export type NonNullableFields<T> = {
  [K in keyof T]: NonNullable<T[K]>;
};

/**
 * Type for JSON-serializable values
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue; };

/**
 * Type for objects with string keys and unknown values (safer than Record<string, unknown>)
 */
export type StringKeyedObject = { [key: string]: unknown; };

// =============================================================================
// Console and Logging Types
// =============================================================================

/**
 * Console method names
 */
export type ConsoleMethod = "log" | "warn" | "error" | "info" | "debug";

/**
 * Console log level for filtering
 */
export type LogLevel = "error" | "warn" | "info" | "debug";

/**
 * Structured log context
 */
export interface LogContext {
  [key: string]: JsonValue;
}

// =============================================================================
// Function Type Utilities
// =============================================================================

/**
 * Async function type
 */
export type AsyncFunction<T = void> = () => Promise<T>;

/**
 * Callback function with typed argument
 */
export type Callback<T, R = void> = (value: T) => R;

/**
 * Async callback function
 */
export type AsyncCallback<T, R = void> = (value: T) => Promise<R>;

// =============================================================================
// Social Platform Error Response Types (aliases for compatibility)
// =============================================================================

/**
 * Facebook error response type (alias for compatibility with rate-limit-tracker)
 */
export type FacebookErrorResponse = { error: FacebookApiError; };

/**
 * LinkedIn error response type (alias for compatibility with rate-limit-tracker)
 */
export type LinkedInErrorResponse = LinkedInApiErrorBody;

/**
 * Union type for social platform error responses
 */
export type SocialPlatformErrorResponse =
  | FacebookErrorResponse
  | LinkedInErrorResponse;

/**
 * Type guard for LinkedIn error response
 */
export function isLinkedInErrorResponse(
  body: unknown,
): body is LinkedInErrorResponse {
  if (typeof body !== "object" || body === null) {
    return false;
  }
  const errorBody = body as Record<string, unknown>;
  return (
    "status" in errorBody
    || "message" in errorBody
    || "serviceErrorCode" in errorBody
  );
}

// =============================================================================
// Health Monitor Types
// =============================================================================

/**
 * Details for account health events
 * Flexible type to accommodate various event contexts
 */
export interface HealthEventDetails {
  /** Error code if applicable */
  errorCode?: string | number;
  /** Error message if applicable */
  errorMessage?: string;
  /** Generic error string */
  error?: string;
  /** Rate limit information */
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt?: Date | string;
  };
  /** Platform name for account events */
  platform?: string;
  /** Account name for account events */
  accountName?: string;
  /** Rate limit reset timestamp */
  rateLimitResetAt?: Date | string | null;
  /** Number of consecutive errors */
  consecutiveErrors?: number;
  /** Event that was resolved */
  resolvedEventId?: string;
  /** User who initiated the action */
  initiatedBy?: string;
  /** Reason for the event */
  reason?: string;
  /** Additional context data */
  metadata?: Record<string, unknown>;
  /** Allow additional string-keyed properties */
  [key: string]: unknown;
}

/**
 * Cache map type (alias for TypedCache for backwards compatibility)
 */
export type CacheMap<T> = TypedCache<T>;
