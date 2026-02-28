/**
 * Facebook Marketing API Client
 *
 * Wrapper for Facebook Marketing API v21.0
 * @see https://developers.facebook.com/docs/marketing-api/get-started
 */

import { tryCatch } from "@/lib/try-catch";

import type {
  Campaign,
  CampaignMetrics,
  CampaignObjective,
  CampaignStatus,
  FacebookAdAccount,
  FacebookCampaignResponse,
  IMarketingClient,
  MarketingAccountData,
  OAuthTokenResponse,
} from "./types";

const FACEBOOK_GRAPH_API_VERSION = "v21.0";
const FACEBOOK_GRAPH_API_BASE = `https://graph.facebook.com/${FACEBOOK_GRAPH_API_VERSION}`;
const FACEBOOK_OAUTH_BASE = "https://www.facebook.com";

/**
 * Map Facebook campaign status to normalized status
 */
function mapFacebookStatus(status: string): CampaignStatus {
  const statusMap: Record<string, CampaignStatus> = {
    ACTIVE: "ACTIVE",
    PAUSED: "PAUSED",
    DELETED: "DELETED",
    ARCHIVED: "ARCHIVED",
  };
  return statusMap[status] || "UNKNOWN";
}

/**
 * Map Facebook campaign objective to normalized objective
 */
function mapFacebookObjective(objective: string): CampaignObjective {
  const objectiveMap: Record<string, CampaignObjective> = {
    BRAND_AWARENESS: "AWARENESS",
    REACH: "AWARENESS",
    LINK_CLICKS: "TRAFFIC",
    POST_ENGAGEMENT: "ENGAGEMENT",
    PAGE_LIKES: "ENGAGEMENT",
    LEAD_GENERATION: "LEADS",
    APP_INSTALLS: "APP_PROMOTION",
    CONVERSIONS: "CONVERSIONS",
    PRODUCT_CATALOG_SALES: "SALES",
  };
  return objectiveMap[objective] || "OTHER";
}

/**
 * Facebook Marketing API Client
 */
export class FacebookMarketingClient implements IMarketingClient {
  readonly platform = "FACEBOOK" as const;
  private appId: string;
  private appSecret: string;
  private accessToken?: string;
  // Cache for account currencies to avoid repeated API calls
  private accountCurrencyCache: Map<string, string> = new Map();

  constructor(options?: { accessToken?: string; }) {
    // Trim whitespace/newlines that may be added by environment variable management systems
    this.appId = (process.env.FACEBOOK_MARKETING_APP_ID || "").trim();
    this.appSecret = (process.env.FACEBOOK_MARKETING_APP_SECRET || "").trim();
    if (options?.accessToken !== undefined) {
      this.accessToken = options.accessToken;
    }

    if (!this.appId || !this.appSecret) {
      throw new Error(
        "Facebook Marketing API credentials not configured. Set FACEBOOK_MARKETING_APP_ID and FACEBOOK_MARKETING_APP_SECRET.",
      );
    }
  }

