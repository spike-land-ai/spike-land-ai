/**
 * External Campaign Sync Service
 *
 * Syncs campaign data from external marketing platforms (Facebook Ads, Google Ads)
 * with internal UTM campaign tracking for ROI calculation.
 */

import {
  safeDecryptToken,
  safeEncryptToken,
} from "@/lib/crypto/token-encryption";
import prisma from "@/lib/prisma";
import { pMap } from "@/lib/promise-utils";
import { setCachedMetrics } from "@/lib/tracking/metrics-cache";
import { tryCatch } from "@/lib/try-catch";
import { createMarketingClient } from "./index";
import type { CampaignMetrics, MarketingPlatform } from "./types";

interface SyncResult {
  synced: number;
  errors: string[];
}

interface CampaignSpendData {
  campaignId: string;
  platform: MarketingPlatform;
  utmCampaign: string;
  spend: number;
  spendCurrency: string;
  impressions: number;
  clicks: number;
  conversions: number;
  dateRange: {
    start: Date;
    end: Date;
  };
}

/**
 * Sync external campaigns from all connected marketing accounts
 *
 * This function:
 * 1. Gets all connected marketing accounts from the database
 * 2. For each account, fetches campaigns using the marketing API clients
 * 3. For linked campaigns (via CampaignLink), fetches spend data
 * 4. Stores aggregated metrics in CampaignMetricsCache for ROI calculation
 */
export async function syncExternalCampaigns(): Promise<SyncResult> {
  const result: SyncResult = {
    synced: 0,
    errors: [],
  };

  // 1. Get all active connected marketing accounts
  const { data: accounts, error: accountsError } = await tryCatch(
    prisma.marketingAccount.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        userId: true,
        platform: true,
        accountId: true,
        accessToken: true,
        refreshToken: true,
        accessTokenEncrypted: true,
        refreshTokenEncrypted: true,
        expiresAt: true,
      },
    }),
  );

  if (accountsError) {
    result.errors.push(
      `Sync failed: ${accountsError.message}`,
    );
    return result;
  }

  if (accounts.length === 0) {
    return result;
  }

  // 2. Get all campaign links for matching UTM campaigns to external IDs
  const { data: campaignLinks, error: linksError } = await tryCatch(
    prisma.campaignLink.findMany(),
  );

  if (linksError) {
    result.errors.push(
      `Sync failed: ${linksError.message}`,
    );
    return result;
  }

  const linksByExternal = new Map<string, typeof campaignLinks[0]>();
  for (const link of campaignLinks) {
    const key = `${link.platform}:${link.externalCampaignId}`;
    linksByExternal.set(key, link);
  }

  // Define date range for metrics (last 30 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  const allSpendData: CampaignSpendData[] = [];

  // 3. For each account, fetch campaigns and metrics
  for (const account of accounts) {
    const currentRefreshToken = account.refreshTokenEncrypted
      || account.refreshToken;

    // Check if token is expired
    if (account.expiresAt && new Date(account.expiresAt) < new Date()) {
      // Try to refresh token if we have a refresh token
      if (currentRefreshToken) {
        const { data: refreshed, error: refreshError } = await tryCatch(
          refreshAccountToken(
            account.id,
            account.platform as MarketingPlatform,
            safeDecryptToken(currentRefreshToken),
          ),
        );

        if (refreshError) {
          result.errors.push(
            `Account ${account.accountId} (${account.platform}): Token refresh error: ${refreshError.message}`,
          );
          continue;
        }

        if (!refreshed) {
          result.errors.push(
            `Account ${account.accountId} (${account.platform}): Token expired and refresh failed`,
          );
          continue;
        }
      } else {
        result.errors.push(
          `Account ${account.accountId} (${account.platform}): Token expired and no refresh token`,
        );
        continue;
      }
    }

    const client = createMarketingClient(
      account.platform as MarketingPlatform,
      {
        accessToken: safeDecryptToken(
          account.accessTokenEncrypted || account.accessToken || "",
        ),
        customerId: account.accountId,
      },
    );

    // Fetch campaigns
    const { data: campaigns, error: campaignsError } = await tryCatch(
      client.listCampaigns(account.accountId),
    );

    if (campaignsError) {
      result.errors.push(
        `Account ${account.accountId} (${account.platform}): ${campaignsError.message}`,
      );
      continue;
    }

    // Filter only linked campaigns to avoid unnecessary processing
    const linkedCampaigns = campaigns.filter(campaign => {
      const linkKey = `${account.platform}:${campaign.id}`;
      return linksByExternal.has(linkKey);
    });

    // Parallel fetch metrics with concurrency limit to avoid rate limits
    // while significantly speeding up sync for many campaigns
    await pMap(
      linkedCampaigns,
      async campaign => {
        const linkKey = `${account.platform}:${campaign.id}`;
        const link = linksByExternal.get(linkKey);

        if (!link) return;

        // Campaign is linked - fetch metrics
        const { data: metrics, error: metricsError } = await tryCatch(
          client.getCampaignMetrics(
            account.accountId,
            campaign.id,
            startDate,
            endDate,
          ),
        );

        if (metricsError) {
          result.errors.push(
            `Campaign ${campaign.id} (${campaign.name}): ${metricsError.message}`,
          );
          return;
        }

        allSpendData.push({
          campaignId: campaign.id,
          platform: account.platform as MarketingPlatform,
          utmCampaign: link.utmCampaign,
          spend: metrics.spend,
          spendCurrency: metrics.spendCurrency,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
          conversions: metrics.conversions,
          dateRange: {
            start: startDate,
            end: endDate,
          },
        });

        result.synced++;
      },
      2, // Concurrency limit (reduced for stability in CI)
    );
  }

  // 4. Store aggregated spend data in cache for ROI calculation
  if (allSpendData.length > 0) {
    await cacheExternalSpendData(allSpendData, startDate, endDate);
  }

  return result;
}

