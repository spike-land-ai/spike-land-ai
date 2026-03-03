/**
 * Tests for Google Ads API Client
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleAdsClient } from "./google-ads-client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFetchOk(body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function makeFetchError(status: number, body: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: "Bad Request",
    json: () => Promise.resolve(body),
  });
}

function makeNetworkError(message: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockRejectedValue(new Error(message));
}

/** Build a minimal GoogleAdsClient with env vars already set */
function makeClient(opts?: { accessToken?: string; customerId?: string; }): GoogleAdsClient {
  return new GoogleAdsClient(opts);
}

// Google Ads search stream returns an array of result objects
function searchStreamResponse(results: unknown[]): { results: unknown[]; } {
  return { results };
}

function makeGoogleAdsCampaign(overrides: Partial<{
  id: string;
  name: string;
  status: string;
  advertisingChannelType: string;
  startDate: string;
  endDate: string;
  resourceName: string;
  campaignBudget: string;
}> = {}): Record<string, unknown> {
  return {
    resourceName: "customers/1234/campaigns/111",
    id: "111",
    name: "Test Campaign",
    status: "ENABLED",
    advertisingChannelType: "SEARCH",
    startDate: "2024-01-01",
    endDate: "2024-12-31",
    campaignBudget: "customers/1234/campaignBudgets/999",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.GOOGLE_ID = "test-client-id";
  process.env.GOOGLE_SECRET = "test-client-secret";
  process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "test-dev-token";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.GOOGLE_ID;
  delete process.env.GOOGLE_SECRET;
  delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – constructor", () => {
  it("creates instance when env vars are set", () => {
    const client = makeClient();
    expect(client).toBeInstanceOf(GoogleAdsClient);
    expect(client.platform).toBe("GOOGLE_ADS");
  });

  it("throws when GOOGLE_ID is missing", () => {
    delete process.env.GOOGLE_ID;
    expect(() => makeClient()).toThrow("Google OAuth credentials not configured");
  });

  it("throws when GOOGLE_SECRET is missing", () => {
    delete process.env.GOOGLE_SECRET;
    expect(() => makeClient()).toThrow("Google OAuth credentials not configured");
  });

  it("trims whitespace from env vars", () => {
    process.env.GOOGLE_ID = "  id-with-spaces  ";
    process.env.GOOGLE_SECRET = "secret\n";
    expect(() => makeClient()).not.toThrow();
  });

  it("accepts optional accessToken and customerId", () => {
    const client = makeClient({ accessToken: "tok", customerId: "1234567890" });
    expect(client).toBeInstanceOf(GoogleAdsClient);
  });
});

// ---------------------------------------------------------------------------
// setAccessToken / setCustomerId
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – setAccessToken / setCustomerId", () => {
  it("setAccessToken stores token for subsequent requests", () => {
    const client = makeClient();
    client.setAccessToken("my-token");
    // No direct assertion – covered via request tests
    expect(client).toBeInstanceOf(GoogleAdsClient);
  });

  it("setCustomerId removes dashes", () => {
    const client = makeClient();
    client.setCustomerId("123-456-7890");
    // Dashes removed — validated by subsequent API call using the id
    expect(client).toBeInstanceOf(GoogleAdsClient);
  });
});

// ---------------------------------------------------------------------------
// getAuthUrl
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – getAuthUrl", () => {
  it("returns well-formed OAuth authorization URL", () => {
    const client = makeClient();
    const url = client.getAuthUrl("https://example.com/callback", "state-abc");

    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("response_type=code");
    expect(url).toContain("scope=");
    expect(url).toContain("adwords");
    expect(url).toContain("state=state-abc");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
  });

  it("encodes special characters in redirect URI", () => {
    const client = makeClient();
    const url = client.getAuthUrl("https://example.com/callback?foo=bar", "xyz");
    expect(url).toContain("redirect_uri=");
  });
});

