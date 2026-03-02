/**
 * Google Ads API Client
 *
 * Wrapper for Google Ads API v18
 * @see https://developers.google.com/google-ads/api/docs/start
 */

import { tryCatch } from "@/lib/try-catch";
import type {
  Campaign,
  CampaignMetrics,
  CampaignObjective,
  CampaignStatus,
  GoogleAdsCampaign,
  GoogleAdsCustomer,
  IMarketingClient,
  MarketingAccountData,
  OAuthTokenResponse,
} from "./types";

const GOOGLE_ADS_API_VERSION = "v18";
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const GOOGLE_OAUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * Map Google Ads campaign status to normalized status
 */
function mapGoogleAdsStatus(status: string): CampaignStatus {
  const statusMap: Record<string, CampaignStatus> = {
    ENABLED: "ACTIVE",
    PAUSED: "PAUSED",
    REMOVED: "DELETED",
  };
  return statusMap[status] || "UNKNOWN";
}

/**
 * Map Google Ads channel type to normalized objective
 */
function mapGoogleAdsObjective(channelType: string): CampaignObjective {
  const objectiveMap: Record<string, CampaignObjective> = {
    SEARCH: "TRAFFIC",
    DISPLAY: "AWARENESS",
    SHOPPING: "SALES",
    VIDEO: "AWARENESS",
    MULTI_CHANNEL: "CONVERSIONS",
    LOCAL: "TRAFFIC",
    SMART: "CONVERSIONS",
    PERFORMANCE_MAX: "CONVERSIONS",
    LOCAL_SERVICES: "LEADS",
    DISCOVERY: "AWARENESS",
    TRAVEL: "SALES",
  };
  return objectiveMap[channelType] || "OTHER";
}

/**
 * Google Ads API Client
 */
export class GoogleAdsClient implements IMarketingClient {
  readonly platform = "GOOGLE_ADS" as const;
  private clientId: string;
  private clientSecret: string;
  private developerToken: string;
  private accessToken?: string;
  private customerId?: string;
  // Cache for customer currency codes to avoid repeated API calls
  private customerCurrencyCache: Map<string, string> = new Map();

  constructor(options?: { accessToken?: string; customerId?: string }) {
    // Trim whitespace/newlines that may be added by environment variable management systems
    this.clientId = (process.env.GOOGLE_ID || "").trim();
    this.clientSecret = (process.env.GOOGLE_SECRET || "").trim();
    this.developerToken = (process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "").trim();
    if (options?.accessToken !== undefined) {
      this.accessToken = options.accessToken;
    }
    if (options?.customerId !== undefined) {
      this.customerId = options.customerId;
    }

    if (!this.clientId || !this.clientSecret) {
      throw new Error("Google OAuth credentials not configured. Set GOOGLE_ID and GOOGLE_SECRET.");
    }
  }

  /**
   * Set access token for authenticated requests
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Set customer ID for API requests
   */
  setCustomerId(customerId: string): void {
    // Remove dashes from customer ID if present
    this.customerId = customerId.replace(/-/g, "");
  }

  /**
   * Validate Account ID format (digits and dashes only)
   */
  private validateAccountId(accountId: string): void {
    if (!/^\d[\d-]*\d$|^\d$/.test(accountId)) {
      throw new Error("Invalid Account ID format");
    }
  }

  /**
   * Validate Campaign ID format (digits only)
   */
  private validateCampaignId(campaignId: string): void {
    if (!/^\d+$/.test(campaignId)) {
      throw new Error("Invalid Campaign ID format");
    }
  }

