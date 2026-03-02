/**
 * Shared Attribution Types
 *
 * Types used across packages for attribution modeling and analysis.
 */

/**
 * Attribution model types matching Prisma schema
 */
export type AttributionModelType =
  | "FIRST_TOUCH"
  | "LAST_TOUCH"
  | "LINEAR"
  | "TIME_DECAY"
  | "POSITION_BASED";

/**
 * Weight assigned to a session in an attribution model
 */
export interface AttributionWeight {
  /** Session ID */
  sessionId: string;
  /** Weight value (0-1 for fractional, or full value for absolute) */
  weight: number;
  /** Days before conversion */
  daysBefore: number;
}

/**
 * A step in a user's conversion journey
 */
export interface JourneyStep {
  /** Session ID */
  sessionId: string;
  /** Timestamp of the session */
  timestamp: Date;
  /** Platform (e.g., GOOGLE_ADS, FACEBOOK, ORGANIC) */
  platform: string;
  /** UTM source */
  source?: string;
  /** Campaign name */
  campaign?: string;
  /** UTM medium */
  medium?: string;
  /** External campaign ID */
  externalCampaignId?: string;
}

/**
 * Transition between platforms in a journey
 */
export interface PlatformTransition {
  /** Source platform type */
  from: "ORGANIC" | "PAID" | "DIRECT" | "OTHER";
  /** Target platform type */
  to: "ORGANIC" | "PAID" | "DIRECT" | "OTHER";
  /** Number of transitions */
  count: number;
}

/**
 * Configuration for time decay model
 */
export interface TimeDecayConfig {
  /** Half-life in days (default: 7) */
  halfLifeDays?: number;
  /** Decay rate (calculated from half-life if not provided) */
  decayRate?: number;
}

/**
 * Configuration for position-based model
 */
export interface PositionBasedConfig {
  /** Weight for first touch (default: 0.4) */
  firstTouchWeight?: number;
  /** Weight for last touch (default: 0.4) */
  lastTouchWeight?: number;
  /** Weight distributed equally among middle touches (default: 0.2) */
  middleTouchWeight?: number;
}
