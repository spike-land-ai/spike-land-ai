/**
 * Social API Type Guards
 *
 * Runtime type guards for validating external API responses.
 * Use these to safely narrow unknown types to specific social platform responses.
 *
 * Resolves #797: Type Safety Improvements
 */

import type {
  FacebookErrorResponse,
  LinkedInErrorResponse,
  SocialPlatformErrorResponse,
  TwitterErrorResponse,
} from "./social-api-responses";

/**
 * Type guard for Facebook error responses
 * Checks if the body contains an "error" field (Facebook's error format)
 */
export function isFacebookErrorResponse(body: unknown): body is FacebookErrorResponse {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;
  return "error" in obj;
}

/**
 * Type guard for LinkedIn error responses.
 * Requires serviceErrorCode, or the combination of a numeric status and a string message.
 * This avoids false positives on generic response objects that happen to have a
 * "status" or "message" field.
 */
export function isLinkedInErrorResponse(body: unknown): body is LinkedInErrorResponse {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;
  if ("serviceErrorCode" in obj) return true;
  return (
    "status" in obj &&
    typeof obj.status === "number" &&
    "message" in obj &&
    typeof obj.message === "string"
  );
}

/**
 * Type guard for Twitter error responses
 * Checks for the "errors" array field
 */
export function isTwitterErrorResponse(body: unknown): body is TwitterErrorResponse {
  if (!body || typeof body !== "object") return false;
  const obj = body as Record<string, unknown>;
  return "errors" in obj && Array.isArray(obj.errors);
}

/**
 * Generic type guard for any social platform error response
 * Useful for generic error handling across platforms
 */
export function isSocialPlatformErrorResponse(body: unknown): body is SocialPlatformErrorResponse {
  return (
    isFacebookErrorResponse(body) || isLinkedInErrorResponse(body) || isTwitterErrorResponse(body)
  );
}
