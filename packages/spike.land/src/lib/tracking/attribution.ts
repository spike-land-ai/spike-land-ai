/**
 * Campaign Attribution Utilities
 *
 * Manages multi-touch attribution tracking for campaign analytics.
 * Supports first-touch and last-touch attribution models.
 */

import prisma from "@/lib/prisma";
import type { CampaignAttribution, VisitorSession } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  calculatePositionBasedAttribution,
  calculateTimeDecayAttribution,
  determineSessionPlatform,
  extractUTMFromSession,
  getExternalCampaignId,
} from "./attribution-helpers";
import type { AttributionParams, AttributionType, ConversionType } from "./attribution-types";
import { getPlatformFromUTM } from "./utm-capture";

// Re-export types and helpers for backward compatibility
export type {
  AttributionParams,
  AttributionType,
  ConversionType,
} from "./attribution-types";
export {
  calculateDaysDifference,
  calculatePositionBasedAttribution,
  calculateTimeDecayAttribution,
} from "./attribution-helpers";

/**
 * Create an attribution record in the database
 *
 * @param params - Attribution parameters
 */
export async function createAttribution(params: AttributionParams): Promise<void> {
  const {
    userId,
    sessionId,
    conversionId,
    attributionType,
    conversionType,
    conversionValue,
    platform,
    externalCampaignId,
    utmParams,
  } = params;

  // Determine platform from UTM params if not provided
  const derivedPlatform = platform || (utmParams ? getPlatformFromUTM(utmParams) : "DIRECT");

  await prisma.campaignAttribution.create({
    data: {
      userId,
      sessionId,
      conversionId,
      attributionType,
      conversionType,
      ...(conversionValue !== undefined ? { conversionValue } : {}),
      platform: derivedPlatform,
      ...(externalCampaignId !== undefined ? { externalCampaignId } : {}),
      ...(utmParams?.utm_campaign !== undefined ? { utmCampaign: utmParams.utm_campaign } : {}),
      ...(utmParams?.utm_source !== undefined ? { utmSource: utmParams.utm_source } : {}),
      ...(utmParams?.utm_medium !== undefined ? { utmMedium: utmParams.utm_medium } : {}),
    },
  });
}

/**
 * Get the first-touch attribution for a user
 *
 * @param userId - The user ID to look up
 * @returns The first-touch attribution or null
 */
export async function getFirstTouchAttribution(
  userId: string,
): Promise<CampaignAttribution | null> {
  return prisma.campaignAttribution.findFirst({
    where: {
      userId,
      attributionType: "FIRST_TOUCH",
    },
    orderBy: {
      convertedAt: "asc",
    },
  });
}

/**
 * Get the last-touch attribution for a user
 *
 * @param userId - The user ID to look up
 * @returns The last-touch attribution or null
 */
export async function getLastTouchAttribution(userId: string): Promise<CampaignAttribution | null> {
  return prisma.campaignAttribution.findFirst({
    where: {
      userId,
      attributionType: "LAST_TOUCH",
    },
    orderBy: {
      convertedAt: "desc",
    },
  });
}

/**
 * Get all attributions for a user
 *
 * @param userId - The user ID to look up
 * @returns Array of attribution records
 */
export async function getAllAttributions(userId: string): Promise<CampaignAttribution[]> {
  return prisma.campaignAttribution.findMany({
    where: { userId },
    orderBy: { convertedAt: "desc" },
  });
}

/**
 * Build attribution params for a session (shared by all models)
 */
async function buildSessionAttribution(
  userId: string,
  session: VisitorSession,
  conversionId: string,
  attributionType: AttributionType,
  conversionType: ConversionType,
  conversionValue?: number,
): Promise<AttributionParams> {
  const platform = await determineSessionPlatform(session);
  const externalCampaignId =
    (await getExternalCampaignId(session)) || session.gclid || session.fbclid || undefined;
  return {
    userId,
    sessionId: session.id,
    conversionId,
    attributionType,
    conversionType,
    ...(conversionValue !== undefined ? { conversionValue } : {}),
    ...(platform !== undefined ? { platform } : {}),
    ...(externalCampaignId !== undefined ? { externalCampaignId } : {}),
    utmParams: extractUTMFromSession(session),
  };
}

