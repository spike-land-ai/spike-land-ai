import { describe, expect, it } from "vitest";
import { createMarketingClient } from "./index";

describe("marketing/index", () => {
  describe("createMarketingClient", () => {
    it("should throw for unsupported platforms", () => {
      expect(() => createMarketingClient("UNKNOWN" as "FACEBOOK")).toThrow(
        "Unsupported marketing platform",
      );
    });

    it("should throw with config error for Facebook when env vars missing", () => {
      expect(() => createMarketingClient("FACEBOOK")).toThrow("credentials not configured");
    });

    it("should throw with config error for Google Ads when env vars missing", () => {
      expect(() => createMarketingClient("GOOGLE_ADS")).toThrow("credentials not configured");
    });
  });
});
