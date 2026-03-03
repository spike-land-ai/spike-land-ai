import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  socialPost: { create: vi.fn() },
  scheduledPostAccount: { createMany: vi.fn() },
  scheduledPost: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  postingTimeRecommendation: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCalendarTools } from "./calendar";

const WORKSPACE = { id: "ws-1", slug: "acme", name: "Acme" };
const userId = "user-1";

describe("calendar tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCalendarTools(registry, userId);
    mockPrisma.workspace.findFirst.mockResolvedValue(WORKSPACE);
  });

  it("should register 5 calendar tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("calendar_schedule_post")).toBe(true);
    expect(registry.handlers.has("calendar_list_scheduled")).toBe(true);
    expect(registry.handlers.has("calendar_cancel_post")).toBe(true);
    expect(registry.handlers.has("calendar_get_best_times")).toBe(true);
    expect(registry.handlers.has("calendar_detect_gaps")).toBe(true);
  });

  describe("calendar_schedule_post", () => {
    it("should create a scheduled post with linked accounts", async () => {
      mockPrisma.socialPost.create.mockResolvedValue({
        id: "post-1",
        content: "Hello world!",
        status: "SCHEDULED",
        scheduledAt: new Date("2025-07-01T10:00:00Z"),
      });
      mockPrisma.scheduledPostAccount.createMany.mockResolvedValue({
        count: 2,
      });
      const handler = registry.handlers.get("calendar_schedule_post")!;
      const result = await handler({
        workspace_slug: "acme",
        content: "Hello world!",
        account_ids: ["acc-1", "acc-2"],
        scheduled_at: "2025-07-01T10:00:00Z",
      });
      const text = getText(result);
      expect(text).toContain("Post Scheduled");
      expect(text).toContain("post-1");
      expect(text).toContain("2025-07-01T10:00:00Z");
      expect(text).toContain("Linked accounts:** 2");
      expect(mockPrisma.socialPost.create).toHaveBeenCalledWith({
        data: {
          createdById: userId,
          content: "Hello world!",
          status: "SCHEDULED",
          scheduledAt: expect.objectContaining({}),
        },
      });
      expect(mockPrisma.scheduledPostAccount.createMany).toHaveBeenCalledWith({
        data: [
          { postId: "post-1", accountId: "acc-1" },
          { postId: "post-1", accountId: "acc-2" },
        ],
      });
    });

    it("should truncate long content in preview", async () => {
      const longContent = "A".repeat(150);
      mockPrisma.socialPost.create.mockResolvedValue({
        id: "post-2",
        content: longContent,
        status: "SCHEDULED",
        scheduledAt: new Date("2025-07-01"),
      });
      mockPrisma.scheduledPostAccount.createMany.mockResolvedValue({
        count: 1,
      });
      const handler = registry.handlers.get("calendar_schedule_post")!;
      const result = await handler({
        workspace_slug: "acme",
        content: longContent,
        account_ids: ["acc-1"],
        scheduled_at: "2025-07-01T10:00:00Z",
      });
      const text = getText(result);
      expect(text).toContain("...");
    });

    it("should not truncate short content (<=100 chars)", async () => {
      const shortContent = "Short post";
      mockPrisma.socialPost.create.mockResolvedValue({
        id: "post-3",
        content: shortContent,
        status: "SCHEDULED",
        scheduledAt: new Date("2025-07-01"),
      });
      mockPrisma.scheduledPostAccount.createMany.mockResolvedValue({
        count: 1,
      });
      const handler = registry.handlers.get("calendar_schedule_post")!;
      const result = await handler({
        workspace_slug: "acme",
        content: shortContent,
        account_ids: ["acc-1"],
        scheduled_at: "2025-07-01T10:00:00Z",
      });
      const text = getText(result);
      expect(text).toContain("Short post");
      expect(text).not.toContain("...");
    });
  });

  describe("calendar_list_scheduled", () => {
    it("should list scheduled posts", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([
        {
          id: "sp-1",
          content: "Post content here",
          scheduledAt: new Date("2025-07-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      ]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Scheduled Posts");
      expect(text).toContain("Post content here");
      expect(text).toContain("sp-1");
    });

    it("should show empty message when no posts", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      const result = await handler({ workspace_slug: "acme" });
      expect(getText(result)).toContain("No scheduled posts found");
    });

    it("should pass date range filters to query", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      await handler({
        workspace_slug: "acme",
        from_date: "2025-07-01",
        to_date: "2025-07-31",
      });
      expect(mockPrisma.scheduledPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledAt: expect.objectContaining({
              gte: expect.objectContaining({}),
              lte: expect.objectContaining({}),
            }),
          }),
        }),
      );
    });

    it("should handle from_date only filter", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      await handler({
        workspace_slug: "acme",
        from_date: "2025-07-01",
      });
      const call = mockPrisma.scheduledPost.findMany.mock.calls[0]![0];
      expect(call.where.scheduledAt).toEqual({
        gte: expect.objectContaining({}),
      });
      expect(call.where.scheduledAt).not.toHaveProperty("lte");
    });

    it("should handle to_date only filter", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      await handler({
        workspace_slug: "acme",
        to_date: "2025-07-31",
      });
      const call = mockPrisma.scheduledPost.findMany.mock.calls[0]![0];
      expect(call.where.scheduledAt).toEqual({
        lte: expect.objectContaining({}),
      });
      expect(call.where.scheduledAt).not.toHaveProperty("gte");
    });

    it("should handle posts with null content, non-Date scheduledAt, and null status", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([
        {
          id: "sp-null",
          content: null,
          scheduledAt: "2025-07-01T10:00:00Z",
          status: null,
        },
      ]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("sp-null");
      expect(text).toContain("2025-07-01T10:00:00Z");
      expect(text).toContain("SCHEDULED");
    });

    it("should handle post with null scheduledAt", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([
        {
          id: "sp-nodate",
          content: "Some content",
          scheduledAt: null,
          status: "SCHEDULED",
        },
      ]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("N/A");
      expect(text).toContain("sp-nodate");
    });

    it("should not truncate short content (<=80 chars) in list view", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([
        {
          id: "sp-short",
          content: "Brief post",
          scheduledAt: new Date("2025-07-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      ]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Brief post");
      expect(text).not.toContain("...");
    });

    it("should truncate long content (>80 chars) in list view", async () => {
      const longContent = "B".repeat(100);
      mockPrisma.scheduledPost.findMany.mockResolvedValue([
        {
          id: "sp-long",
          content: longContent,
          scheduledAt: new Date("2025-07-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      ]);
      const handler = registry.handlers.get("calendar_list_scheduled")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("...");
    });
  });

  describe("calendar_cancel_post", () => {
    it("should cancel a scheduled post", async () => {
      mockPrisma.scheduledPost.findFirst.mockResolvedValue({
        id: "sp-1",
        status: "SCHEDULED",
      });
      mockPrisma.scheduledPost.update.mockResolvedValue({
        id: "sp-1",
        status: "CANCELLED",
      });
      const handler = registry.handlers.get("calendar_cancel_post")!;
      const result = await handler({ workspace_slug: "acme", post_id: "sp-1" });
      const text = getText(result);
      expect(text).toContain("Post Cancelled");
      expect(text).toContain("sp-1");
      expect(text).toContain("CANCELLED");
      expect(mockPrisma.scheduledPost.update).toHaveBeenCalledWith({
        where: { id: "sp-1" },
        data: { status: "CANCELLED" },
      });
    });

    it("should return error for non-existent post", async () => {
      mockPrisma.scheduledPost.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("calendar_cancel_post")!;
      const result = await handler({
        workspace_slug: "acme",
        post_id: "sp-999",
      });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("calendar_get_best_times", () => {
    it("should return best posting times table", async () => {
      mockPrisma.postingTimeRecommendation.findMany.mockResolvedValue([
        { day: "Monday", hour: "9", score: 95, reason: "Peak engagement" },
        { day: "Wednesday", hour: "14", score: 88, reason: "High reach" },
      ]);
      const handler = registry.handlers.get("calendar_get_best_times")!;
      const result = await handler({
        workspace_slug: "acme",
        account_id: "acc-1",
      });
      const text = getText(result);
      expect(text).toContain("Best Posting Times");
      expect(text).toContain("Monday");
      expect(text).toContain("95");
      expect(text).toContain("Peak engagement");
    });

    it("should show empty message when no recommendations", async () => {
      mockPrisma.postingTimeRecommendation.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("calendar_get_best_times")!;
      const result = await handler({
        workspace_slug: "acme",
        account_id: "acc-1",
      });
      expect(getText(result)).toContain("No posting time recommendations");
    });

    it("should handle recommendations with null fields", async () => {
      mockPrisma.postingTimeRecommendation.findMany.mockResolvedValue([
        { day: null, hour: null, score: null, reason: null },
      ]);
      const handler = registry.handlers.get("calendar_get_best_times")!;
      const result = await handler({
        workspace_slug: "acme",
        account_id: "acc-1",
      });
      const text = getText(result);
      expect(text).toContain("N/A");
      expect(text).toContain("0");
    });
  });

  describe("calendar_detect_gaps", () => {
    it("should detect days with no scheduled content", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("calendar_detect_gaps")!;
      const result = await handler({ workspace_slug: "acme", days_ahead: 3 });
      const text = getText(result);
      expect(text).toContain("Gap Analysis");
      expect(text).toContain("3 gap(s)");
      expect(text).toContain("No content scheduled");
    });

    it("should report no gaps when all days have content", async () => {
      const now = new Date();
      const posts = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() + i);
        return { scheduledAt: d, status: "SCHEDULED" };
      });
      mockPrisma.scheduledPost.findMany.mockResolvedValue(posts);
      const handler = registry.handlers.get("calendar_detect_gaps")!;
      const result = await handler({ workspace_slug: "acme", days_ahead: 7 });
      expect(getText(result)).toContain("No gaps found");
    });

    it("should skip posts with non-Date scheduledAt (treat as gaps)", async () => {
      mockPrisma.scheduledPost.findMany.mockResolvedValue([
        { scheduledAt: "2025-07-01T10:00:00Z", status: "SCHEDULED" },
        { scheduledAt: null, status: "SCHEDULED" },
      ]);
      const handler = registry.handlers.get("calendar_detect_gaps")!;
      const result = await handler({ workspace_slug: "acme", days_ahead: 3 });
      const text = getText(result);
      expect(text).toContain("gap(s)");
      expect(text).toContain("No content scheduled");
    });
  });
});
