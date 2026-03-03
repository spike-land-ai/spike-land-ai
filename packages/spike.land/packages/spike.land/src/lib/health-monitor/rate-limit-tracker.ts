/**
 * Rate Limit Tracker
 *
 * Tracks API rate limit usage from social platform responses.
 * Parses platform-specific headers and updates account health.
 *
 * Resolves #586: Implement Account Health Monitor
 * Resolves #797: Type Safety Improvements
 */

import type {
  FacebookErrorResponse,
  LinkedInErrorResponse,
  SocialPlatformErrorResponse,
} from "@/lib/types/common";
import {
  isFacebookErrorResponse,
  isLinkedInErrorResponse,
} from "@/lib/types/common";
// Duplicate imports removed
import type { SocialPlatform } from "@prisma/client";

import prisma from "@/lib/prisma";

import { getOrCreateHealth, updateHealth } from "./health-calculator";
import type { RateLimitInfo, RateLimitUsage } from "./types";
import { logger } from "@/lib/logger";

/**
 * Parse rate limit headers from Twitter API response
 * Headers: x-rate-limit-remaining, x-rate-limit-reset, x-rate-limit-limit
 */
export function parseTwitterRateLimits(headers: Headers): RateLimitInfo | null {
  const remaining = headers.get("x-rate-limit-remaining");
  const limit = headers.get("x-rate-limit-limit");
  const reset = headers.get("x-rate-limit-reset");

  if (!remaining || !limit || !reset) {
    return null;
  }

  const remainingNum = parseInt(remaining, 10);
  const limitNum = parseInt(limit, 10);
  const resetTimestamp = parseInt(reset, 10) * 1000; // Convert to milliseconds

  return {
    remaining: remainingNum,
    total: limitNum,
    resetAt: new Date(resetTimestamp),
    isLimited: remainingNum === 0,
  };
}

/**
 * Parse rate limit info from Facebook/Instagram Graph API response
 * Uses x-business-use-case-usage or x-app-usage headers
 */
export function parseFacebookRateLimits(
  headers: Headers,
  body?: FacebookErrorResponse,
): RateLimitInfo | null {
  // Try x-business-use-case-usage first
  const businessUsage = headers.get("x-business-use-case-usage");
  if (businessUsage) {
    try {
      const usage = JSON.parse(businessUsage);
      // Format: { "accountId": [{ "call_count": X, "total_cputime": Y, "total_time": Z }] }
      const values = Object.values(usage) as Array<
        Array<
          { call_count?: number; total_cputime?: number; total_time?: number; }
        >
      >;
      const firstValue = values[0];
      const data = firstValue?.[0];
      if (values.length > 0 && firstValue && firstValue.length > 0 && data) {
        const callCount = data.call_count || 0;
        // Facebook uses percentage-based limits
        const remaining = Math.max(0, 100 - callCount);
        return {
          remaining,
          total: 100,
          resetAt: new Date(Date.now() + 60 * 60 * 1000), // Resets in ~1 hour
          isLimited: callCount >= 100,
        };
      }
    } catch (error) {
      // Facebook may return malformed JSON in x-business-use-case-usage header
      // Fall through to try x-app-usage header instead
      logger.debug(
        "Failed to parse x-business-use-case-usage header",
        {
          error: error instanceof Error ? error.message : String(error),
          headerValue: businessUsage,
        },
      );
      // Continue to try x-app-usage
    }
  }

  // Try x-app-usage header
  const appUsage = headers.get("x-app-usage");
  if (appUsage) {
    try {
      const usage = JSON.parse(appUsage) as {
        call_count?: number;
        total_cputime?: number;
        total_time?: number;
      };
      const callCount = usage.call_count || 0;
      const remaining = Math.max(0, 100 - callCount);
      return {
        remaining,
        total: 100,
        resetAt: new Date(Date.now() + 60 * 60 * 1000),
        isLimited: callCount >= 100,
      };
    } catch (error) {
      // Facebook may return malformed JSON in x-app-usage header
      // This is not critical - function will return null to indicate no rate limit data available
      logger.debug(
        "Failed to parse x-app-usage header",
        {
          error: error instanceof Error ? error.message : String(error),
          headerValue: appUsage,
        },
      );
      // Return null below
    }
  }

  // Check response body for error info
  if (isFacebookErrorResponse(body)) {
    if (body.error?.code === 4) {
      // Rate limit error
      return {
        remaining: 0,
        total: 100,
        resetAt: new Date(Date.now() + 60 * 60 * 1000),
        isLimited: true,
      };
    }
  }

  return null;
}

