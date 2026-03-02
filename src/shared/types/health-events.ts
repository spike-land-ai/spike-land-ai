/**
 * Health Event Details Types
 *
 * Type definitions for health monitoring event details.
 * Provides structured types for health event metadata.
 *
 * Resolves #797: Type Safety Improvements
 */

/**
 * Rate limit information for health events
 */
export interface RateLimitEventInfo {
  remaining: number;
  total: number;
  resetAt: string;
}

/**
 * Token expiry information for health events
 */
export interface TokenEventInfo {
  expiresAt: string;
  daysUntilExpiry: number;
}

/**
 * Structured health event details
 * Replaces Record<string, unknown> with specific fields
 */
export interface HealthEventDetails {
  /** Previous health status (for status change events) */
  previousStatus?: string;
  /** New health status (for status change events) */
  newStatus?: string;
  /** Previous health score (for score change events) */
  previousScore?: number;
  /** New health score (for score change events) */
  newScore?: number;
  /** Type of issue detected */
  issueType?: string;
  /** Error message if applicable */
  errorMessage?: string;
  /** Rate limit information */
  rateLimitInfo?: RateLimitEventInfo;
  /** Token expiry information */
  tokenInfo?: TokenEventInfo;
  /** Social platform identifier */
  platform?: string;
  /** Account name for the social platform */
  accountName?: string;
  /** Reason for the event */
  reason?: string;
  /** User who initiated the action */
  initiatedBy?: string;
  /** Related event ID that was resolved */
  resolvedEventId?: string;
  /** User who resolved the event */
  resolvedBy?: string;
  /** Rate limit reset timestamp */
  rateLimitResetAt?: Date | string | null;
  /** Error message or details */
  error?: string;
  /** Number of consecutive errors */
  consecutiveErrors?: number;
  /** Token expiration timestamp */
  tokenExpiresAt?: Date | string | null;
  /** Additional metadata (keep flexible for extensibility) */
  metadata?: Record<string, string | number | boolean>;
}
