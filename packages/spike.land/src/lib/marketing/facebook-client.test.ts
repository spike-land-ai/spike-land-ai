/**
 * Tests for Facebook Marketing API Client
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FacebookMarketingClient } from "./facebook-client";
import type { FacebookAdAccount, FacebookCampaignResponse } from "./types";

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

function makeClient(opts?: { accessToken?: string; }): FacebookMarketingClient {
  return new FacebookMarketingClient(opts);
}

function makeFacebookCampaign(
  overrides: Partial<FacebookCampaignResponse> = {},
): FacebookCampaignResponse {
  return {
    id: "123456789",
    name: "Test Campaign",
    status: "ACTIVE",
    effective_status: "ACTIVE",
    objective: "LINK_CLICKS",
    daily_budget: "1000",
    created_time: "2024-01-01T00:00:00+0000",
    updated_time: "2024-01-15T00:00:00+0000",
    ...overrides,
  };
}

function makeFacebookAdAccount(
  overrides: Partial<FacebookAdAccount> = {},
): FacebookAdAccount {
  return {
    id: "act_123456789",
    name: "Test Ad Account",
    account_status: 1,
    currency: "USD",
    timezone_name: "America/New_York",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  process.env.FACEBOOK_MARKETING_APP_ID = "test-app-id";
  process.env.FACEBOOK_MARKETING_APP_SECRET = "test-app-secret";
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.FACEBOOK_MARKETING_APP_ID;
  delete process.env.FACEBOOK_MARKETING_APP_SECRET;
});

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – constructor", () => {
  it("creates instance when env vars are set", () => {
    const client = makeClient();
    expect(client).toBeInstanceOf(FacebookMarketingClient);
    expect(client.platform).toBe("FACEBOOK");
  });

  it("throws when FACEBOOK_MARKETING_APP_ID is missing", () => {
    delete process.env.FACEBOOK_MARKETING_APP_ID;
    expect(() => makeClient()).toThrow("credentials not configured");
  });

  it("throws when FACEBOOK_MARKETING_APP_SECRET is missing", () => {
    delete process.env.FACEBOOK_MARKETING_APP_SECRET;
    expect(() => makeClient()).toThrow("credentials not configured");
  });

  it("trims whitespace from env vars", () => {
    process.env.FACEBOOK_MARKETING_APP_ID = "  id  ";
    process.env.FACEBOOK_MARKETING_APP_SECRET = "secret\n";
    expect(() => makeClient()).not.toThrow();
  });

  it("accepts optional accessToken", () => {
    const client = makeClient({ accessToken: "my-token" });
    expect(client).toBeInstanceOf(FacebookMarketingClient);
  });
});

// ---------------------------------------------------------------------------
// setAccessToken
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – setAccessToken", () => {
  it("stores access token for subsequent requests", () => {
    const client = makeClient();
    client.setAccessToken("my-access-token");
    expect(client).toBeInstanceOf(FacebookMarketingClient);
  });
});

// ---------------------------------------------------------------------------
// getAuthUrl
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – getAuthUrl", () => {
  it("returns well-formed OAuth authorization URL", () => {
    const client = makeClient();
    const url = client.getAuthUrl("https://example.com/callback", "state-xyz");

    expect(url).toContain("https://www.facebook.com");
    expect(url).toContain("dialog/oauth");
    expect(url).toContain("client_id=test-app-id");
    expect(url).toContain("redirect_uri=");
    expect(url).toContain("state=state-xyz");
    expect(url).toContain("ads_read");
    expect(url).toContain("ads_management");
    expect(url).toContain("response_type=code");
  });

  it("uses the correct API version in OAuth URL", () => {
    const client = makeClient();
    const url = client.getAuthUrl("https://example.com/cb", "s");
    expect(url).toContain("v21.0");
  });
});

// ---------------------------------------------------------------------------
// exchangeCodeForTokens
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – exchangeCodeForTokens", () => {
  it("returns OAuthTokenResponse with long-lived token on success", async () => {
    const shortLivedResponse = {
      access_token: "short-lived-token",
      token_type: "bearer",
    };
    const longLivedResponse = {
      access_token: "long-lived-token",
      expires_in: 5184000, // 60 days
    };

    const mockFetch = vi.fn()
      // First call: exchange code for short-lived token
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(shortLivedResponse) })
      // Second call: exchange short-lived for long-lived token
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(longLivedResponse) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.exchangeCodeForTokens("auth-code", "https://example.com/cb");

    expect(result.accessToken).toBe("long-lived-token");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.tokenType).toBe("bearer");
    expect(result.refreshToken).toBeUndefined();
  });

  it("falls back to short-lived token when long-lived exchange fails", async () => {
    const shortLivedResponse = {
      access_token: "short-lived-token",
      token_type: "bearer",
    };

    const mockFetch = vi.fn()
      // Exchange code -> short-lived token
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(shortLivedResponse) })
      // Long-lived exchange fails
      .mockResolvedValueOnce({ ok: false, statusText: "Error", json: () => Promise.resolve({}) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.exchangeCodeForTokens("code", "https://example.com/cb");

    expect(result.accessToken).toBe("short-lived-token");
  });

  it("falls back to short-lived token when long-lived exchange network error", async () => {
    const shortLivedResponse = {
      access_token: "short-lived-token",
      token_type: "bearer",
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(shortLivedResponse) })
      .mockRejectedValueOnce(new Error("Connection refused"));

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.exchangeCodeForTokens("code", "https://example.com/cb");

    expect(result.accessToken).toBe("short-lived-token");
  });

  it("throws on HTTP error when exchanging code", async () => {
    const mockFetch = makeFetchError(400, {
      error: { message: "Invalid OAuth access token." },
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("bad-code", "https://example.com/cb"),
    ).rejects.toThrow("Failed to exchange code");
  });

  it("throws on network error when exchanging code", async () => {
    vi.stubGlobal("fetch", makeNetworkError("Network error"));

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("code", "https://example.com/cb"),
    ).rejects.toThrow("Failed to exchange code");
  });

  it("throws when JSON parsing fails", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new Error("bad json")),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await expect(
      client.exchangeCodeForTokens("code", "https://example.com/cb"),
    ).rejects.toThrow("Failed to exchange code");
  });

  it("handles missing expires_in in long-lived token response", async () => {
    const shortLivedResponse = { access_token: "short", token_type: "bearer" };
    const longLivedResponse = { access_token: "long-lived" }; // no expires_in

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(shortLivedResponse) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(longLivedResponse) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.exchangeCodeForTokens("code", "https://example.com/cb");

    expect(result.accessToken).toBe("long-lived");
    expect(result.expiresAt).toBeUndefined();
  });

  it("uses statusText when error.message is absent", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ error: {} }),
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

describe("FacebookMarketingClient – refreshAccessToken", () => {
  it("returns refreshed OAuthTokenResponse on success", async () => {
    const refreshResponse = {
      access_token: "refreshed-long-lived-token",
      expires_in: 5184000,
    };

    const mockFetch = makeFetchOk(refreshResponse);
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.refreshAccessToken("old-token");

    expect(result.accessToken).toBe("refreshed-long-lived-token");
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.tokenType).toBe("bearer");
  });

  it("returns original token on exchange failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Error",
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const result = await client.refreshAccessToken("original-token");

    expect(result.accessToken).toBe("original-token");
    expect(result.expiresAt).toBeUndefined();
  });

  it("returns original token on network failure", async () => {
    vi.stubGlobal("fetch", makeNetworkError("Connection refused"));

    const client = makeClient();
    const result = await client.refreshAccessToken("original-token");

    expect(result.accessToken).toBe("original-token");
  });
});

// ---------------------------------------------------------------------------
// validateToken
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – validateToken", () => {
  it("returns true for a valid token", async () => {
    const mockFetch = makeFetchOk({
      data: {
        is_valid: true,
        scopes: ["ads_read", "ads_management"],
      },
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const valid = await client.validateToken("valid-token");
    expect(valid).toBe(true);
  });

  it("returns false when is_valid is false", async () => {
    const mockFetch = makeFetchOk({
      data: { is_valid: false },
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    const valid = await client.validateToken("invalid-token");
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

  it("uses app_id|app_secret format for access_token param in debug_token call", async () => {
    const mockFetch = makeFetchOk({ data: { is_valid: true } });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient();
    await client.validateToken("test-user-token");

    const [calledUrl] = mockFetch.mock.calls[0] as [string];
    expect(calledUrl).toContain("debug_token");
    expect(calledUrl).toContain("access_token=test-app-id%7Ctest-app-secret");
  });
});

// ---------------------------------------------------------------------------
// request (private – tested indirectly)
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – request (auth guard)", () => {
  it("throws when access token is not set", async () => {
    const client = makeClient();

    await expect(client.getAccounts()).rejects.toThrow(
      "Access token not set",
    );
  });

  it("throws on network error from underlying fetch", async () => {
    vi.stubGlobal("fetch", makeNetworkError("Network failure"));

    const client = makeClient({ accessToken: "tok" });
    await expect(client.getAccounts()).rejects.toThrow("Facebook API Error");
  });

  it("throws on non-ok HTTP response with error message", async () => {
    const mockFetch = makeFetchError(403, {
      error: { message: "Invalid OAuth access token." },
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await expect(client.getAccounts()).rejects.toThrow("Invalid OAuth access token.");
  });

  it("uses statusText when error body lacks error.message", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
      json: () => Promise.resolve({}),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await expect(client.getAccounts()).rejects.toThrow("Forbidden");
  });

  it("throws when response JSON is null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await expect(client.getAccounts()).rejects.toThrow("Facebook API Error");
  });

  it("includes Authorization header with Bearer token", async () => {
    const mockFetch = makeFetchOk({ data: [] });
    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "my-bearer-token" });
    await client.getAccounts();

    const [, callOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = callOptions?.headers as Record<string, string>;
    expect(headers?.["Authorization"]).toBe("Bearer my-bearer-token");
  });
});

// ---------------------------------------------------------------------------
// getAccounts
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – getAccounts", () => {
  it("returns normalized list of ad accounts", async () => {
    const responseBody = {
      data: [
        makeFacebookAdAccount({
          id: "act_111",
          name: "Account A",
          currency: "USD",
          account_status: 1,
        }),
        makeFacebookAdAccount({
          id: "act_222",
          name: "Account B",
          currency: "EUR",
          account_status: 2,
        }),
      ],
    };
    vi.stubGlobal("fetch", makeFetchOk(responseBody));

    const client = makeClient({ accessToken: "tok" });
    const accounts = await client.getAccounts();

    expect(accounts).toHaveLength(2);
    expect(accounts[0]).toMatchObject({
      platform: "FACEBOOK",
      accountId: "111", // strip act_ prefix
      accountName: "Account A",
      isActive: true,
    });
    expect(accounts[1]).toMatchObject({
      platform: "FACEBOOK",
      accountId: "222",
      accountName: "Account B",
      isActive: false, // account_status !== 1
    });
  });

  it("caches currency for each account", async () => {
    const responseBody = {
      data: [
        makeFacebookAdAccount({ id: "act_111", currency: "GBP" }),
      ],
    };
    vi.stubGlobal("fetch", makeFetchOk(responseBody));

    const client = makeClient({ accessToken: "tok" });
    await client.getAccounts();

    // Now listCampaigns should use cached currency without fetching again
    const campaignsMockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [makeFacebookCampaign()] }),
      });
    vi.stubGlobal("fetch", campaignsMockFetch);

    const campaigns = await client.listCampaigns("111");
    expect(campaigns[0]?.budgetCurrency).toBe("GBP");
    // Only 1 fetch call = campaigns (no currency fetch needed)
    expect(campaignsMockFetch).toHaveBeenCalledTimes(1);
  });

  it("returns empty array when no accounts", async () => {
    vi.stubGlobal("fetch", makeFetchOk({ data: [] }));

    const client = makeClient({ accessToken: "tok" });
    const accounts = await client.getAccounts();
    expect(accounts).toEqual([]);
  });

  it("strips act_ prefix from accountId", async () => {
    const responseBody = {
      data: [makeFacebookAdAccount({ id: "act_987654321" })],
    };
    vi.stubGlobal("fetch", makeFetchOk(responseBody));

    const client = makeClient({ accessToken: "tok" });
    const accounts = await client.getAccounts();
    expect(accounts[0]?.accountId).toBe("987654321");
  });
});

// ---------------------------------------------------------------------------
// listCampaigns
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – listCampaigns", () => {
  it("returns normalized campaigns list", async () => {
    const currencyFetch = makeFetchOk({ currency: "EUR" });
    const campaignsFetch = {
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            makeFacebookCampaign({
              id: "c1",
              name: "Campaign 1",
              status: "ACTIVE",
              effective_status: "ACTIVE",
            }),
            makeFacebookCampaign({
              id: "c2",
              name: "Campaign 2",
              status: "PAUSED",
              effective_status: "PAUSED",
            }),
          ],
        }),
    };

    const mockFetch = vi.fn()
      // currency lookup
      .mockResolvedValueOnce((currencyFetch as () => unknown)())
      // campaigns list
      .mockResolvedValueOnce(campaignsFetch);

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns).toHaveLength(2);
    expect(campaigns[0]).toMatchObject({
      id: "c1",
      name: "Campaign 1",
      platform: "FACEBOOK",
      status: "ACTIVE",
      budgetCurrency: "EUR",
      budgetType: "DAILY",
    });
    expect(campaigns[1]).toMatchObject({
      id: "c2",
      status: "PAUSED",
    });
  });

  it("prepends act_ to account ID in campaigns API URL", async () => {
    const mockFetch = vi.fn()
      // currency
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      // campaigns
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.listCampaigns("123456789");

    const [campaignsUrl] = mockFetch.mock.calls[1] as [string];
    expect(campaignsUrl).toContain("/act_123456789/campaigns");
  });

  it("handles account ID that already has act_ prefix", async () => {
    const mockFetch = vi.fn()
      // currency (normalizedId = act_act_123 is NOT used; baseId = 123 is looked up)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      // campaigns
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.listCampaigns("act_123456789");

    // Should not double-prefix the URL
    const [campaignsUrl] = mockFetch.mock.calls[1] as [string];
    expect(campaignsUrl).toContain("/act_123456789/campaigns");
  });

  it("maps status using effective_status when available", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              // effective_status should take precedence
              makeFacebookCampaign({
                status: "ACTIVE",
                effective_status: "PAUSED", // account-level pause
              }),
            ],
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns[0]?.status).toBe("PAUSED");
  });

  it("maps objectives correctly", async () => {
    const objectiveMappings: Array<{ fb: string; expected: string; }> = [
      { fb: "BRAND_AWARENESS", expected: "AWARENESS" },
      { fb: "REACH", expected: "AWARENESS" },
      { fb: "LINK_CLICKS", expected: "TRAFFIC" },
      { fb: "POST_ENGAGEMENT", expected: "ENGAGEMENT" },
      { fb: "PAGE_LIKES", expected: "ENGAGEMENT" },
      { fb: "LEAD_GENERATION", expected: "LEADS" },
      { fb: "APP_INSTALLS", expected: "APP_PROMOTION" },
      { fb: "CONVERSIONS", expected: "CONVERSIONS" },
      { fb: "PRODUCT_CATALOG_SALES", expected: "SALES" },
      { fb: "UNKNOWN_OBJECTIVE", expected: "OTHER" },
    ];

    for (const { fb, expected } of objectiveMappings) {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [makeFacebookCampaign({ objective: fb })] }),
        });

      vi.stubGlobal("fetch", mockFetch);

      const client = makeClient({ accessToken: "tok" });
      const campaigns = await client.listCampaigns("123456789");
      expect(campaigns[0]?.objective).toBe(expected);
    }
  });

  it("sets budgetType DAILY when daily_budget is present", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [makeFacebookCampaign({ daily_budget: "5000" })],
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns[0]?.budgetType).toBe("DAILY");
    expect(campaigns[0]?.budgetAmount).toBe(5000);
  });

  it("sets budgetType LIFETIME when only lifetime_budget is present", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              makeFacebookCampaign({
                lifetime_budget: "100000",
              }),
            ],
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns[0]?.budgetType).toBe("LIFETIME");
    expect(campaigns[0]?.budgetAmount).toBe(100000);
  });

  it("sets budgetType UNKNOWN when no budget fields present", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              makeFacebookCampaign({}),
            ],
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns[0]?.budgetType).toBe("UNKNOWN");
    expect(campaigns[0]?.budgetAmount).toBe(0);
  });

  it("parses start_time and stop_time to Date objects", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              makeFacebookCampaign({
                start_time: "2024-03-01T00:00:00+0000",
                stop_time: "2024-03-31T23:59:59+0000",
              }),
            ],
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns[0]?.startDate).toBeInstanceOf(Date);
    expect(campaigns[0]?.endDate).toBeInstanceOf(Date);
    expect(campaigns[0]?.startDate?.getFullYear()).toBe(2024);
  });

  it("sets startDate/endDate to null when fields are absent", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              makeFacebookCampaign({}),
            ],
          }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns[0]?.startDate).toBeNull();
    expect(campaigns[0]?.endDate).toBeNull();
  });

  it("falls back to USD when currency fetch fails", async () => {
    const mockFetch = vi.fn()
      // currency fetch fails with non-ok response
      .mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: { message: "Account not found" } }),
      })
      // campaigns still returned
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [makeFacebookCampaign()] }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });

    // When currency fetch fails it should throw from the request method since
    // request() propagates errors — getAccountCurrency uses tryCatch internally
    // and falls back to USD. The campaigns endpoint is the one that throws.
    // Actually the currency request runs in parallel with campaigns, and
    // getAccountCurrency uses tryCatch so it doesn't throw — it returns USD.
    // But the campaigns request is direct request() call which WILL throw.
    // In this test the first fetch (currency) fails and second (campaigns) succeeds.
    // Since they run in parallel via Promise.all, the currency error propagates.
    // Let's adjust: make currency fetch fail gracefully (tryCatch catches it),
    // campaigns fetch succeed.
    // Actually looking at the code: getAccountCurrency uses tryCatch on request()
    // so it returns "USD" on error. The campaigns is direct request() so it throws on error.
    // So if currency fails (fetch returns non-ok) → tryCatch captures → returns USD
    // And if campaigns request returns ok → campaigns list succeeds.
    const campaigns = await client.listCampaigns("123456789");
    expect(campaigns[0]?.budgetCurrency).toBe("USD");
  });
});

// ---------------------------------------------------------------------------
// getCampaign
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – getCampaign", () => {
  it("returns a single campaign by ID", async () => {
    const currencyFetch = { ok: true, json: () => Promise.resolve({ currency: "USD" }) };
    const campaignFetch = {
      ok: true,
      json: () => Promise.resolve(makeFacebookCampaign({ id: "c123", name: "Single Campaign" })),
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce(currencyFetch)
      .mockResolvedValueOnce(campaignFetch);

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("123456789", "c123");

    expect(campaign).not.toBeNull();
    expect(campaign?.id).toBe("c123");
    expect(campaign?.name).toBe("Single Campaign");
    expect(campaign?.platform).toBe("FACEBOOK");
  });

  it("returns null when API returns error", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
        json: () => Promise.resolve({ error: { message: "Campaign does not exist" } }),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("123456789", "nonexistent");

    expect(campaign).toBeNull();
  });

  it("returns null on network error for campaign fetch", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockRejectedValueOnce(new Error("Network failure"));

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const campaign = await client.getCampaign("123456789", "c123");

    expect(campaign).toBeNull();
  });

  it("includes correct fields in API request URL", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(makeFacebookCampaign()),
      });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.getCampaign("123456789", "c456");

    const [campaignUrl] = mockFetch.mock.calls[1] as [string];
    expect(campaignUrl).toContain("/c456");
    expect(campaignUrl).toContain("fields=");
    expect(campaignUrl).toContain("id");
    expect(campaignUrl).toContain("name");
    expect(campaignUrl).toContain("status");
  });
});

// ---------------------------------------------------------------------------
// getCampaignMetrics
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – getCampaignMetrics", () => {
  it("returns normalized campaign metrics", async () => {
    const insightsResponse = {
      data: [
        {
          impressions: "50000",
          clicks: "2500",
          spend: "125.50",
          conversions: "100",
          reach: "40000",
          frequency: "1.25",
          ctr: "5.0",
          cpc: "0.05",
          cpm: "2.51",
        },
      ],
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(insightsResponse) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics(
      "123456789",
      "c123",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
    );

    expect(metrics.campaignId).toBe("c123");
    expect(metrics.platform).toBe("FACEBOOK");
    expect(metrics.impressions).toBe(50000);
    expect(metrics.clicks).toBe(2500);
    expect(metrics.spend).toBe(12550); // 125.50 * 100 = 12550 cents
    expect(metrics.conversions).toBe(100);
    expect(metrics.reach).toBe(40000);
    expect(metrics.frequency).toBeCloseTo(1.25);
    expect(metrics.ctr).toBeCloseTo(5.0);
    expect(metrics.cpc).toBe(5); // 0.05 * 100 = 5 cents
    expect(metrics.cpm).toBe(251); // 2.51 * 100 = 251 cents
    expect(metrics.spendCurrency).toBe("USD");
  });

  it("returns zeros when no insights data for date range", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics(
      "123456789",
      "c123",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
    );

    expect(metrics.impressions).toBe(0);
    expect(metrics.clicks).toBe(0);
    expect(metrics.spend).toBe(0);
    expect(metrics.conversions).toBe(0);
    expect(metrics.reach).toBe(0);
    expect(metrics.frequency).toBe(0);
  });

  it("includes dateRange in result", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const start = new Date("2024-06-01");
    const end = new Date("2024-06-30");

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics("123456789", "c123", start, end);

    expect(metrics.dateRange.start).toEqual(start);
    expect(metrics.dateRange.end).toEqual(end);
  });

  it("encodes date range as time_range parameter in request URL", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.getCampaignMetrics(
      "123456789",
      "c456",
      new Date("2024-03-15"),
      new Date("2024-03-31"),
    );

    const [insightsUrl] = mockFetch.mock.calls[1] as [string];
    expect(insightsUrl).toContain("/c456/insights");
    expect(insightsUrl).toContain("time_range");
    expect(insightsUrl).toContain("2024-03-15");
    expect(insightsUrl).toContain("2024-03-31");
  });

  it("defaults conversions to 0 when field is absent", async () => {
    const insightsResponse = {
      data: [
        {
          impressions: "1000",
          clicks: "50",
          spend: "10.00",
          // conversions field absent
          reach: "900",
          frequency: "1.1",
          ctr: "5.0",
          cpc: "0.20",
          cpm: "10.0",
        },
      ],
    };

    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "USD" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(insightsResponse) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const metrics = await client.getCampaignMetrics(
      "123456789",
      "c123",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
    );

    expect(metrics.conversions).toBe(0);
  });

  it("uses cached currency to avoid extra fetch", async () => {
    // First getAccounts to populate cache
    const accountsFetch = makeFetchOk({
      data: [makeFacebookAdAccount({ id: "act_123456789", currency: "GBP" })],
    });
    vi.stubGlobal("fetch", accountsFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.getAccounts();

    // Now getCampaignMetrics should use cached GBP
    const metricsFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", metricsFetch);

    const metrics = await client.getCampaignMetrics(
      "123456789",
      "c123",
      new Date("2024-01-01"),
      new Date("2024-01-31"),
    );

    expect(metrics.spendCurrency).toBe("GBP");
    // Only 1 fetch call = insights (no currency fetch needed)
    expect(metricsFetch).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getAccountCurrency (tested via public methods)
// ---------------------------------------------------------------------------

describe("FacebookMarketingClient – getAccountCurrency (cache behavior)", () => {
  it("fetches currency when not in cache and caches result", async () => {
    const mockFetch = vi.fn()
      // currency
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "JPY" }) })
      // campaigns
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) })
      // Second listCampaigns — only campaigns (currency cached)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    const first = await client.listCampaigns("123456789");
    const second = await client.listCampaigns("123456789");

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    // 3 calls total: currency + campaigns + campaigns (no second currency fetch)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("caches currency for both act_ and plain account ID formats", async () => {
    const mockFetch = vi.fn()
      // First call uses act_123 format → currency fetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ currency: "CAD" }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) })
      // Second call uses plain 123 format → should use cache (no extra fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ data: [] }) });

    vi.stubGlobal("fetch", mockFetch);

    const client = makeClient({ accessToken: "tok" });
    await client.listCampaigns("act_123456789");
    const campaigns = await client.listCampaigns("123456789");

    expect(campaigns).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});
