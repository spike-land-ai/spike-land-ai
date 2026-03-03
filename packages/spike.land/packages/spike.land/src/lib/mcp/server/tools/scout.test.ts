import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspace: { findFirst: vi.fn() },
  scoutCompetitor: { findMany: vi.fn(), create: vi.fn() },
  scoutBenchmark: { findMany: vi.fn() },
  scoutTopic: { findMany: vi.fn() },
  scoutResult: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerScoutTools } from "./scout";

const WORKSPACE = { id: "ws-1", slug: "acme", name: "Acme" };
const userId = "user-1";

describe("scout tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerScoutTools(registry, userId);
    mockPrisma.workspace.findFirst.mockResolvedValue(WORKSPACE);
  });

  it("should register 5 scout tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("scout_list_competitors")).toBe(true);
    expect(registry.handlers.has("scout_add_competitor")).toBe(true);
    expect(registry.handlers.has("scout_get_benchmark")).toBe(true);
    expect(registry.handlers.has("scout_list_topics")).toBe(true);
    expect(registry.handlers.has("scout_get_insights")).toBe(true);
  });

  describe("scout_list_competitors", () => {
    it("should list competitors", async () => {
      mockPrisma.scoutCompetitor.findMany.mockResolvedValue([
        {
          id: "c-1",
          name: "Rival Co",
          platform: "INSTAGRAM",
          handle: "rivalco",
          isActive: true,
          updatedAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("scout_list_competitors")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Competitors");
      expect(text).toContain("Rival Co");
      expect(text).toContain("INSTAGRAM");
      expect(text).toContain("@rivalco");
    });

    it("should show empty message when no competitors", async () => {
      mockPrisma.scoutCompetitor.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_list_competitors")!;
      const result = await handler({ workspace_slug: "acme" });
      expect(getText(result)).toContain("No competitors tracked yet");
    });

    it("should fall back to handle when competitor name is null", async () => {
      mockPrisma.scoutCompetitor.findMany.mockResolvedValue([
        {
          id: "c-2",
          name: null,
          platform: "TWITTER",
          handle: "handleonly",
          isActive: true,
          updatedAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("scout_list_competitors")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("**handleonly**");
      expect(text).toContain("@handleonly");
    });
  });

  describe("scout_add_competitor", () => {
    it("should create a competitor", async () => {
      mockPrisma.scoutCompetitor.create.mockResolvedValue({
        id: "c-new",
        name: "New Rival",
        platform: "TWITTER",
        handle: "newrival",
      });
      const handler = registry.handlers.get("scout_add_competitor")!;
      const result = await handler({
        workspace_slug: "acme",
        name: "New Rival",
        platform: "TWITTER",
        handle: "newrival",
      });
      const text = getText(result);
      expect(text).toContain("Competitor Added");
      expect(text).toContain("New Rival");
      expect(text).toContain("TWITTER");
      expect(text).toContain("@newrival");
      expect(text).toContain("c-new");
      expect(mockPrisma.scoutCompetitor.create).toHaveBeenCalledWith({
        data: {
          workspaceId: "ws-1",
          name: "New Rival",
          platform: "TWITTER",
          handle: "newrival",
        },
      });
    });
  });

  describe("scout_get_benchmark", () => {
    it("should return benchmark table", async () => {
      mockPrisma.scoutBenchmark.findMany.mockResolvedValue([
        {
          metric: "Engagement Rate",
          yourValue: "3.2%",
          competitorValue: "2.1%",
          difference: "+1.1%",
          generatedAt: new Date("2025-06-01"),
        },
      ]);
      const handler = registry.handlers.get("scout_get_benchmark")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Benchmarks");
      expect(text).toContain("Engagement Rate");
      expect(text).toContain("3.2%");
      expect(text).toContain("2.1%");
      expect(text).toContain("+1.1%");
    });

    it("should filter by competitor_id when provided", async () => {
      mockPrisma.scoutBenchmark.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_get_benchmark")!;
      await handler({ workspace_slug: "acme", competitor_id: "c-1" });
      expect(mockPrisma.scoutBenchmark.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ competitorId: "c-1" }),
        }),
      );
    });

    it("should show empty message when no benchmarks", async () => {
      mockPrisma.scoutBenchmark.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_get_benchmark")!;
      const result = await handler({ workspace_slug: "acme" });
      expect(getText(result)).toContain("No benchmark data available");
    });

    it("should handle benchmark records with missing fields", async () => {
      mockPrisma.scoutBenchmark.findMany.mockResolvedValue([
        { generatedAt: new Date("2025-06-01") },
      ]);
      const handler = registry.handlers.get("scout_get_benchmark")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("unknown");
      expect(text).toContain("N/A");
    });
  });

  describe("scout_list_topics", () => {
    it("should list topics with result counts", async () => {
      mockPrisma.scoutTopic.findMany.mockResolvedValue([
        { name: "AI Tools", isActive: true, _count: { results: 12 } },
        { name: "Sustainability", isActive: false, _count: { results: 8 } },
      ]);
      const handler = registry.handlers.get("scout_list_topics")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Topics");
      expect(text).toContain("AI Tools");
      expect(text).toContain("Results: 12");
      expect(text).toContain("Sustainability");
    });

    it("should respect limit parameter", async () => {
      mockPrisma.scoutTopic.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_list_topics")!;
      await handler({ workspace_slug: "acme", limit: 5 });
      expect(mockPrisma.scoutTopic.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });

    it("should show empty message when no topics", async () => {
      mockPrisma.scoutTopic.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_list_topics")!;
      const result = await handler({ workspace_slug: "acme" });
      expect(getText(result)).toContain("No topics found");
    });
  });

  describe("scout_get_insights", () => {
    it("should return scout results", async () => {
      mockPrisma.scoutTopic.findMany.mockResolvedValue([
        { id: "topic-1" },
      ]);
      mockPrisma.scoutResult.findMany.mockResolvedValue([
        {
          topicId: "topic-1",
          platform: "TWITTER",
          author: "rival_co",
          content: "Competitor posts 3x more video content than average",
          foundAt: new Date("2025-06-01"),
          engagement: { likes: 100, retweets: 50 },
          topic: { name: "Video Strategy" },
        },
      ]);
      const handler = registry.handlers.get("scout_get_insights")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Scout Results");
      expect(text).toContain("Video Strategy");
      expect(text).toContain("3x more video");
      expect(text).toContain("rival_co");
    });

    it("should return empty when no topics exist", async () => {
      mockPrisma.scoutTopic.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_get_insights")!;
      const result = await handler({ workspace_slug: "acme" });
      expect(getText(result)).toContain("No topics found");
    });

    it("should show empty message when no results", async () => {
      mockPrisma.scoutTopic.findMany.mockResolvedValue([{ id: "topic-1" }]);
      mockPrisma.scoutResult.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("scout_get_insights")!;
      const result = await handler({ workspace_slug: "acme" });
      expect(getText(result)).toContain("No insights available");
    });

    it("should truncate long content with ellipsis", async () => {
      const longContent = "A".repeat(300);
      mockPrisma.scoutTopic.findMany.mockResolvedValue([{ id: "topic-1" }]);
      mockPrisma.scoutResult.findMany.mockResolvedValue([
        {
          topicId: "topic-1",
          platform: "TWITTER",
          author: "longwriter",
          content: longContent,
          foundAt: new Date("2025-06-01"),
          engagement: { likes: 5 },
          topic: { name: "Long Topic" },
        },
      ]);
      const handler = registry.handlers.get("scout_get_insights")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("...");
      // Should contain only 200 chars of content + ellipsis
      expect(text).toContain("A".repeat(200));
    });

    it("should not add ellipsis for short content", async () => {
      const shortContent = "Short insight content";
      mockPrisma.scoutTopic.findMany.mockResolvedValue([{ id: "topic-1" }]);
      mockPrisma.scoutResult.findMany.mockResolvedValue([
        {
          topicId: "topic-1",
          platform: "INSTAGRAM",
          author: "shortwriter",
          content: shortContent,
          foundAt: new Date("2025-06-01"),
          engagement: { likes: 10 },
          topic: { name: "Short Topic" },
        },
      ]);
      const handler = registry.handlers.get("scout_get_insights")!;
      const result = await handler({ workspace_slug: "acme" });
      const text = getText(result);
      expect(text).toContain("Short insight content");
      // Ensure no truncation ellipsis
      expect(text).not.toMatch(/Short insight content\.\.\./);
    });
  });
});