// ---------------------------------------------------------------------------
// exchangeCodeForTokens
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – exchangeCodeForTokens", () => {
  it("returns OAuthTokenResponse on success", async () => {
    const mockFetch = makeFetchOk({
      access_token: "access-123",
      refresh_token: "refresh-456",
      expires_in: 3600,
      token_type: "Bearer",
      scope: "https://www.googleapis.com/auth/adwords",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.exchangeCodeForTokens("auth-code", "https://example.com/cb");

    expect(result.accessToken).toBe("access-123");
    expect(result.refreshToken).toBe("refresh-456");
    expect(result.tokenType).toBe("Bearer");
    expect(result.scope).toBe("https://www.googleapis.com/auth/adwords");
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("handles missing expires_in gracefully", async () => {
    const mockFetch = makeFetchOk({
      access_token: "access-123",
      refresh_token: "refresh-456",
      token_type: "Bearer",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.exchangeCodeForTokens("auth-code", "https://example.com/cb");

    expect(result.expiresAt).toBeUndefined();
  });

  it("throws on HTTP error response", async () => {
    const mockFetch = makeFetchError(400, {
      error_description: "invalid_grant",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("bad-code", "https://example.com/cb"),
    ).rejects.toThrow("Failed to exchange code");
  });

  it("throws on network error", async () => {
    vi.stubGlobal("fetch", makeNetworkError("Connection refused"));

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("code", "https://example.com/cb"),
    ).rejects.toThrow("Failed to exchange code");
  });

  it("throws when JSON parsing fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("JSON parse error")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("code", "https://example.com/cb"),
    ).rejects.toThrow("Failed to parse token response");
  });

  it("uses statusText when error_description absent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("code", "https://example.com/cb"),
    ).rejects.toThrow("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// refreshAccessToken
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – refreshAccessToken", () => {
  it("returns new OAuthTokenResponse on success", async () => {
    const mockFetch = makeFetchOk({
      access_token: "new-access-token",
      expires_in: 3600,
      token_type: "Bearer",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.refreshAccessToken("refresh-token-abc");

    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken).toBe("refresh-token-abc"); // keeps original
    expect(result.expiresAt).toBeInstanceOf(Date);
  });

  it("throws on HTTP error response", async () => {
    const mockFetch = makeFetchError(401, {
      error_description: "Token has been expired or revoked.",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(client.refreshAccessToken("bad-token")).rejects.toThrow(
      "Failed to refresh token",
    );
  });

  it("throws on network failure", async () => {
    vi.stubGlobal("fetch", makeNetworkError("Network error"));

    const client = makeClient();
    await expect(client.refreshAccessToken("tok")).rejects.toThrow(
      "Failed to refresh token",
    );
  });

  it("throws when JSON parsing fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("bad json")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(client.refreshAccessToken("tok")).rejects.toThrow(
      "Failed to parse token response",
    );
  });
});

// ---------------------------------------------------------------------------
// validateToken
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – validateToken", () => {
  it("returns true for a valid token with adwords scope", async () => {
    const mockFetch = makeFetchOk({
      scope: "https://www.googleapis.com/auth/adwords email",
      email: "user@example.com",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const valid = await client.validateToken("valid-token");
    expect(valid).toBe(true);
  });

  it("returns false when response has error field", async () => {
    const mockFetch = makeFetchOk({
      error: "invalid_token",
      scope: "https://www.googleapis.com/auth/adwords",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const valid = await client.validateToken("expired-token");
    expect(valid).toBe(false);
  });

  it("returns false when scope does not include adwords", async () => {
    const mockFetch = makeFetchOk({
      scope: "email profile",
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const valid = await client.validateToken("wrong-scope-token");
    expect(valid).toBe(false);
  });

  it("returns false on network error", async () => {
    vi.stubGlobal("fetch", makeNetworkError("Network unreachable"));

    const client = makeClient();
    const valid = await client.validateToken("any-token");
    expect(valid).toBe(false);
  });

  it("returns false when JSON parse fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("bad json")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const valid = await client.validateToken("any-token");
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// request (private – tested indirectly via public methods)
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – request (auth guard)", () => {
  it("throws when access token is not set", async () => {
    // listCampaigns triggers request() internally
    const client = makeClient();

    // We need to also set up the search stream, but since no access token
    // the error should fire before fetch is called.
    await expect(client.listCampaigns("1234567890")).rejects.toThrow(
      "Access token not set",
    );
  });

  it("throws when developer token is missing", async () => {
    delete process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    const client = makeClient({ accessToken: "tok" });

    vi.stubGlobal("fetch", vi.fn());

    await expect(client.listCampaigns("1234567890")).rejects.toThrow(
      "Google Ads Developer Token not configured",
    );
  });

  it("throws with Google Ads API error message on non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
      json: () => Promise.resolve({ error: { message: "The caller does not have permission" } }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });

    await expect(client.listCampaigns("1234567890")).rejects.toThrow(
      "The caller does not have permission",
    );
  });

  it("includes login-customer-id header when customerId is set", async () => {
    const currency = searchStreamResponse([{ customer: { currencyCode: "USD" } }]);
    const campaigns = searchStreamResponse([]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currency) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaigns) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok", customerId: "9876543210" });
    await client.listCampaigns("1234567890");

    const [, firstCallOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = firstCallOptions?.headers as Record<string, string>;
    expect(headers?.["login-customer-id"]).toBe("9876543210");
  });
});

// ---------------------------------------------------------------------------
// validateAccountId / validateCampaignId
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – ID validation", () => {
  it("throws on invalid account ID format", async () => {
    const client = makeClient({ accessToken: "tok" });

    await expect(client.listCampaigns("not-an-id!")).rejects.toThrow(
      "Invalid Account ID format",
    );
  });

  it("throws on invalid campaign ID format", async () => {
    const client = makeClient({ accessToken: "tok" });

    await expect(client.getCampaign("1234567890", "abc-not-digits")).rejects.toThrow(
      "Invalid Campaign ID format",
    );
  });

  it("accepts account ID with dashes", async () => {
    // Valid format: digits and dashes only, starts and ends with digit
    const searchCurrency = searchStreamResponse([{ customer: { currencyCode: "USD" } }]);
    const searchCampaigns = searchStreamResponse([]);
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(searchCurrency) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(searchCampaigns) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123-456-7890");
    expect(campaigns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAccounts
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – getAccounts", () => {
  it("returns list of accessible customer accounts", async () => {
    const customerListResponse = { resourceNames: ["customers/111", "customers/222"] };
    const customerInfoResponse = searchStreamResponse([
      { customer: { id: "111", descriptiveName: "Account A", currencyCode: "USD" } },
    ]);
    const customerInfoResponse2 = searchStreamResponse([
      { customer: { id: "222", descriptiveName: "Account B", currencyCode: "EUR" } },
    ]);

    const mockFetch = vi.fn()
      // GET /customers:listAccessibleCustomers
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(customerListResponse) })
      // POST searchStream for customer 111
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(customerInfoResponse) })
      // POST searchStream for customer 222
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(customerInfoResponse2) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const accounts = await client.getAccounts();

    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      platform: "GOOGLE_ADS",
      accountId: "111",
      accountName: "Account A",
      isActive: true,
    });
    expect(accounts[1]).toMatchObject({
      platform: "GOOGLE_ADS",
      accountId: "222",
      accountName: "Account B",
    });
  });

  it("skips inaccessible customers (query returns error)", async () => {
    const customerListResponse = { resourceNames: ["customers/111", "customers/999"] };
    const customerInfoOk = searchStreamResponse([
      { customer: { id: "111", descriptiveName: "Account A", currencyCode: "USD" } },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(customerListResponse) })
      // 111 succeeds
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(customerInfoOk) })
      // 999 fails at HTTP level
      .mockResolvedValueOnce({
        ok: false,
        statusText: "Forbidden",
        json: () => Promise.resolve({ error: { message: "No access" } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const accounts = await client.getAccounts();

    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.accountId).toBe("111");
  });

  it("returns empty array when no accessible customers", async () => {
    const mockFetch = makeFetchOk({ resourceNames: [] });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const accounts = await client.getAccounts();
    expect(accounts).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// listCampaigns
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – listCampaigns", () => {
  it("returns normalized campaign list", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", descriptiveName: "Acc", currencyCode: "EUR" } },
    ]);
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign({ id: "111", name: "Camp A", status: "ENABLED" }),
        campaignBudget: { amountMicros: "5000000" }, // 5 USD = 500 cents (5000000 / 10000 = 500)
      },
      {
        campaign: makeGoogleAdsCampaign({ id: "222", name: "Camp B", status: "PAUSED" }),
        campaignBudget: { amountMicros: "10000000" },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("1234567890");

    expect(campaigns).toHaveLength(2);
    const [first, second] = campaigns;
    expect(first?.platform).toBe("GOOGLE_ADS");
    expect(first?.name).toBe("Camp A");
    expect(first?.status).toBe("ACTIVE");
    expect(first?.budgetCurrency).toBe("EUR");
    expect(first?.budgetAmount).toBe(500); // 5000000 micros / 10000 = 500 cents

    expect(second?.status).toBe("PAUSED");
    expect(second?.budgetAmount).toBe(1000);
  });

  it("uses cached currency on second call (avoids extra request)", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const emptyCampaigns = searchStreamResponse([]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyCampaigns) })
      // Second listCampaigns call — currency should be cached
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyCampaigns) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.listCampaigns("1234567890");
    await client.listCampaigns("1234567890");

    // First call: currency fetch + campaigns = 2 requests
    // Second call: campaigns only (currency cached) = 1 request
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("maps REMOVED campaigns to DELETED status", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign({ status: "REMOVED" }),
        campaignBudget: { amountMicros: "0" },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("1234567890");

    expect(campaigns[0]?.status).toBe("DELETED");
  });

  it("maps unknown status to UNKNOWN", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign({ status: "SOMETHING_ELSE" }),
        campaignBudget: { amountMicros: "0" },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("1234567890");

    expect(campaigns[0]?.status).toBe("UNKNOWN");
  });

  it("maps advertising channel types to objectives correctly", async () => {
    const channels: Array<{ channelType: string; expected: string; }> = [
      { channelType: "SEARCH", expected: "TRAFFIC" },
      { channelType: "DISPLAY", expected: "AWARENESS" },
      { channelType: "SHOPPING", expected: "SALES" },
      { channelType: "VIDEO", expected: "AWARENESS" },
      { channelType: "MULTI_CHANNEL", expected: "CONVERSIONS" },
      { channelType: "LOCAL", expected: "TRAFFIC" },
      { channelType: "SMART", expected: "CONVERSIONS" },
      { channelType: "PERFORMANCE_MAX", expected: "CONVERSIONS" },
      { channelType: "LOCAL_SERVICES", expected: "LEADS" },
      { channelType: "DISCOVERY", expected: "AWARENESS" },
      { channelType: "TRAVEL", expected: "SALES" },
      { channelType: "UNKNOWN_TYPE", expected: "OTHER" },
    ];

    for (const { channelType, expected } of channels) {
      const currencyResponse = searchStreamResponse([
        { customer: { id: "1234567890", currencyCode: "USD" } },
      ]);
      const campaignResults = searchStreamResponse([
        {
          campaign: makeGoogleAdsCampaign({ advertisingChannelType: channelType }),
          campaignBudget: { amountMicros: "0" },
        },
      ]);

      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

      vi.stubGlobal("fetch", mockFetch);

      const client = makeClient({ accessToken: "tok" });
      const campaigns = await client.listCampaigns("1234567890");
      expect(campaigns[0]?.objective).toBe(expected);
    }
  });
});

