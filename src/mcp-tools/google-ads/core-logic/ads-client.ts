/**
 * Google Ads API v17 client using native fetch.
 */

import type { GoogleAdsAuthClient } from "./google-oauth.js";

const API_BASE = "https://googleads.googleapis.com/v17";

interface SearchStreamResponse {
  results?: unknown[];
}

export class GoogleAdsClient {
  private readonly auth: GoogleAdsAuthClient;

  constructor(auth: GoogleAdsAuthClient) {
    this.auth = auth;
  }

  getCustomerId(): string {
    return this.auth.getCustomerId();
  }

  async search(query: string): Promise<unknown[]> {
    const customerId = this.auth.getCustomerId();
    const url = `${API_BASE}/customers/${customerId}/googleAds:searchStream`;
    const headers = await this.auth.authHeaders();
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ query }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Ads API error (${resp.status}): ${text}`);
    }
    const data = (await resp.json()) as SearchStreamResponse[];
    return data.flatMap((batch) => batch.results ?? []);
  }

  async mutate(operations: unknown[]): Promise<unknown> {
    const customerId = this.auth.getCustomerId();
    const url = `${API_BASE}/customers/${customerId}/googleAds:mutate`;
    const headers = await this.auth.authHeaders();
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ mutateOperations: operations }),
    });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Google Ads mutate error (${resp.status}): ${text}`);
    }
    return resp.json();
  }
}