/**
 * Refresh an account's access token
 */
async function refreshAccountToken(
  accountId: string,
  platform: MarketingPlatform,
  refreshToken: string,
): Promise<boolean> {
  const client = createMarketingClient(platform);

  const { data: newTokens, error: tokenError } = await tryCatch(
    client.refreshAccessToken(refreshToken),
  );

  if (tokenError) {
    return false;
  }

  // Encrypt new tokens before storing in database
  const encryptedAccessToken = safeEncryptToken(newTokens.accessToken);
  const encryptedRefreshToken = safeEncryptToken(
    newTokens.refreshToken || refreshToken,
  );

  const { error: updateError } = await tryCatch(
    prisma.marketingAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        accessToken: null, // Clear legacy fields
        refreshToken: null,
        ...(newTokens.expiresAt !== undefined ? { expiresAt: newTokens.expiresAt } : {}),
        updatedAt: new Date(),
      },
    }),
  );

  if (updateError) {
    return false;
  }

  return true;
}

/**
 * Cache external spend data for ROI calculation
 */
async function cacheExternalSpendData(
  spendData: CampaignSpendData[],
  startDate: Date,
  endDate: Date,
): Promise<void> {
  // Aggregate by UTM campaign
  const aggregatedByUtm = new Map<string, {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    currency: string;
    platforms: Set<string>;
  }>();

  for (const data of spendData) {
    const existing = aggregatedByUtm.get(data.utmCampaign) || {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      currency: data.spendCurrency,
      platforms: new Set<string>(),
    };

    existing.totalSpend += data.spend;
    existing.totalImpressions += data.impressions;
    existing.totalClicks += data.clicks;
    existing.totalConversions += data.conversions;
    existing.platforms.add(data.platform);

    aggregatedByUtm.set(data.utmCampaign, existing);
  }

  // Store in cache
  const dateRangeKey = `${startDate.toISOString().split("T")[0]}:${
    endDate.toISOString().split("T")[0]
  }`;

  // Cache individual campaign spend data
  for (const [utmCampaign, metrics] of aggregatedByUtm) {
    const cacheKey = `external_spend:${utmCampaign}:${dateRangeKey}`;
    await setCachedMetrics(cacheKey, {
      utmCampaign,
      ...metrics,
      platforms: Array.from(metrics.platforms),
      syncedAt: new Date().toISOString(),
    }, 3600); // Cache for 1 hour
  }

  // Cache aggregated totals
  const totals = {
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    campaignCount: aggregatedByUtm.size,
    syncedAt: new Date().toISOString(),
  };

  for (const metrics of aggregatedByUtm.values()) {
    totals.totalSpend += metrics.totalSpend;
    totals.totalImpressions += metrics.totalImpressions;
    totals.totalClicks += metrics.totalClicks;
    totals.totalConversions += metrics.totalConversions;
  }

  await setCachedMetrics(`external_spend_totals:${dateRangeKey}`, totals, 3600);
}

/**
 * Get cached external spend for a UTM campaign
 */
export async function getExternalSpendForCampaign(
  utmCampaign: string,
  startDate: Date,
  endDate: Date,
): Promise<CampaignMetrics | null> {
  const dateRangeKey = `${startDate.toISOString().split("T")[0]}:${
    endDate.toISOString().split("T")[0]
  }`;
  const cacheKey = `external_spend:${utmCampaign}:${dateRangeKey}`;

  const cached = await prisma.campaignMetricsCache.findUnique({
    where: { cacheKey },
  });

  if (!cached || new Date() > cached.expiresAt) {
    return null;
  }

  const data = cached.metrics as {
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalConversions: number;
    currency: string;
    platforms: string[];
  };

  return {
    campaignId: utmCampaign,
    platform: data.platforms[0] as MarketingPlatform || "FACEBOOK",
    dateRange: { start: startDate, end: endDate },
    impressions: data.totalImpressions,
    clicks: data.totalClicks,
    spend: data.totalSpend,
    spendCurrency: data.currency || "USD",
    conversions: data.totalConversions,
    ctr: data.totalImpressions > 0
      ? (data.totalClicks / data.totalImpressions) * 100
      : 0,
    cpc: data.totalClicks > 0 ? data.totalSpend / data.totalClicks : 0,
    cpm: data.totalImpressions > 0
      ? (data.totalSpend / data.totalImpressions) * 1000
      : 0,
    reach: 0,
    frequency: 0,
  };
}
