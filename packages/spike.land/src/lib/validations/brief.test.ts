import { describe, expect, it } from "vitest";

import { campaignObjectivesSchema, targetAudienceSchema } from "./brief";

describe("brief validations", () => {
  describe("targetAudienceSchema", () => {
    it("should accept valid target audience", () => {
      const result = targetAudienceSchema.safeParse({
        demographics: {
          ageRange: "18-34",
          gender: "All",
          location: "United States",
        },
        interests: ["Technology", "Gaming"],
        behaviors: ["Online shopping"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing age range", () => {
      const result = targetAudienceSchema.safeParse({
        demographics: { ageRange: "", gender: "All", location: "US" },
        interests: ["Tech"],
        behaviors: ["Shopping"],
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty interests array", () => {
      const result = targetAudienceSchema.safeParse({
        demographics: { ageRange: "18-34", gender: "All", location: "US" },
        interests: [],
        behaviors: ["Shopping"],
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty behaviors array", () => {
      const result = targetAudienceSchema.safeParse({
        demographics: { ageRange: "18-34", gender: "All", location: "US" },
        interests: ["Tech"],
        behaviors: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("campaignObjectivesSchema", () => {
    it("should accept valid campaign objectives", () => {
      const result = campaignObjectivesSchema.safeParse({
        objective: "Brand awareness",
        kpis: ["Impressions", "Reach"],
        successMetrics: "Reach 1M impressions in 30 days",
      });
      expect(result.success).toBe(true);
    });

    it("should reject missing objective", () => {
      const result = campaignObjectivesSchema.safeParse({
        objective: "",
        kpis: ["Clicks"],
        successMetrics: "Get more clicks",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty kpis array", () => {
      const result = campaignObjectivesSchema.safeParse({
        objective: "Sales",
        kpis: [],
        successMetrics: "Increase revenue",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty successMetrics", () => {
      const result = campaignObjectivesSchema.safeParse({
        objective: "Sales",
        kpis: ["Revenue"],
        successMetrics: "",
      });
      expect(result.success).toBe(false);
    });
  });
});
