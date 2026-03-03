import { beforeEach, describe, expect, it, vi } from "vitest";

/* ── Prisma mock ────────────────────────────────────────────────────────── */

const mockPrisma = {
  userPreference: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

/* ── Helpers ────────────────────────────────────────────────────────────── */

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBrandCampaignTools } from "./brand-campaigns";

// Minimal serialised campaign list used throughout tests
function makeCampaignRow(overrides: Record<string, unknown> = {}): string {
  const base = {
    id: "cmp_test123_abcde",
    name: "Spring Launch",
    description: "Promote new product line",
    platform: "instagram",
    status: "draft",
    start_date: "2026-04-01",
    budget: 500,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
  return JSON.stringify([base]);
}

/* ── Test suite ─────────────────────────────────────────────────────────── */

describe("brand-campaigns tools", () => {
  const userId = "user-brand-test";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    // Default: no existing campaigns
    mockPrisma.userPreference.findUnique.mockResolvedValue(null);
    mockPrisma.userPreference.upsert.mockResolvedValue({});
    registerBrandCampaignTools(registry, userId);
  });

  /* ── Registration ────────────────────────────────────────────────────── */

  it("should register exactly 4 brand-campaign tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
  });

  /* ── brand_create_campaign ───────────────────────────────────────────── */

  describe("brand_create_campaign", () => {
    it("should create a campaign and return its ID and details", async () => {
      const handler = registry.handlers.get("brand_create_campaign")!;
      const result = await handler({
        name: "Summer Sale",
        description: "Promote summer collection across social channels",
        platform: "twitter",
        start_date: "2026-06-01",
        budget: 1200,
      });

      const text = getText(result);
      expect(text).toContain("Campaign Created");
      expect(text).toContain("Summer Sale");
      expect(text).toContain("twitter");
      expect(text).toContain("draft");
      expect(text).toContain("2026-06-01");
      expect(text).toContain("$1200.00");
      // ID should have been generated and persisted
      expect(mockPrisma.userPreference.upsert).toHaveBeenCalledOnce();
    });

    it("should create a campaign without optional fields", async () => {
      const handler = registry.handlers.get("brand_create_campaign")!;
      const result = await handler({
        name: "Brand Awareness",
        description: "General brand awareness push",
        platform: "all",
      });

      const text = getText(result);
      expect(text).toContain("Campaign Created");
      expect(text).toContain("Brand Awareness");
      expect(text).toContain("all");
      expect(text).toContain("(not set)"); // start_date and budget both absent
    });

    it("should reject an invalid ISO date in start_date", async () => {
      const handler = registry.handlers.get("brand_create_campaign")!;
      const result = await handler({
        name: "Bad Date Campaign",
        description: "Campaign with invalid date",
        platform: "linkedin",
        start_date: "not-a-date",
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("start_date");
      // No upsert should have occurred
      expect(mockPrisma.userPreference.upsert).not.toHaveBeenCalled();
    });

    it("should append new campaign to existing list", async () => {
      // Seed one existing campaign
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_create_campaign")!;
      await handler({
        name: "Second Campaign",
        description: "Follow-up campaign",
        platform: "facebook",
      });

      const upsertCall = mockPrisma.userPreference.upsert.mock.calls[0]![0];
      const saved = JSON.parse(upsertCall.update.value as string) as unknown[];
      expect(saved).toHaveLength(2);
    });
  });

  /* ── brand_list_campaigns ────────────────────────────────────────────── */

  describe("brand_list_campaigns", () => {
    it("should list all campaigns when no filters are applied", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_list_campaigns")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Campaigns (1)");
      expect(text).toContain("Spring Launch");
      expect(text).toContain("instagram");
    });

    it("should return empty message when no campaigns exist", async () => {
      const handler = registry.handlers.get("brand_list_campaigns")!;
      const result = await handler({});

      expect(getText(result)).toContain("No Campaigns Found");
    });

    it("should filter campaigns by status", async () => {
      const two = JSON.stringify([
        {
          id: "cmp_a",
          name: "Active One",
          description: "desc",
          platform: "twitter",
          status: "active",
          start_date: null,
          budget: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "cmp_b",
          name: "Draft One",
          description: "desc",
          platform: "linkedin",
          status: "draft",
          start_date: null,
          budget: null,
          created_at: "2026-01-02T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
      ]);
      mockPrisma.userPreference.findUnique.mockResolvedValue({ value: two });

      const handler = registry.handlers.get("brand_list_campaigns")!;
      const result = await handler({ status: "active" });

      const text = getText(result);
      expect(text).toContain("Active One");
      expect(text).not.toContain("Draft One");
    });

    it("should filter campaigns by platform", async () => {
      const two = JSON.stringify([
        {
          id: "cmp_c",
          name: "TikTok Campaign",
          description: "desc",
          platform: "tiktok",
          status: "draft",
          start_date: null,
          budget: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "cmp_d",
          name: "LinkedIn Campaign",
          description: "desc",
          platform: "linkedin",
          status: "draft",
          start_date: null,
          budget: null,
          created_at: "2026-01-02T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
        },
      ]);
      mockPrisma.userPreference.findUnique.mockResolvedValue({ value: two });

      const handler = registry.handlers.get("brand_list_campaigns")!;
      const result = await handler({ platform: "tiktok" });

      const text = getText(result);
      expect(text).toContain("TikTok Campaign");
      expect(text).not.toContain("LinkedIn Campaign");
    });

    it("should include campaigns with platform 'all' in any platform filter", async () => {
      const row = JSON.stringify([
        {
          id: "cmp_e",
          name: "All Platforms",
          description: "desc",
          platform: "all",
          status: "active",
          start_date: null,
          budget: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ]);
      mockPrisma.userPreference.findUnique.mockResolvedValue({ value: row });

      const handler = registry.handlers.get("brand_list_campaigns")!;
      const result = await handler({ platform: "instagram" });

      expect(getText(result)).toContain("All Platforms");
    });
  });

  /* ── brand_get_campaign_stats ────────────────────────────────────────── */

  describe("brand_get_campaign_stats", () => {
    it("should return performance metrics for an existing campaign", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_get_campaign_stats")!;
      const result = await handler({ campaign_id: "cmp_test123_abcde" });

      const text = getText(result);
      expect(text).toContain("Campaign Stats: Spring Launch");
      expect(text).toContain("Impressions");
      expect(text).toContain("Clicks");
      expect(text).toContain("Reach");
      expect(text).toContain("Engagement Rate");
      expect(text).toContain("Cost per Engagement");
      expect(text).toContain("instagram");
    });

    it("should return NOT_FOUND for an unknown campaign ID", async () => {
      const handler = registry.handlers.get("brand_get_campaign_stats")!;
      const result = await handler({ campaign_id: "cmp_does_not_exist" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("cmp_does_not_exist");
    });

    it("should return deterministic metrics for the same campaign ID", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_get_campaign_stats")!;
      const r1 = await handler({ campaign_id: "cmp_test123_abcde" });
      const r2 = await handler({ campaign_id: "cmp_test123_abcde" });

      expect(getText(r1)).toEqual(getText(r2));
    });
  });

  /* ── brand_generate_variants ─────────────────────────────────────────── */

  describe("brand_generate_variants", () => {
    it("should generate default 3 variants in professional tone", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_generate_variants")!;
      const result = await handler({ campaign_id: "cmp_test123_abcde" });

      const text = getText(result);
      expect(text).toContain("A/B Copy Variants for \"Spring Launch\"");
      expect(text).toContain("Variant A");
      expect(text).toContain("Variant B");
      expect(text).toContain("Variant C");
      expect(text).toContain("professional");
    });

    it("should generate the specified number of variants", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_generate_variants")!;
      const result = await handler({
        campaign_id: "cmp_test123_abcde",
        variant_count: 5,
        tone: "playful",
      });

      const text = getText(result);
      expect(text).toContain("Variant A");
      expect(text).toContain("Variant E");
      expect(text).toContain("playful");
      expect(text).toContain("**Variants:** 5");
    });

    it("should use casual tone when specified", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow(),
      });

      const handler = registry.handlers.get("brand_generate_variants")!;
      const result = await handler({
        campaign_id: "cmp_test123_abcde",
        tone: "casual",
        variant_count: 2,
      });

      const text = getText(result);
      expect(text).toContain("casual");
      expect(text).toContain("Variant A");
      expect(text).toContain("Variant B");
      expect(text).not.toContain("Variant C");
    });

    it("should inject campaign name into generated copy", async () => {
      mockPrisma.userPreference.findUnique.mockResolvedValue({
        value: makeCampaignRow({ name: "Winter Wonderland" }),
      });

      const handler = registry.handlers.get("brand_generate_variants")!;
      const result = await handler({
        campaign_id: "cmp_test123_abcde",
        variant_count: 2,
      });

      expect(getText(result)).toContain("Winter Wonderland");
    });

    it("should return NOT_FOUND for an unknown campaign ID", async () => {
      const handler = registry.handlers.get("brand_generate_variants")!;
      const result = await handler({ campaign_id: "cmp_ghost" });

      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("cmp_ghost");
    });
  });
});
