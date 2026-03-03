/**
 * Meta Marketing API Client for System Reports
 *
 * Aggregates campaign data from Facebook Marketing API.
 * Wraps the existing FacebookMarketingClient.
 */

import { safeDecryptToken } from "@/lib/crypto/token-encryption";
import logger from "@/lib/logger";
import { FacebookMarketingClient } from "@/lib/marketing/facebook-client";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";

import type { MetaAdsData, MetaCampaignData } from "./types";

/**
 * Check if Meta Marketing is configured
 */
export function isMetaMarketingConfigured(): boolean {
  return !!(
    process.env.FACEBOOK_MARKETING_APP_ID
    && process.env.FACEBOOK_MARKETING_APP_SECRET
  );
}

/**
 * Get stored access token for a user from MarketingAccount
 */
async function getStoredAccessToken(
  userId: string,
): Promise<{ token: string; accountId: string; } | null> {
  const { data: account, error } = await tryCatch(
    prisma.marketingAccount.findFirst({
      where: {
        userId,
        platform: "FACEBOOK",
        isActive: true,
      },
      select: {
        accessToken: true,
        accountId: true,
      },
    }),
  );

  if (error || !account?.accessToken) {
    return null;
  }

  try {
    return {
      token: safeDecryptToken(account.accessToken),
      accountId: account.accountId,
    };
  } catch (e) {
    logger.error("Failed to decrypt token for account", {
      accountId: account.accountId,
      error: e,
    });
    return null;
  }
}

/**
 * Get all active Facebook marketing accounts for admin users
 */
async function getActiveMarketingAccounts(): Promise<
  Array<{ userId: string; accessToken: string; accountId: string; }>
> {
  const { data: accounts, error } = await tryCatch(
    prisma.marketingAccount.findMany({
      where: {
        platform: "FACEBOOK",
        isActive: true,
      },
      select: {
        userId: true,
        accessToken: true,
        accountId: true,
      },
    }),
  );

  if (error || !accounts) {
    return [];
  }

  return accounts
    .filter(account => account.accessToken !== null)
    .map(account => {
      try {
        return {
          ...account,
          accessToken: safeDecryptToken(account.accessToken!),
        };
      } catch (e) {
        logger.error("Failed to decrypt token for account in active list", {
          accountId: account.accountId,
          error: e,
        });
        return null;
      }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);
}

/**
 * Fetch campaign metrics for a specific account
 */
async function fetchAccountMetrics(
  client: FacebookMarketingClient,
  accountId: string,
  startDate: Date,
  endDate: Date,
): Promise<MetaCampaignData[]> {
  const { data: campaigns, error: listError } = await tryCatch(
    client.listCampaigns(accountId),
  );

  if (listError || !campaigns) {
    logger.error("Failed to list Facebook campaigns", { error: listError });
    return [];
  }

  const campaignMetrics: MetaCampaignData[] = [];

  for (const campaign of campaigns) {
    const { data: metrics, error: metricsError } = await tryCatch(
      client.getCampaignMetrics(accountId, campaign.id, startDate, endDate),
    );

    if (metricsError || !metrics) {
      logger.error(`Failed to get metrics for campaign ${campaign.id}`, {
        error: metricsError,
      });
      continue;
    }

    campaignMetrics.push({
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      spend: metrics.spend / 100, // Convert from cents
      impressions: metrics.impressions,
      clicks: metrics.clicks,
      conversions: metrics.conversions,
    });
  }

  return campaignMetrics;
}

/**
 * Aggregate metrics across all campaigns
 */
function aggregateMetrics(campaigns: MetaCampaignData[]): MetaAdsData {
  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0);
  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0);

  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  return {
    campaigns,
    totalSpend,
    totalImpressions,
    totalClicks,
    totalConversions,
    ctr: Math.round(ctr * 100) / 100, // 2 decimal places
    cpc: Math.round(cpc * 100) / 100,
  };
}

/**
 * Fetch Meta Ads data for a specific user's account
 */
export async function fetchMetaAdsForUser(
  userId: string,
  startDate: Date,
  endDate: Date,
): Promise<MetaAdsData | null> {
  if (!isMetaMarketingConfigured()) {
    return null;
  }

  const credentials = await getStoredAccessToken(userId);

  if (!credentials) {
    return null;
  }

  const { data: client, error: clientError } = await tryCatch(
    Promise.resolve(
      new FacebookMarketingClient({ accessToken: credentials.token }),
    ),
  );

  if (clientError || !client) {
    logger.error("Failed to create Facebook client", { error: clientError });
    return null;
  }

  const campaigns = await fetchAccountMetrics(
    client,
    credentials.accountId,
    startDate,
    endDate,
  );

  return aggregateMetrics(campaigns);
}

/**
 * Fetch Meta Ads data aggregated across all connected accounts
 * Used for system-wide reports
 */
export async function fetchMetaAdsAggregated(
  startDate: Date,
  endDate: Date,
): Promise<MetaAdsData | null> {
  if (!isMetaMarketingConfigured()) {
    return null;
  }

  const accounts = await getActiveMarketingAccounts();

  if (accounts.length === 0) {
    return null;
  }

  const allCampaigns: MetaCampaignData[] = [];

  for (const account of accounts) {
    const { data: client, error: clientError } = await tryCatch(
      Promise.resolve(
        new FacebookMarketingClient({ accessToken: account.accessToken }),
      ),
    );

    if (clientError || !client) {
      logger.error(`Failed to create client for account ${account.accountId}`, {
        error: clientError,
      });
      continue;
    }

    const campaigns = await fetchAccountMetrics(
      client,
      account.accountId,
      startDate,
      endDate,
    );

    allCampaigns.push(...campaigns);
  }

  if (allCampaigns.length === 0) {
    return null;
  }

  return aggregateMetrics(allCampaigns);
}

/**
 * Validate a stored access token
 */
export async function validateStoredToken(userId: string): Promise<boolean> {
  if (!isMetaMarketingConfigured()) {
    return false;
  }

  const credentials = await getStoredAccessToken(userId);

  if (!credentials) {
    return false;
  }

  const { data: client, error: clientError } = await tryCatch(
    Promise.resolve(new FacebookMarketingClient()),
  );

  if (clientError || !client) {
    return false;
  }

  const { data: isValid, error } = await tryCatch(
    client.validateToken(credentials.token),
  );

  return !error && isValid === true;
}