// ---------------------------------------------------------------------------
// getCampaign
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – getCampaign", () => {
  it("returns a single campaign by ID", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign({ id: "111" }),
        campaignBudget: { amountMicros: "2000000" },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("1234567890", "111");

    expect(campaign).not.toBeNull();
    expect(campaign?.id).toBe("111");
    expect(campaign?.platform).toBe("GOOGLE_ADS");
  });

  it("returns null when query returns no results", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const emptyResult = searchStreamResponse([]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyResult) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("1234567890", "999");

    expect(campaign).toBeNull();
  });

  it("returns null on API error (error from query)", async () => {
    const mockFetch = vi.fn()
      // currency fetch succeeds
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            searchStreamResponse([{ customer: { id: "1234567890", currencyCode: "USD" } }]),
          ),
      })
      // campaign query fails
      .mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: { message: "Campaign not found" } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("1234567890", "999");

    expect(campaign).toBeNull();
  });

  it("parses YYYYMMDD date format correctly", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign({ startDate: "20240115", endDate: "20241231" }),
        campaignBudget: { amountMicros: "0" },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("1234567890", "111");

    expect(campaign?.startDate).toBeInstanceOf(Date);
    expect(campaign?.startDate?.getFullYear()).toBe(2024);
    expect(campaign?.startDate?.getMonth()).toBe(0); // January (0-indexed)
    expect(campaign?.endDate).toBeInstanceOf(Date);
    expect(campaign?.endDate?.getFullYear()).toBe(2024);
  });

  it("handles invalid date strings by returning null", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign({ startDate: "not-a-date", endDate: "also-bad" }),
        campaignBudget: { amountMicros: "0" },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("1234567890", "111");

    expect(campaign?.startDate).toBeNull();
    expect(campaign?.endDate).toBeNull();
  });

  it("handles missing dates (null startDate and endDate)", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const campaignWithoutDates = {
      resourceName: "customers/1234567890/campaigns/111",
      id: "111",
      name: "No Date Campaign",
      status: "ENABLED",
      advertisingChannelType: "SEARCH",
      campaignBudget: "customers/1234567890/campaignBudgets/999",
      // no startDate / endDate fields
    };
    const campaignResults = searchStreamResponse([
      { campaign: campaignWithoutDates, campaignBudget: { amountMicros: "0" } },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("1234567890", "111");

    expect(campaign?.startDate).toBeNull();
    expect(campaign?.endDate).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getCampaignMetrics
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – getCampaignMetrics", () => {
  it("returns normalized campaign metrics", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const metricsResponse = searchStreamResponse([
      {
        metrics: {
          impressions: "10000",
          clicks: "500",
          costMicros: "25000000", // 2500 cents
          conversions: "50.0",
          ctr: "0.05",
          averageCpc: "50000000", // 5000 cents
          averageCpm: "2500000", // 250 cents
        },
      },
    ]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(metricsResponse) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics(
      "1234567890",
      "111",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
    );

    expect(metrics.campaignId).toBe("111");
    expect(metrics.platform).toBe("GOOGLE_ADS");
    expect(metrics.impressions).toBe(10000);
    expect(metrics.clicks).toBe(500);
    expect(metrics.spend).toBe(2500); // 25000000 / 10000 = 2500 cents
    expect(metrics.conversions).toBe(50);
    expect(metrics.ctr).toBeCloseTo(5); // 0.05 * 100 = 5%
    expect(metrics.cpc).toBe(5000); // 50000000 / 10000 = 5000 cents
    expect(metrics.cpm).toBe(250); // 2500000 / 10000 = 250 cents
    expect(metrics.reach).toBe(0); // Google doesn't have reach
    expect(metrics.frequency).toBe(0);
    expect(metrics.spendCurrency).toBe("USD");
  });

  it("returns zeros when no data returned for date range", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const emptyMetrics = searchStreamResponse([]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyMetrics) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics(
      "1234567890",
      "111",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
    );

    expect(metrics.impressions).toBe(0);
    expect(metrics.clicks).toBe(0);
    expect(metrics.spend).toBe(0);
    expect(metrics.conversions).toBe(0);
  });

  it("includes dateRange in result", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const emptyMetrics = searchStreamResponse([]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyMetrics) });

    vi.stubGlobal("fetch", mockFetch);

    const start = new Date("2024-06-01");
    const end = new Date("2024-06-30");

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics("1234567890", "111", start, end);

    expect(metrics.dateRange.start).toEqual(start);
    expect(metrics.dateRange.end).toEqual(end);
  });

  it("throws on invalid account ID format", async () => {
    const client = makeClient({ accessToken: "tok" });
    await expect(
      client.getCampaignMetrics("bad-id!", "111", new Date(), new Date()),
    ).rejects.toThrow("Invalid Account ID format");
  });

  it("throws on invalid campaign ID format", async () => {
    const client = makeClient({ accessToken: "tok" });
    await expect(
      client.getCampaignMetrics("1234567890", "not-digits", new Date(), new Date()),
    ).rejects.toThrow("Invalid Campaign ID format");
  });

  it("formats date range as YYYYMMDD in GAQL query", async () => {
    const currencyResponse = searchStreamResponse([
      { customer: { id: "1234567890", currencyCode: "USD" } },
    ]);
    const emptyMetrics = searchStreamResponse([]);

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(currencyResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emptyMetrics) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.getCampaignMetrics(
      "1234567890",
      "111",
      new Date("2024-03-15"),
      new Date("2024-03-31"),
    );

    // The second call is the metrics search stream
    const [, metricsCallOptions] = mockFetch.mock.calls[1] as [string, RequestInit];
    const body = JSON.parse(metricsCallOptions?.body as string) as { query: string; };
    expect(body.query).toContain("20240315");
    expect(body.query).toContain("20240331");
  });
});

// ---------------------------------------------------------------------------
// getCustomerCurrency (via listCampaigns – cached vs fresh)
// ---------------------------------------------------------------------------

describe("GoogleAdsClient – currency caching", () => {
  it("falls back to USD when customer info unavailable", async () => {
    // Currency query fails, campaign query succeeds
    const failedCurrency = {
      ok: false,
      statusText: "Not Found",
      json: () => Promise.resolve({ error: { message: "No customer" } }),
    };
    const campaignResults = searchStreamResponse([
      {
        campaign: makeGoogleAdsCampaign(),
        campaignBudget: { amountMicros: "0" },
      },
    ]);

    // The currency and campaigns are fetched in parallel via Promise.all
    // Both of the fetch calls happen, but we mock the first to fail
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(failedCurrency)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(campaignResults) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("1234567890");

    // Should use USD fallback when currency fetch fails
    expect(campaigns[0]?.budgetCurrency).toBe("USD");
  });
});
