/**
 * Marketing Platform Types
 *
 * Shared TypeScript types for Facebook Marketing API and Google Ads API
 */

export type MarketingPlatform = "FACEBOOK" | "GOOGLE_ADS";

// Campaign Status (normalized across platforms)
export type CampaignStatus =
  | "ACTIVE"
  | "PAUSED"
  | "DELETED"
  | "ARCHIVED"
  | "UNKNOWN";

// Campaign Objective (normalized across platforms)
export type CampaignObjective =
  | "AWARENESS"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "LEADS"
  | "APP_PROMOTION"
  | "SALES"
  | "CONVERSIONS"
  | "OTHER";

/**
 * Connected Marketing Account
 */
export interface MarketingAccountData {
  id: string;
  userId: string;
  platform: MarketingPlatform;
  accountId: string;
  accountName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Normalized Campaign Data (works for both FB and Google)
 */
export interface Campaign {
  id: string;
  platform: MarketingPlatform;
  accountId: string;
  name: string;
  status: CampaignStatus;
  objective: CampaignObjective;
  budgetType: "DAILY" | "LIFETIME" | "UNKNOWN";
  budgetAmount: number; // in cents/smallest currency unit
  budgetCurrency: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  // Platform-specific raw data
  rawData: Record<string, unknown>;
}

/**
 * Campaign Metrics (analytics data)
 */
export interface CampaignMetrics {
  campaignId: string;
  platform: MarketingPlatform;
  dateRange: {
    start: Date;
    end: Date;
  };
  impressions: number;
  clicks: number;
  spend: number; // in cents
  spendCurrency: string;
  conversions: number;
  ctr: number; // click-through rate (percentage)
  cpc: number; // cost per click (in cents)
  cpm: number; // cost per 1000 impressions (in cents)
  reach: number;
  frequency: number;
}

/**
 * Aggregated Marketing Overview
 */
export interface MarketingOverview {
  totalSpend: number;
  spendCurrency: string;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  averageCtr: number;
  averageCpc: number;
  activeCampaigns: number;
  pausedCampaigns: number;
  connectedAccounts: {
    facebook: number;
    googleAds: number;
  };
}

/**
 * OAuth Token Response
 */
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType: string;
  scope?: string;
}

/**
 * Facebook-specific types
 */
export interface FacebookAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
  amount_spent?: string;
}

export interface FacebookCampaignResponse {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
  start_time?: string;
  stop_time?: string;
  created_time: string;
  updated_time: string;
}

/**
 * Google Ads-specific types
 */
export interface GoogleAdsCampaign {
  resourceName: string;
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  startDate?: string;
  endDate?: string;
  campaignBudget: string;
}

export interface GoogleAdsCustomer {
  resourceName: string;
  id: string;
  descriptiveName: string;
  currencyCode: string;
  timeZone: string;
}

/**
 * API Error Response
 */
export interface MarketingApiError {
  platform: MarketingPlatform;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Marketing Client Interface
 */
export interface IMarketingClient {
  platform: MarketingPlatform;

  // Account Management
  getAccounts(): Promise<MarketingAccountData[]>;
  validateToken(accessToken: string): Promise<boolean>;

  // Campaigns
  listCampaigns(accountId: string): Promise<Campaign[]>;
  getCampaign(accountId: string, campaignId: string): Promise<Campaign | null>;
  getCampaignMetrics(
    accountId: string,
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CampaignMetrics>;

  // OAuth
  getAuthUrl(redirectUri: string, state: string): string;
  exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokenResponse>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse>;
}
