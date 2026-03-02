/**
 * Social Platform API Response Types
 *
 * Type definitions for external API responses from social platforms.
 * These types improve type safety when parsing rate limits and error responses.
 *
 * Resolves #797: Type Safety Improvements
 */

// ============================================================================
// Twitter/X API Response Types
// ============================================================================

export interface TwitterRateLimitHeaders {
  "x-rate-limit-remaining": string;
  "x-rate-limit-limit": string;
  "x-rate-limit-reset": string;
}

export interface TwitterErrorResponse {
  errors?: Array<{
    code: number;
    message: string;
  }>;
}

// ============================================================================
// Facebook/Instagram Graph API Response Types
// ============================================================================

/**
 * Business usage header format from Facebook Graph API
 * Format: { "accountId": [{ "call_count": X, "total_cputime": Y, "total_time": Z }] }
 */
export interface FacebookBusinessUsageHeader {
  [accountId: string]: Array<{
    call_count?: number;
    total_cputime?: number;
    total_time?: number;
  }>;
}

/**
 * App usage header format from Facebook Graph API
 */
export interface FacebookAppUsageHeader {
  call_count?: number;
  total_cputime?: number;
  total_time?: number;
}

/**
 * Facebook Graph API error response format
 */
export interface FacebookErrorResponse {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

// ============================================================================
// LinkedIn API Response Types
// ============================================================================

export interface LinkedInErrorResponse {
  status?: number;
  message?: string;
  serviceErrorCode?: number;
}

// ============================================================================
// Discord API Response Types
// ============================================================================

export interface DiscordRateLimitHeaders {
  "x-ratelimit-remaining": string;
  "x-ratelimit-limit": string;
  "x-ratelimit-reset": string;
}

// ============================================================================
// Union Types
// ============================================================================

/**
 * Union type for all platform error responses
 * Useful for functions that handle multiple platform responses
 */
export type SocialPlatformErrorResponse =
  | TwitterErrorResponse
  | FacebookErrorResponse
  | LinkedInErrorResponse;
