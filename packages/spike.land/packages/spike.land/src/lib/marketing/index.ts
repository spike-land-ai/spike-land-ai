/**
 * Marketing API Integration
 *
 * Unified interface for Facebook Marketing API and Google Ads API
 */

export { FacebookMarketingClient } from "./facebook-client";
export { GoogleAdsClient } from "./google-ads-client";
export * from "./types";

import { FacebookMarketingClient } from "./facebook-client";
import { GoogleAdsClient } from "./google-ads-client";
import type { IMarketingClient, MarketingPlatform } from "./types";

/**
 * Create a marketing client for the specified platform
 */
export function createMarketingClient(
  platform: MarketingPlatform,
  options?: { accessToken?: string; customerId?: string; },
): IMarketingClient {
  switch (platform) {
    case "FACEBOOK":
      return new FacebookMarketingClient(options);
    case "GOOGLE_ADS":
      return new GoogleAdsClient(options);
    default:
      throw new Error(`Unsupported marketing platform: ${platform}`);
  }
}