/**
 * Record a conversion with multi-touch attribution
 *
 * Creates FIRST_TOUCH, LAST_TOUCH, LINEAR, TIME_DECAY, and POSITION_BASED
 * attribution records across all user sessions.
 *
 * @param userId - The user ID to attribute
 * @param conversionType - Type of conversion
 * @param value - Optional conversion value
 */
export async function attributeConversion(
  userId: string,
  conversionType: ConversionType,
  value?: number,
): Promise<void> {
  const sessions = await prisma.visitorSession.findMany({
    where: { userId },
    orderBy: { sessionStart: "asc" },
  });

  if (sessions.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!user) {
      console.warn(`No user found for attribution: ${userId}`);
      return;
    }

    await createDirectAttribution(userId, conversionType, value);
    return;
  }

  const conversionId = randomUUID();

  // First-touch and last-touch
  await createAttribution(
    await buildSessionAttribution(
      userId,
      sessions[0]!,
      conversionId,
      "FIRST_TOUCH",
      conversionType,
      value,
    ),
  );
  await createAttribution(
    await buildSessionAttribution(
      userId,
      sessions[sessions.length - 1]!,
      conversionId,
      "LAST_TOUCH",
      conversionType,
      value,
    ),
  );

  // Linear: equal value split across all sessions
  const linearValue = value && sessions.length > 0 ? value / sessions.length : undefined;
  for (const session of sessions) {
    await createAttribution(
      await buildSessionAttribution(
        userId,
        session,
        conversionId,
        "LINEAR",
        conversionType,
        linearValue,
      ),
    );
  }

  // Time-decay: exponential decay weights
  const timeDecayWeights = calculateTimeDecayAttribution(sessions, new Date());
  for (let i = 0; i < sessions.length; i++) {
    await createAttribution(
      await buildSessionAttribution(
        userId,
        sessions[i]!,
        conversionId,
        "TIME_DECAY",
        conversionType,
        value ? value * timeDecayWeights[i]! : undefined,
      ),
    );
  }

  // Position-based: 40/20/40 weighting
  const positionWeights = calculatePositionBasedAttribution(sessions);
  for (let i = 0; i < sessions.length; i++) {
    await createAttribution(
      await buildSessionAttribution(
        userId,
        sessions[i]!,
        conversionId,
        "POSITION_BASED",
        conversionType,
        value ? value * positionWeights[i]! : undefined,
      ),
    );
  }
}

/**
 * Create a direct attribution when no session data is available
 */
async function createDirectAttribution(
  userId: string,
  conversionType: ConversionType,
  value?: number,
): Promise<void> {
  const session = await prisma.visitorSession.create({
    data: {
      visitorId: `direct_${userId}`,
      userId,
      landingPage: "/",
      pageViewCount: 0,
    },
  });
  const conversionId = randomUUID();

  const conversionValueEntry = value !== undefined ? { conversionValue: value } : {};
  await prisma.campaignAttribution.createMany({
    data: [
      {
        userId,
        sessionId: session.id,
        conversionId,
        attributionType: "FIRST_TOUCH",
        conversionType,
        ...conversionValueEntry,
        platform: "DIRECT",
      },
      {
        userId,
        sessionId: session.id,
        conversionId,
        attributionType: "LAST_TOUCH",
        conversionType,
        ...conversionValueEntry,
        platform: "DIRECT",
      },
      {
        userId,
        sessionId: session.id,
        conversionId,
        attributionType: "LINEAR",
        conversionType,
        ...conversionValueEntry,
        platform: "DIRECT",
      },
      {
        userId,
        sessionId: session.id,
        conversionId,
        attributionType: "TIME_DECAY",
        conversionType,
        ...conversionValueEntry,
        platform: "DIRECT",
      },
      {
        userId,
        sessionId: session.id,
        conversionId,
        attributionType: "POSITION_BASED",
        conversionType,
        ...conversionValueEntry,
        platform: "DIRECT",
      },
    ],
  });
}

/**
 * Get attribution summary for a campaign
 *
 * @param campaignName - The campaign name to analyze
 * @param startDate - Start of analysis period
 * @param endDate - End of analysis period
 * @returns Attribution summary statistics
 */
