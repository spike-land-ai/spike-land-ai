import type { FetchFn, StripeListResponse } from "./types.js";
import { STRIPE_API_BASE } from "./types.js";

// Pin to a known stable Stripe API version.
// Update this intentionally after reviewing the Stripe changelog.
const STRIPE_API_VERSION = "2024-06-20";

export class StripeClient {
  private readonly apiKey: string;
  private readonly fetchFn: FetchFn;

  constructor(apiKey: string, fetchFn: FetchFn = globalThis.fetch) {
    this.apiKey = apiKey;
    this.fetchFn = fetchFn;
  }

  async get(path: string, params?: Record<string, string>): Promise<unknown> {
    const url = new URL(`${STRIPE_API_BASE}/${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }

    const resp = await this.fetchFn(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Stripe-Version": STRIPE_API_VERSION,
      },
    });

    if (!resp.ok) {
      const body = await resp.text();
      throw new Error(`Stripe API error ${resp.status}: ${body}`);
    }

    return resp.json() as Promise<unknown>;
  }

  async getAll<T>(path: string, params?: Record<string, string>): Promise<T[]> {
    const allItems: T[] = [];
    const queryParams: Record<string, string> = { ...params, limit: "100" };

    for (;;) {
      const response = (await this.get(path, queryParams)) as StripeListResponse<T>;
      allItems.push(...response.data);

      if (!response.has_more || response.data.length === 0) {
        break;
      }

      const lastItem = response.data[response.data.length - 1];
      queryParams.starting_after = (lastItem as Record<string, unknown>).id as string;
    }

    return allItems;
  }
}
