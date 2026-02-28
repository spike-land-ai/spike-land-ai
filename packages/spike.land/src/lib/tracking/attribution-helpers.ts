/**
 * Attribution helper functions
 *
 * Pure utility functions for attribution calculations and session data extraction.
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { VisitorSession } from "@prisma/client";
import type { UTMParams } from "./utm-capture";

/**
 * Calculate the number of days between a session date and conversion date
 *
 * @param sessionDate - The session start date
 * @param conversionDate - The conversion date
 * @returns Number of days difference (can be fractional)
 */
export function calculateDaysDifference(
  sessionDate: Date,
  conversionDate: Date,
): number {
  const diffMs = conversionDate.getTime() - sessionDate.getTime();
  return diffMs / (1000 * 60 * 60 * 24); // Convert milliseconds to days
}

/**
 * Calculate time-decay attribution weights for sessions
 *
 * Uses exponential decay with a 7-day half-life by default.
 * Formula: weight = e^(-0.1 * days_ago)
 *
 * @param sessions - Array of sessions ordered by time
 * @param conversionDate - Date of conversion
 * @param halfLifeDays - Half-life in days (default: 7)
 * @returns Array of weights for each session
 */
export function calculateTimeDecayAttribution(
  sessions: VisitorSession[],
  conversionDate: Date,
  halfLifeDays: number = 7,
): number[] {
  if (sessions.length === 0) return [];

  // Calculate decay rate from half-life: ln(0.5) / half_life = -0.693147 / 7 ≈ -0.099
  const decayRate = Math.log(0.5) / halfLifeDays;

  // Calculate raw weights using exponential decay
  const rawWeights = sessions.map(session => {
    const daysBefore = calculateDaysDifference(
      session.sessionStart,
      conversionDate,
    );
    // Clamp to 0 if future date (shouldn't happen, but safe)
    const daysAgo = Math.max(0, daysBefore);
    return Math.exp(decayRate * daysAgo);
  });

  // Normalize weights to sum to 1
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);
  if (totalWeight === 0) return sessions.map(() => 1 / sessions.length); // Fallback to equal

  return rawWeights.map(w => w / totalWeight);
}

/**
 * Calculate position-based attribution weights for sessions
 *
 * Assigns 40% to first touch, 40% to last touch, and 20% distributed equally among middle touches.
 * If only 1 session: 100% to that session
 * If only 2 sessions: 50% each
 *
 * @param sessions - Array of sessions ordered by time
 * @returns Array of weights for each session
 */
export function calculatePositionBasedAttribution(
  sessions: VisitorSession[],
  firstTouchWeight: number = 0.4,
  lastTouchWeight: number = 0.4,
  middleTouchWeight: number = 0.2,
): number[] {
  if (sessions.length === 0) return [];
  if (sessions.length === 1) return [1.0]; // 100% to only session
  if (sessions.length === 2) return [0.5, 0.5]; // 50/50 split

  const weights = new Array(sessions.length).fill(0);

  // Assign first and last touch
  weights[0] = firstTouchWeight;
  weights[sessions.length - 1] = lastTouchWeight;

  // Distribute middle weight equally
  const middleCount = sessions.length - 2;
  const perMiddleWeight = middleTouchWeight / middleCount;
  for (let i = 1; i < sessions.length - 1; i++) {
    weights[i] = perMiddleWeight;
  }

  return weights;
}

/**
 * Safely parse a URL and return the hostname, or null if invalid
 *
 * @param url - The URL string to parse
 * @returns The hostname or null if parsing fails
 */
export async function safeParseUrlHostname(
  url: string,
): Promise<string | null> {
  const { data, error } = await tryCatch(
    Promise.resolve().then(() => new URL(url).hostname.toLowerCase()),
  );
  if (error) {
    return null;
  }
  return data;
}

/**
 * Determine the platform from session data
 *
 * @param session - The visitor session
 * @returns Platform identifier
 */
export async function determineSessionPlatform(
  session: VisitorSession,
): Promise<string> {
  // Check click IDs first
  if (session.gclid) {
    return "GOOGLE_ADS";
  }
  if (session.fbclid) {
    return "FACEBOOK";
  }

  // Check UTM source
  const source = session.utmSource?.toLowerCase();
  if (source) {
    if (source.includes("google") || source.includes("gads")) {
      return "GOOGLE_ADS";
    }
    if (
      source.includes("facebook")
      || source.includes("fb")
      || source.includes("instagram")
      || source.includes("meta")
    ) {
      return "FACEBOOK";
    }
    return "OTHER";
  }

  // Check referrer for organic search using proper URL parsing
  const referrer = session.referrer;
  if (referrer) {
    const hostname = await safeParseUrlHostname(referrer);
    if (hostname) {
      // Check if the hostname ends with the search engine domain
      const isOrganic = hostname === "google.com"
        || hostname.endsWith(".google.com")
        || hostname === "bing.com"
        || hostname.endsWith(".bing.com")
        || hostname === "duckduckgo.com"
        || hostname.endsWith(".duckduckgo.com");
      if (isOrganic) {
        return "ORGANIC";
      }
    }
    return "OTHER";
  }

  return "DIRECT";
}

/**
 * Get the external campaign ID from a session's UTM campaign
 *
 * @param session - The visitor session
 * @returns The external campaign ID or null
 */
export async function getExternalCampaignId(
  session: VisitorSession,
): Promise<string | null> {
  if (!session.utmCampaign) {
    return null;
  }

  const campaignLink = await prisma.campaignLink.findUnique({
    where: {
      utmCampaign_platform: {
        utmCampaign: session.utmCampaign,
        platform: await determineSessionPlatform(session),
      },
    },
  });

  return campaignLink?.externalCampaignId || null;
}

/**
 * Extract UTM parameters from a session
 *
 * @param session - The visitor session
 * @returns UTMParams object
 */
export function extractUTMFromSession(session: VisitorSession): UTMParams {
  return {
    ...(session.utmSource ? { utm_source: session.utmSource } : {}),
    ...(session.utmMedium ? { utm_medium: session.utmMedium } : {}),
    ...(session.utmCampaign ? { utm_campaign: session.utmCampaign } : {}),
    ...(session.utmTerm ? { utm_term: session.utmTerm } : {}),
    ...(session.utmContent ? { utm_content: session.utmContent } : {}),
    ...(session.gclid ? { gclid: session.gclid } : {}),
    ...(session.fbclid ? { fbclid: session.fbclid } : {}),
  };
}