  /**
   * Make authenticated request to Google Ads API
   */
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.accessToken) {
      throw new Error("Access token not set. Call setAccessToken() first.");
    }

    if (!this.developerToken) {
      throw new Error("Google Ads Developer Token not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN.");
    }

    const url = `${GOOGLE_ADS_API_BASE}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "developer-token": this.developerToken,
      "Content-Type": "application/json",
    };

    if (this.customerId) {
      headers["login-customer-id"] = this.customerId;
    }

    const { data: response, error: fetchError } = await tryCatch(
      fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      }),
    );

    if (fetchError || !response) {
      throw new Error(`Google Ads API Error: ${fetchError?.message || "Network error"}`);
    }

    if (!response.ok) {
      const { data: errorData } = await tryCatch(response.json());
      throw new Error(`Google Ads API Error: ${errorData?.error?.message || response.statusText}`);
    }

    const { data, error: jsonError } = await tryCatch<T>(response.json());

    if (jsonError || data === null || data === undefined) {
      throw new Error(`Google Ads API Error: ${jsonError?.message || "Invalid response"}`);
    }

    return data;
  }

  /**
   * Execute Google Ads Query Language (GAQL) query
   */
  protected async query<T>(customerId: string, gaqlQuery: string): Promise<T[]> {
    const response = await this.request<{ results: T[] }>(
      `/customers/${customerId}/googleAds:searchStream`,
      {
        method: "POST",
        body: JSON.stringify({ query: gaqlQuery }),
      },
    );

    return response.results || [];
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "https://www.googleapis.com/auth/adwords",
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `${GOOGLE_OAUTH_BASE}?${params}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokenResponse> {
    const { data: response, error: fetchError } = await tryCatch(
      fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          grant_type: "authorization_code",
          redirect_uri: redirectUri,
        }),
      }),
    );

    if (fetchError || !response) {
      throw new Error(`Failed to exchange code: ${fetchError?.message || "Network error"}`);
    }

    if (!response.ok) {
      const { data: errorData } = await tryCatch(response.json());
      throw new Error(
        `Failed to exchange code: ${errorData?.error_description || response.statusText}`,
      );
    }

    const { data, error: jsonError } = await tryCatch(response.json());

    if (jsonError || !data) {
      throw new Error(`Failed to parse token response: ${jsonError?.message || "Invalid JSON"}`);
    }

    const googleExpiresAt1 = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      ...(googleExpiresAt1 !== undefined ? { expiresAt: googleExpiresAt1 } : {}),
      tokenType: data.token_type || "Bearer",
      scope: data.scope,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    const { data: response, error: fetchError } = await tryCatch(
      fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      }),
    );

    if (fetchError || !response) {
      throw new Error(`Failed to refresh token: ${fetchError?.message || "Network error"}`);
    }

    if (!response.ok) {
      const { data: errorData } = await tryCatch(response.json());
      throw new Error(
        `Failed to refresh token: ${errorData?.error_description || response.statusText}`,
      );
    }

    const { data, error: jsonError } = await tryCatch(response.json());

    if (jsonError || !data) {
      throw new Error(`Failed to parse token response: ${jsonError?.message || "Invalid JSON"}`);
    }

    const googleExpiresAt2 = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000)
      : undefined;
    return {
      accessToken: data.access_token,
      refreshToken, // Keep the same refresh token
      ...(googleExpiresAt2 !== undefined ? { expiresAt: googleExpiresAt2 } : {}),
      tokenType: data.token_type || "Bearer",
    };
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    const { data: response, error } = await tryCatch(
      fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`),
    );
    if (error || !response) {
      return false;
    }
    const { data: tokenData, error: jsonError } = await tryCatch(response.json());
    if (jsonError || !tokenData) {
      return false;
    }
    return !tokenData.error && tokenData.scope?.includes("adwords");
  }

  /**
   * Get accessible customer accounts
   */
  async getAccounts(): Promise<MarketingAccountData[]> {
    // List accessible customers
    const response = await this.request<{ resourceNames: string[] }>(
      "/customers:listAccessibleCustomers",
      { method: "GET" },
    );

    const accounts: MarketingAccountData[] = [];

    for (const resourceName of response.resourceNames || []) {
      const customerId = resourceName.replace("customers/", "");
      const { data: customerData } = await tryCatch(this.getCustomerInfo(customerId));
      // Skip inaccessible customers (when error occurs, customerData is null)
      if (customerData) {
        accounts.push({
          id: customerId,
          userId: "", // Will be set by caller
          platform: "GOOGLE_ADS",
          accountId: customerId,
          accountName: customerData.descriptiveName,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    return accounts;
  }

  /**
   * Get customer info
   */
  private async getCustomerInfo(customerId: string): Promise<GoogleAdsCustomer | null> {
    const { data: results, error } = await tryCatch(
      this.query<{ customer: GoogleAdsCustomer }>(
        customerId,
        `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1`,
      ),
    );

    if (error || !results) {
      return null;
    }

    const customer = results[0]?.customer || null;

    // Cache the currency code for this customer
    if (customer?.currencyCode) {
      this.customerCurrencyCache.set(customerId, customer.currencyCode);
    }

    return customer;
  }

  /**
   * Get customer currency code (from cache or API)
   */
  private async getCustomerCurrency(customerId: string): Promise<string> {
    // Check cache first
    const cached = this.customerCurrencyCache.get(customerId);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const customer = await this.getCustomerInfo(customerId);
    return customer?.currencyCode || "USD";
  }

  /**
   * List campaigns for a customer
   */
  async listCampaigns(accountId: string): Promise<Campaign[]> {
    this.validateAccountId(accountId);
    const customerId = accountId.replace(/-/g, "");

    // Fetch currency and campaigns in parallel for better performance
    const [currency, results] = await Promise.all([
      this.getCustomerCurrency(customerId),
      this.query<{
        campaign: GoogleAdsCampaign;
        campaignBudget?: { amountMicros: string };
      }>(
        customerId,
        `SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.start_date,
          campaign.end_date,
          campaign.campaign_budget,
          campaign_budget.amount_micros
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name`,
      ),
    ]);

    return results.map((result) =>
      this.mapCampaign(result.campaign, customerId, result.campaignBudget, currency),
    );
  }

  /**
   * Get single campaign details
   */
  async getCampaign(accountId: string, campaignId: string): Promise<Campaign | null> {
    this.validateAccountId(accountId);
    this.validateCampaignId(campaignId);
    const customerId = accountId.replace(/-/g, "");

    // Fetch currency and campaign in parallel for better performance
    const [currency, queryResult] = await Promise.all([
      this.getCustomerCurrency(customerId),
      tryCatch(
        this.query<{
          campaign: GoogleAdsCampaign;
          campaignBudget?: { amountMicros: string };
        }>(
          customerId,
          `SELECT
            campaign.id,
            campaign.name,
            campaign.status,
            campaign.advertising_channel_type,
            campaign.start_date,
            campaign.end_date,
            campaign.campaign_budget,
            campaign_budget.amount_micros
          FROM campaign
          WHERE campaign.id = ${campaignId}`,
        ),
      ),
    ]);

    const { data: results, error } = queryResult;

    if (error || !results) {
      return null;
    }

    const result = results[0];
    if (!result) return null;

    return this.mapCampaign(result.campaign, customerId, result.campaignBudget, currency);
  }

  /**
   * Get campaign metrics
   */
  async getCampaignMetrics(
    accountId: string,
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CampaignMetrics> {
    this.validateAccountId(accountId);
    this.validateCampaignId(campaignId);
    const customerId = accountId.replace(/-/g, "");
    const startStr = (startDate.toISOString().split("T")[0] ?? "").replace(/-/g, "");
    const endStr = (endDate.toISOString().split("T")[0] ?? "").replace(/-/g, "");

    // Fetch currency and metrics in parallel for better performance
    const [currency, results] = await Promise.all([
      this.getCustomerCurrency(customerId),
      this.query<{
        metrics: {
          impressions: string;
          clicks: string;
          costMicros: string;
          conversions: string;
          ctr: string;
          averageCpc: string;
          averageCpm: string;
        };
      }>(
        customerId,
        `SELECT
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_cpm
        FROM campaign
        WHERE campaign.id = ${campaignId}
          AND segments.date BETWEEN '${startStr}' AND '${endStr}'`,
      ),
    ]);

    const data = results[0]?.metrics ?? {
      impressions: "0",
      clicks: "0",
      costMicros: "0",
      conversions: "0",
      ctr: "0",
      averageCpc: "0",
      averageCpm: "0",
    };

    return {
      campaignId,
      platform: "GOOGLE_ADS",
      dateRange: { start: startDate, end: endDate },
      impressions: parseInt(data.impressions, 10),
      clicks: parseInt(data.clicks, 10),
      spend: Math.round(parseInt(data.costMicros, 10) / 10000), // Convert micros to cents
      spendCurrency: currency,
      conversions: parseFloat(data.conversions),
      ctr: parseFloat(data.ctr) * 100, // Convert to percentage
      cpc: Math.round(parseInt(data.averageCpc, 10) / 10000), // Convert micros to cents
      cpm: Math.round(parseInt(data.averageCpm, 10) / 10000),
      reach: 0, // Google Ads doesn't have reach in the same way
      frequency: 0,
    };
  }

  /**
   * Map Google Ads campaign to normalized Campaign type
   */
  private mapCampaign(
    ga: GoogleAdsCampaign,
    customerId: string,
    budget?: { amountMicros: string },
    currency: string = "USD",
  ): Campaign {
    const budgetMicros = parseInt(budget?.amountMicros || "0", 10);

    return {
      id: ga.id,
      platform: "GOOGLE_ADS",
      accountId: customerId,
      name: ga.name,
      status: mapGoogleAdsStatus(ga.status),
      objective: mapGoogleAdsObjective(ga.advertisingChannelType),
      budgetType: "DAILY", // Google Ads uses daily budgets by default
      budgetAmount: Math.round(budgetMicros / 10000), // Convert micros to cents
      budgetCurrency: currency,
      startDate: ga.startDate ? this.parseGoogleDate(ga.startDate) : null,
      endDate: ga.endDate ? this.parseGoogleDate(ga.endDate) : null,
      createdAt: new Date(), // Google Ads doesn't expose creation time in basic query
      updatedAt: new Date(),
      rawData: ga as unknown as Record<string, unknown>,
    };
  }

  /**
   * Parse Google Ads date format (YYYY-MM-DD or YYYYMMDD)
   */
  private parseGoogleDate(dateStr: string): Date | null {
    let date: Date;

    if (dateStr.length === 8) {
      // YYYYMMDD format
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      date = new Date(`${year}-${month}-${day}`);
    } else {
      date = new Date(dateStr);
    }

    // Check for Invalid Date (Date constructor doesn't throw, returns Invalid Date)
    return Number.isNaN(date.getTime()) ? null : date;
  }
}