export async function getCampaignAttributionSummary(
  campaignName: string,
  startDate: Date,
  endDate: Date,
): Promise<{
  totalConversions: number;
  firstTouchValue: number;
  lastTouchValue: number;
  linearValue: number;
  conversionsByType: Record<ConversionType, number>;
}> {
  const attributions = await prisma.campaignAttribution.findMany({
    where: {
      utmCampaign: campaignName,
      convertedAt: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  // Group by conversionId to correctly sum values and count conversions
  const conversions = new Map<string, CampaignAttribution[]>();
  for (const attr of attributions) {
    if (!conversions.has(attr.conversionId)) {
      conversions.set(attr.conversionId, []);
    }
    conversions.get(attr.conversionId)!.push(attr);
  }

  const summary = {
    totalConversions: conversions.size,
    firstTouchValue: 0,
    lastTouchValue: 0,
    linearValue: 0,
    conversionsByType: {
      SIGNUP: 0,
      ENHANCEMENT: 0,
      PURCHASE: 0,
    } as Record<ConversionType, number>,
  };

  for (const conversionAttrs of conversions.values()) {
    const firstTouch = conversionAttrs.find((a) => a.attributionType === "FIRST_TOUCH");
    const lastTouch = conversionAttrs.find((a) => a.attributionType === "LAST_TOUCH");
    const linearAttrs = conversionAttrs.filter((a) => a.attributionType === "LINEAR");

    if (firstTouch) {
      summary.firstTouchValue += firstTouch.conversionValue || 0;
      summary.conversionsByType[firstTouch.conversionType as ConversionType]++;
    }
    if (lastTouch) {
      summary.lastTouchValue += lastTouch.conversionValue || 0;
    }
    summary.linearValue += linearAttrs.reduce((sum, a) => sum + (a.conversionValue || 0), 0);
  }

  return summary;
}

/**
 * Check if a user already has attribution for a specific conversion type
 *
 * @param userId - The user ID
 * @param conversionType - The conversion type to check
 * @returns true if attribution exists
 */
export async function hasExistingAttribution(
  userId: string,
  conversionType: ConversionType,
): Promise<boolean> {
  const count = await prisma.campaignAttribution.count({
    where: {
      userId,
      conversionType,
    },
  });

  return count > 0;
}

/**
 * Get global attribution summary for all campaigns
 *
 * @param startDate - Start of analysis period
 * @param endDate - End of analysis period
 * @returns Global attribution summary statistics with platform breakdown
 */
export async function getGlobalAttributionSummary(
  startDate: Date,
  endDate: Date,
): Promise<{
  totalConversions: number;
  comparison: {
    model: AttributionType;
    value: number;
    conversionCount: number;
  }[];
  platformBreakdown: {
    platform: string;
    conversionCount: number;
    value: number;
    model: AttributionType;
  }[];
}> {
  const where = {
    convertedAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  const [totalConversions, modelStats, platformStats] = await Promise.all([
    prisma.campaignAttribution.count({
      where: { ...where, attributionType: "FIRST_TOUCH" },
    }),
    prisma.campaignAttribution.groupBy({
      by: ["attributionType"],
      where,
      _sum: { conversionValue: true },
      _count: { _all: true },
    }),
    prisma.campaignAttribution.groupBy({
      by: ["platform", "attributionType"],
      where,
      _sum: { conversionValue: true },
      _count: { _all: true },
    }),
  ]);

  const models: AttributionType[] = [
    "FIRST_TOUCH",
    "LAST_TOUCH",
    "LINEAR",
    "TIME_DECAY",
    "POSITION_BASED",
  ];
  const comparison = models.map((model) => {
    const stat = modelStats.find((s) => s.attributionType === model);
    return {
      model,
      value: stat?._sum?.conversionValue || 0,
      conversionCount:
        model === "FIRST_TOUCH" || model === "LAST_TOUCH"
          ? stat?._count?._all || 0
          : totalConversions,
    };
  });

  const platformBreakdown = platformStats.map((s) => ({
    platform: s.platform || "UNKNOWN",
    conversionCount: s._count?._all || 0,
    value: s._sum?.conversionValue || 0,
    model: s.attributionType as AttributionType,
  }));

  return {
    totalConversions,
    comparison,
    platformBreakdown,
  };
}
