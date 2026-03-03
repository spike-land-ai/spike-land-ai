import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  socialPost: {
    count: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCalendarAnalyticsTools } from "./calendar-analytics";

const userId = "user-analytics-1";

describe("calendar analytics tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCalendarAnalyticsTools(registry, userId);
  });

  it("should register 4 calendar analytics tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("calendar_get_analytics")).toBe(true);
    expect(registry.handlers.has("calendar_suggest_content")).toBe(true);
    expect(registry.handlers.has("calendar_bulk_schedule")).toBe(true);
    expect(registry.handlers.has("calendar_get_performance")).toBe(true);
  });

  // ─── calendar_get_analytics ─────────────────────────────────────────

  describe("calendar_get_analytics", () => {
    it("should return analytics summary for a 7d period", async () => {
      mockPrisma.socialPost.count.mockResolvedValue(12);
      mockPrisma.socialPost.findFirst.mockResolvedValue({
        id: "post-abc",
        content: "Our latest product drop is live!",
        scheduledAt: new Date("2026-02-20T10:00:00Z"),
      });
      const handler = registry.handlers.get("calendar_get_analytics")!;
      const result = await handler({ period: "7d" });
      const text = getText(result);
      expect(text).toContain("Analytics");
      expect(text).toContain("7d");
      expect(text).toContain("12");
      expect(text).toContain("Engagement Rate");
      expect(text).toContain("Estimated Reach");
      expect(text).toContain("Best Performing Post");
      expect(text).toContain("post-abc");
    });

    it("should return analytics with platform filter", async () => {
      mockPrisma.socialPost.count.mockResolvedValue(5);
      mockPrisma.socialPost.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("calendar_get_analytics")!;
      const result = await handler({ period: "30d", platform: "instagram" });
      const text = getText(result);
      expect(text).toContain("Instagram");
      expect(text).toContain("30d");
      expect(text).toContain("5");
      expect(text).not.toContain("Best Performing Post");
    });

    it("should handle zero posts gracefully", async () => {
      mockPrisma.socialPost.count.mockResolvedValue(0);
      mockPrisma.socialPost.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("calendar_get_analytics")!;
      const result = await handler({ period: "all" });
      const text = getText(result);
      expect(text).toContain("0");
      expect(text).toContain("no data");
    });

    it("should surface growth trend as positive when many posts exist", async () => {
      mockPrisma.socialPost.count.mockResolvedValue(20);
      mockPrisma.socialPost.findFirst.mockResolvedValue({
        id: "top-post",
        content: "High performer",
        scheduledAt: new Date("2026-02-25T08:00:00Z"),
      });
      const handler = registry.handlers.get("calendar_get_analytics")!;
      const result = await handler({ period: "90d" });
      expect(getText(result)).toContain("positive");
    });

    it("should handle database error via safeToolCall", async () => {
      mockPrisma.socialPost.count.mockRejectedValue(
        new Error("DB connection timeout"),
      );
      const handler = registry.handlers.get("calendar_get_analytics")!;
      const result = await handler({ period: "7d" });
      const text = getText(result);
      expect(text).toContain("Error");
      expect(text).toContain("DB connection timeout");
    });
  });

  // ─── calendar_suggest_content ────────────────────────────────────────

  describe("calendar_suggest_content", () => {
    it("should return content suggestions for instagram", async () => {
      const handler = registry.handlers.get("calendar_suggest_content")!;
      const result = await handler({
        topic: "eco-friendly packaging",
        platform: "instagram",
        count: 2,
      });
      const text = getText(result);
      expect(text).toContain("eco-friendly packaging");
      expect(text).toContain("Instagram");
      expect(text).toContain("1.");
      expect(text).toContain("2.");
      expect(text).toContain("Hashtags");
      expect(text).toContain("Optimal time");
    });

    it("should default to 3 suggestions when count is omitted", async () => {
      const handler = registry.handlers.get("calendar_suggest_content")!;
      const result = await handler({
        topic: "product launch",
        platform: "twitter",
      });
      const text = getText(result);
      expect(text).toContain("1.");
      expect(text).toContain("2.");
      expect(text).toContain("3.");
      expect(text).not.toContain("4.");
    });

    it("should return suggestions for linkedin platform", async () => {
      const handler = registry.handlers.get("calendar_suggest_content")!;
      const result = await handler({
        topic: "team culture",
        platform: "linkedin",
        count: 1,
      });
      const text = getText(result);
      expect(text).toContain("Linkedin");
      expect(text).toContain("team culture");
      expect(text).toContain("1.");
      expect(text).not.toContain("2.");
    });

    it("should handle the 'all' platform case", async () => {
      const handler = registry.handlers.get("calendar_suggest_content")!;
      const result = await handler({
        topic: "summer sale",
        platform: "all",
        count: 3,
      });
      const text = getText(result);
      expect(text).toContain("All platforms");
      expect(text).toContain("summer sale");
    });
  });

  // ─── calendar_bulk_schedule ──────────────────────────────────────────

  describe("calendar_bulk_schedule", () => {
    it("should schedule multiple posts and return their IDs", async () => {
      mockPrisma.socialPost.create
        .mockResolvedValueOnce({ id: "bulk-1" })
        .mockResolvedValueOnce({ id: "bulk-2" });

      const handler = registry.handlers.get("calendar_bulk_schedule")!;
      const futureDate1 = new Date(Date.now() + 86_400_000).toISOString();
      const futureDate2 = new Date(Date.now() + 172_800_000).toISOString();

      const result = await handler({
        posts: [
          { content: "Post one", platform: "instagram", scheduled_at: futureDate1 },
          { content: "Post two", platform: "twitter", scheduled_at: futureDate2 },
        ],
      });

      const text = getText(result);
      expect(text).toContain("2 post(s) scheduled");
      expect(text).toContain("bulk-1");
      expect(text).toContain("bulk-2");
      expect(text).toContain("instagram");
      expect(text).toContain("twitter");
      expect(mockPrisma.socialPost.create).toHaveBeenCalledTimes(2);
    });

    it("should reject posts with past scheduled_at dates", async () => {
      const handler = registry.handlers.get("calendar_bulk_schedule")!;
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();

      const result = await handler({
        posts: [
          { content: "Stale post", platform: "facebook", scheduled_at: pastDate },
        ],
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("position(s) 1");
      expect(mockPrisma.socialPost.create).not.toHaveBeenCalled();
    });

    it("should identify multiple invalid posts in one response", async () => {
      const handler = registry.handlers.get("calendar_bulk_schedule")!;
      const pastDate = new Date(Date.now() - 86_400_000).toISOString();
      const futureDate = new Date(Date.now() + 86_400_000).toISOString();

      const result = await handler({
        posts: [
          { content: "Past post 1", platform: "instagram", scheduled_at: pastDate },
          { content: "Future post", platform: "twitter", scheduled_at: futureDate },
          { content: "Past post 3", platform: "linkedin", scheduled_at: pastDate },
        ],
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("1");
      expect(text).toContain("3");
      expect(mockPrisma.socialPost.create).not.toHaveBeenCalled();
    });

    it("should handle database error during bulk create", async () => {
      mockPrisma.socialPost.create.mockRejectedValue(
        new Error("Unique constraint failed"),
      );
      const handler = registry.handlers.get("calendar_bulk_schedule")!;
      const futureDate = new Date(Date.now() + 86_400_000).toISOString();

      const result = await handler({
        posts: [
          { content: "Post", platform: "tiktok", scheduled_at: futureDate },
        ],
      });

      const text = getText(result);
      expect(text).toContain("Error");
      expect(text).toContain("Unique constraint failed");
    });
  });

  // ─── calendar_get_performance ────────────────────────────────────────

  describe("calendar_get_performance", () => {
    it("should return metrics table for a published post", async () => {
      mockPrisma.socialPost.findFirst.mockResolvedValue({
        id: "perf-1",
        content: "Our big announcement post with great results!",
        status: "PUBLISHED",
        scheduledAt: new Date("2026-02-15T09:00:00Z"),
        createdAt: new Date("2026-02-10T09:00:00Z"),
        metrics: {
          likes: 420,
          shares: 85,
          comments: 34,
          impressions: 12000,
          clicks: 360,
          peak_time: "2026-02-15T11:00:00Z",
        },
      });

      const handler = registry.handlers.get("calendar_get_performance")!;
      const result = await handler({ post_id: "perf-1" });
      const text = getText(result);
      expect(text).toContain("Post Performance");
      expect(text).toContain("perf-1");
      expect(text).toContain("420");
      expect(text).toContain("85");
      expect(text).toContain("34");
      expect(text).toContain("12,000");
      expect(text).toContain("360");
      expect(text).toContain("3.00%");
      expect(text).toContain("2026-02-15T11:00:00Z");
    });

    it("should return NOT_FOUND for a missing or unauthorised post", async () => {
      mockPrisma.socialPost.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("calendar_get_performance")!;
      const result = await handler({ post_id: "ghost-post" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should reject non-published posts with a clear error", async () => {
      mockPrisma.socialPost.findFirst.mockResolvedValue({
        id: "draft-1",
        content: "Draft content",
        status: "SCHEDULED",
        scheduledAt: new Date("2026-03-01T10:00:00Z"),
        createdAt: new Date("2026-02-25T10:00:00Z"),
      });
      const handler = registry.handlers.get("calendar_get_performance")!;
      const result = await handler({ post_id: "draft-1" });
      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("SCHEDULED");
    });

    it("should default metrics to zero when no metrics object exists", async () => {
      mockPrisma.socialPost.findFirst.mockResolvedValue({
        id: "no-metrics",
        content: "Published but metrics not yet populated",
        status: "PUBLISHED",
        scheduledAt: new Date("2026-02-10T10:00:00Z"),
        createdAt: new Date("2026-02-08T10:00:00Z"),
        metrics: undefined,
      });
      const handler = registry.handlers.get("calendar_get_performance")!;
      const result = await handler({ post_id: "no-metrics" });
      const text = getText(result);
      expect(text).toContain("0");
      expect(text).toContain("0.00%");
      expect(text).toContain("N/A");
    });

    it("should handle database error via safeToolCall", async () => {
      mockPrisma.socialPost.findFirst.mockRejectedValue(
        new Error("Read replica unavailable"),
      );
      const handler = registry.handlers.get("calendar_get_performance")!;
      const result = await handler({ post_id: "perf-err" });
      const text = getText(result);
      expect(text).toContain("Error");
      expect(text).toContain("Read replica unavailable");
    });
  });
});