  /**
   * Set access token for authenticated requests
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }

  /**
   * Make authenticated request to Facebook Graph API
   * Uses Authorization header for secure token transmission (not URL params)
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error("Access token not set. Call setAccessToken() first.");
    }

    const url = new URL(`${FACEBOOK_GRAPH_API_BASE}${endpoint}`);

    const { data: response, error: fetchError } = await tryCatch(
      fetch(url.toString(), {
        ...options,
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
      }),
    );

    if (fetchError || !response) {
      throw new Error(
        `Facebook API Error: ${fetchError?.message || "Network error"}`,
      );
    }

    if (!response.ok) {
      const { data: errorData } = await tryCatch(response.json());
      throw new Error(
        `Facebook API Error: ${errorData?.error?.message || response.statusText}`,
      );
    }

    const { data, error: jsonError } = await tryCatch<T>(response.json());

    if (jsonError || data === null || data === undefined) {
      throw new Error(
        `Facebook API Error: ${jsonError?.message || "Invalid response"}`,
      );
    }

    return data;
  }

  /**
   * Get OAuth authorization URL
   */
  getAuthUrl(redirectUri: string, state: string): string {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: redirectUri,
      state,
      scope: "ads_read,ads_management,business_management",
      response_type: "code",
    });
    return `${FACEBOOK_OAUTH_BASE}/${FACEBOOK_GRAPH_API_VERSION}/dialog/oauth?${params}`;
  }

  /**
   * Exchange authorization code for access tokens
   */
  async exchangeCodeForTokens(
    code: string,
    redirectUri: string,
  ): Promise<OAuthTokenResponse> {
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const { data: response, error: fetchError } = await tryCatch(
      fetch(`${FACEBOOK_GRAPH_API_BASE}/oauth/access_token?${params}`),
    );

    if (fetchError || !response) {
      throw new Error(
        `Failed to exchange code: ${fetchError?.message || "Network error"}`,
      );
    }

    if (!response.ok) {
      const { data: errorData } = await tryCatch(response.json());
      throw new Error(
        `Failed to exchange code: ${errorData?.error?.message || response.statusText}`,
      );
    }

    const { data, error: jsonError } = await tryCatch(response.json());

    if (jsonError || !data) {
      throw new Error(
        `Failed to exchange code: ${jsonError?.message || "Invalid response"}`,
      );
    }

    // Exchange short-lived token for long-lived token
    const longLivedToken = await this.getLongLivedToken(data.access_token);

    const expiresAt1 = longLivedToken.expires_in
      ? new Date(Date.now() + longLivedToken.expires_in * 1000)
      : undefined;
    return {
      accessToken: longLivedToken.access_token,
      ...(expiresAt1 !== undefined ? { expiresAt: expiresAt1 } : {}),
      tokenType: data.token_type || "bearer",
    };
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  private async getLongLivedToken(
    shortLivedToken: string,
  ): Promise<{ access_token: string; expires_in?: number; }> {
    const params = new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: this.appId,
      client_secret: this.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const { data: response, error: fetchError } = await tryCatch(
      fetch(`${FACEBOOK_GRAPH_API_BASE}/oauth/access_token?${params}`),
    );

    if (fetchError || !response || !response.ok) {
      // Return original token if exchange fails
      return { access_token: shortLivedToken };
    }

    const { data, error: jsonError } = await tryCatch(response.json());

    if (jsonError || !data) {
      // Return original token if parsing fails
      return { access_token: shortLivedToken };
    }

    return data;
  }

  /**
   * Refresh access token (Facebook uses long-lived tokens, refresh by re-exchanging)
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokenResponse> {
    // Facebook doesn't have traditional refresh tokens
    // Long-lived tokens need to be refreshed by the user re-authenticating
    // For page tokens, you can get a new one with the user token
    const result = await this.getLongLivedToken(refreshToken);

    const expiresAt2 = result.expires_in
      ? new Date(Date.now() + result.expires_in * 1000)
      : undefined;
    return {
      accessToken: result.access_token,
      ...(expiresAt2 !== undefined ? { expiresAt: expiresAt2 } : {}),
      tokenType: "bearer",
    };
  }

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<boolean> {
    const params = new URLSearchParams({
      input_token: accessToken,
      access_token: `${this.appId}|${this.appSecret}`,
    });

    const { data: response, error } = await tryCatch(
      fetch(`${FACEBOOK_GRAPH_API_BASE}/debug_token?${params}`),
    );

    if (error || !response) {
      return false;
    }

    const { data: jsonData, error: jsonError } = await tryCatch(
      response.json(),
    );

    if (jsonError || !jsonData) {
      return false;
    }

    return jsonData.data?.is_valid === true;
  }

  /**
   * Get ad accounts accessible with current token
   */
  async getAccounts(): Promise<MarketingAccountData[]> {
    const response = await this.request<{
      data: FacebookAdAccount[];
    }>("/me/adaccounts?fields=id,name,account_status,currency,timezone_name");

    // Cache the currency for each account
    for (const account of response.data) {
      if (account.currency) {
        this.accountCurrencyCache.set(account.id, account.currency);
        // Also cache without act_ prefix for convenience
        this.accountCurrencyCache.set(
          account.id.replace("act_", ""),
          account.currency,
        );
      }
    }

    return response.data.map(account => ({
      id: account.id,
      userId: "", // Will be set by caller
      platform: "FACEBOOK" as const,
      accountId: account.id.replace("act_", ""),
      accountName: account.name,
      isActive: account.account_status === 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  }

  /**
   * Get account currency code (from cache or API)
   */
  private async getAccountCurrency(accountId: string): Promise<string> {
    // Normalize account ID
    const normalizedId = accountId.startsWith("act_")
      ? accountId
      : `act_${accountId}`;
    const baseId = accountId.replace("act_", "");

    // Check cache first (both formats)
    const cached = this.accountCurrencyCache.get(normalizedId)
      || this.accountCurrencyCache.get(baseId);
    if (cached) {
      return cached;
    }

    // Fetch from API
    const { data: response, error } = await tryCatch(
      this.request<FacebookAdAccount>(
        `/${normalizedId}?fields=currency`,
      ),
    );

    if (error || !response?.currency) {
      return "USD";
    }

    // Cache the result
    this.accountCurrencyCache.set(normalizedId, response.currency);
    this.accountCurrencyCache.set(baseId, response.currency);

    return response.currency;
  }

  /**
   * List campaigns for an ad account
   */
  async listCampaigns(accountId: string): Promise<Campaign[]> {
    const actId = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

    // Fetch currency and campaigns in parallel for better performance
    const [currency, response] = await Promise.all([
      this.getAccountCurrency(accountId),
      this.request<{
        data: FacebookCampaignResponse[];
      }>(
        `/${actId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time`,
      ),
    ]);

    return response.data.map(campaign => this.mapCampaign(campaign, accountId, currency));
  }

  /**
   * Get single campaign details
   */
  async getCampaign(
    accountId: string,
    campaignId: string,
  ): Promise<Campaign | null> {
    // Fetch currency and campaign in parallel for better performance
    const [currency, campaignResult] = await Promise.all([
      this.getAccountCurrency(accountId),
      tryCatch(
        this.request<FacebookCampaignResponse>(
          `/${campaignId}?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget,start_time,stop_time,created_time,updated_time`,
        ),
      ),
    ]);

    const { data: response, error } = campaignResult;

    if (error || !response) {
      return null;
    }

    return this.mapCampaign(response, accountId, currency);
  }

  /**
   * Get campaign metrics/insights
   */
  async getCampaignMetrics(
    accountId: string,
    campaignId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CampaignMetrics> {
    const dateRange = JSON.stringify({
      since: startDate.toISOString().split("T")[0],
      until: endDate.toISOString().split("T")[0],
    });

    // Fetch currency and metrics in parallel for better performance
    const [currency, response] = await Promise.all([
      this.getAccountCurrency(accountId),
      this.request<{
        data: Array<{
          impressions: string;
          clicks: string;
          spend: string;
          conversions?: string;
          reach: string;
          frequency: string;
          ctr: string;
          cpc: string;
          cpm: string;
        }>;
      }>(
        `/${campaignId}/insights?fields=impressions,clicks,spend,conversions,reach,frequency,ctr,cpc,cpm&time_range=${
          encodeURIComponent(dateRange)
        }`,
      ),
    ]);

    const data = response.data[0] ?? {
      impressions: "0",
      clicks: "0",
      spend: "0",
      conversions: "0",
      reach: "0",
      frequency: "0",
      ctr: "0",
      cpc: "0",
      cpm: "0",
    };

    return {
      campaignId,
      platform: "FACEBOOK",
      dateRange: { start: startDate, end: endDate },
      impressions: parseInt(data.impressions, 10),
      clicks: parseInt(data.clicks, 10),
      spend: Math.round(parseFloat(data.spend) * 100), // Convert to cents
      spendCurrency: currency,
      conversions: parseInt(data.conversions ?? "0", 10),
      ctr: parseFloat(data.ctr),
      cpc: Math.round(parseFloat(data.cpc) * 100),
      cpm: Math.round(parseFloat(data.cpm) * 100),
      reach: parseInt(data.reach, 10),
      frequency: parseFloat(data.frequency),
    };
  }

  /**
   * Map Facebook campaign response to normalized Campaign type
   */
  private mapCampaign(
    fb: FacebookCampaignResponse,
    accountId: string,
    currency: string = "USD",
  ): Campaign {
    const hasDailyBudget = !!fb.daily_budget;
    const budget = fb.daily_budget || fb.lifetime_budget || "0";

    return {
      id: fb.id,
      platform: "FACEBOOK",
      accountId,
      name: fb.name,
      status: mapFacebookStatus(fb.effective_status || fb.status),
      objective: mapFacebookObjective(fb.objective),
      budgetType: hasDailyBudget
        ? "DAILY"
        : fb.lifetime_budget
        ? "LIFETIME"
        : "UNKNOWN",
      budgetAmount: parseInt(budget, 10), // Facebook returns budget in cents
      budgetCurrency: currency,
      startDate: fb.start_time ? new Date(fb.start_time) : null,
      endDate: fb.stop_time ? new Date(fb.stop_time) : null,
      createdAt: new Date(fb.created_time),
      updatedAt: new Date(fb.updated_time),
      rawData: fb as unknown as Record<string, unknown>,
    };
  }
}
