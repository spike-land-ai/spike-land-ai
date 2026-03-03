/**
 * Attribution type definitions for campaign tracking
 */

import type { UTMParams } from "./utm-capture";

/**
 * Attribution types matching Prisma schema
 */
export type AttributionType =
  | "FIRST_TOUCH"
  | "LAST_TOUCH"
  | "LINEAR"
  | "TIME_DECAY"
  | "POSITION_BASED";

/**
 * Conversion types matching Prisma schema
 */
export type ConversionType = "SIGNUP" | "ENHANCEMENT" | "PURCHASE";

/**
 * Parameters for creating an attribution record
 */
export interface AttributionParams {
  /** User ID to attribute */
  userId: string;
  /** Session ID associated with the conversion */
  sessionId: string;
  /** Unique ID for the conversion event */
  conversionId: string;
  /** Attribution model type */
  attributionType: AttributionType;
  /** Conversion type */
  conversionType: ConversionType;
  /** Optional conversion value (e.g., tokens, revenue) */
  conversionValue?: number;
  /** Platform identifier */
  platform?: string;
  /** External campaign ID from ad platform */
  externalCampaignId?: string;
  /** UTM parameters */
  utmParams?: UTMParams;
}
