import { describe, expect, it } from "vitest";

import {
  competitorNameSchema,
  createCompetitorRequestSchema,
  legacyAddCompetitorRequestSchema,
  socialHandleSchema,
  socialHandlesSchema,
  updateCompetitorRequestSchema,
  websiteUrlSchema,
} from "./scout-competitor";

describe("scout-competitor validations", () => {
  describe("socialHandleSchema", () => {
    it("should accept a valid handle", () => {
      const result = socialHandleSchema.safeParse("johndoe");
      expect(result.success).toBe(true);
    });

    it("should strip leading @ from handle", () => {
      const result = socialHandleSchema.safeParse("@johndoe");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("johndoe");
      }
    });

    it("should reject handle over 100 chars", () => {
      const result = socialHandleSchema.safeParse("a".repeat(101));
      expect(result.success).toBe(false);
    });

    it("should reject empty handle after trimming", () => {
      const result = socialHandleSchema.safeParse("@");
      expect(result.success).toBe(false);
    });

    it("should trim whitespace and strip @", () => {
      const result = socialHandleSchema.safeParse("  @user  ");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("user");
      }
    });
  });

  describe("socialHandlesSchema", () => {
    it("should accept object with at least one handle", () => {
      const result = socialHandlesSchema.safeParse({ twitter: "user" });
      expect(result.success).toBe(true);
    });

    it("should accept multiple handles", () => {
      const result = socialHandlesSchema.safeParse({
        twitter: "tuser",
        linkedin: "luser",
        instagram: "iuser",
        facebook: "fuser",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty object (no handles)", () => {
      const result = socialHandlesSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("websiteUrlSchema", () => {
    it("should accept a valid URL", () => {
      const result = websiteUrlSchema.safeParse("https://example.com");
      expect(result.success).toBe(true);
    });

    it("should reject invalid URL", () => {
      const result = websiteUrlSchema.safeParse("not-a-url");
      expect(result.success).toBe(false);
    });

    it("should accept undefined (optional)", () => {
      const result = websiteUrlSchema.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    it("should reject URL over 2000 chars", () => {
      const result = websiteUrlSchema.safeParse("https://example.com/" + "a".repeat(2000));
      expect(result.success).toBe(false);
    });
  });

  describe("competitorNameSchema", () => {
    it("should accept a valid name", () => {
      const result = competitorNameSchema.safeParse("Acme Corp");
      expect(result.success).toBe(true);
    });

    it("should trim whitespace", () => {
      const result = competitorNameSchema.safeParse("  Acme  ");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("Acme");
      }
    });

    it("should reject empty name after trimming", () => {
      const result = competitorNameSchema.safeParse("   ");
      expect(result.success).toBe(false);
    });

    it("should reject name over 200 chars", () => {
      const result = competitorNameSchema.safeParse("A".repeat(201));
      expect(result.success).toBe(false);
    });
  });

  describe("createCompetitorRequestSchema", () => {
    it("should accept valid create request", () => {
      const result = createCompetitorRequestSchema.safeParse({
        name: "Competitor Inc",
        socialHandles: { twitter: "competitor" },
      });
      expect(result.success).toBe(true);
    });

    it("should accept with website", () => {
      const result = createCompetitorRequestSchema.safeParse({
        name: "Competitor Inc",
        website: "https://competitor.com",
        socialHandles: { linkedin: "competitor-inc" },
      });
      expect(result.success).toBe(true);
    });

    it("should reject without social handles", () => {
      const result = createCompetitorRequestSchema.safeParse({
        name: "Competitor Inc",
        socialHandles: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateCompetitorRequestSchema", () => {
    it("should accept partial update with name", () => {
      const result = updateCompetitorRequestSchema.safeParse({
        name: "Updated Name",
      });
      expect(result.success).toBe(true);
    });

    it("should accept isActive toggle", () => {
      const result = updateCompetitorRequestSchema.safeParse({
        isActive: false,
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty update", () => {
      const result = updateCompetitorRequestSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should reject empty name after trimming", () => {
      const result = updateCompetitorRequestSchema.safeParse({ name: "   " });
      expect(result.success).toBe(false);
    });
  });

  describe("legacyAddCompetitorRequestSchema", () => {
    it("should accept valid legacy request", () => {
      const result = legacyAddCompetitorRequestSchema.safeParse({
        platform: "TWITTER",
        handle: "competitor",
      });
      expect(result.success).toBe(true);
    });

    it("should strip @ from handle", () => {
      const result = legacyAddCompetitorRequestSchema.safeParse({
        platform: "INSTAGRAM",
        handle: "@competitor",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.handle).toBe("competitor");
      }
    });

    it("should reject invalid platform", () => {
      const result = legacyAddCompetitorRequestSchema.safeParse({
        platform: "MASTODON",
        handle: "user",
      });
      expect(result.success).toBe(false);
    });
  });
});