/**
 * Parse rate limit info from LinkedIn API response
 * LinkedIn uses X-Li-ResponseTime and may include rate info in response body
 */
export function parseLinkedInRateLimits(
  _headers: Headers,
  body?: LinkedInErrorResponse,
): RateLimitInfo | null {
  // LinkedIn doesn't provide standard rate limit headers
  // Check for rate limit error in response body
  if (isLinkedInErrorResponse(body)) {
    if (
      body.status === 429
      || (body.message && body.message.toLowerCase().includes("rate limit"))
    ) {
      return {
        remaining: 0,
        total: 100,
        resetAt: new Date(Date.now() + 60 * 1000), // LinkedIn usually resets in 1 minute
        isLimited: true,
      };
    }
  }

  // No rate limit info available
  return null;
}

/**
 * Parse rate limit info based on platform
 */
export function parseRateLimitHeaders(
  platform: SocialPlatform,
  headers: Headers,
  body?: SocialPlatformErrorResponse,
): RateLimitInfo | null {
  switch (platform) {
    case "TWITTER":
      return parseTwitterRateLimits(headers);

    case "FACEBOOK":
    case "INSTAGRAM":
      // Narrow the type to FacebookErrorResponse for Facebook/Instagram
      return parseFacebookRateLimits(
        headers,
        isFacebookErrorResponse(body) ? body : undefined,
      );

    case "LINKEDIN":
      // Narrow the type to LinkedInErrorResponse for LinkedIn
      return parseLinkedInRateLimits(
        headers,
        isLinkedInErrorResponse(body) ? body : undefined,
      );

    case "YOUTUBE":
      // YouTube uses quota-based limits, not easily tracked per-request
      return null;

    case "TIKTOK":
      // TikTok API rate limits vary by endpoint
      return null;

    case "DISCORD":
      // Discord uses different rate limit headers
      const remaining = headers.get("x-ratelimit-remaining");
      const limit = headers.get("x-ratelimit-limit");
      const reset = headers.get("x-ratelimit-reset");
      if (remaining && limit && reset) {
        return {
          remaining: parseInt(remaining, 10),
          total: parseInt(limit, 10),
          resetAt: new Date(parseFloat(reset) * 1000),
          isLimited: remaining === "0",
        };
      }
      return null;

    default:
      return null;
  }
}

/**
 * Clear rate limit status for an account (after reset time passes)
 */
export async function clearAccountRateLimit(accountId: string): Promise<void> {
  const health = await getOrCreateHealth(accountId);

  // Only clear if rate limited and reset time has passed
  if (health.isRateLimited && health.rateLimitResetAt) {
    if (new Date() >= health.rateLimitResetAt) {
      await updateHealth(accountId, {
        rateLimitRemaining: health.rateLimitTotal || 100,
        isRateLimited: false,
      });
    }
  }
}

/**
 * Get rate limit usage for an account
 */
export async function getRateLimitUsage(
  accountId: string,
): Promise<RateLimitUsage | null> {
  const health = await prisma.socialAccountHealth.findUnique({
    where: { accountId },
  });

  if (
    !health
    || health.rateLimitRemaining === null
    || health.rateLimitTotal === null
  ) {
    return null;
  }

  const percentUsed = health.rateLimitTotal > 0
    ? ((health.rateLimitTotal - health.rateLimitRemaining)
      / health.rateLimitTotal) * 100
    : 0;

  return {
    remaining: health.rateLimitRemaining,
    total: health.rateLimitTotal,
    resetAt: health.rateLimitResetAt || new Date(),
    percentUsed,
  };
}

/**
 * Check for rate-limited accounts in a workspace and clear expired limits
 */
export async function checkAndClearExpiredRateLimits(
  workspaceId: string,
): Promise<number> {
  const now = new Date();

  // Find accounts with expired rate limits
  const expiredLimits = await prisma.socialAccountHealth.findMany({
    where: {
      account: { workspaceId },
      isRateLimited: true,
      rateLimitResetAt: { lte: now },
    },
    include: {
      account: { select: { id: true } },
    },
  });

  // Clear each expired rate limit
  for (const health of expiredLimits) {
    await clearAccountRateLimit(health.accountId);
  }

  return expiredLimits.length;
}
