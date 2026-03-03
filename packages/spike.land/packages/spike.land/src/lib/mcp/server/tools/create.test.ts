import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  createdApp: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock slug classifier
const mockClassifyInput = vi.fn();

vi.mock("@/lib/create/slug-classifier", () => ({
  classifyInput: (...args: unknown[]) => mockClassifyInput(...args),
}));

// Mock codespace health
const mockIsCodespaceHealthy = vi.fn();
const mockFilterHealthyCodespaces = vi.fn();

vi.mock("@/lib/create/codespace-health", () => ({
  isCodespaceHealthy: (...args: unknown[]) => mockIsCodespaceHealthy(...args),
  filterHealthyCodespaces: (...args: unknown[]) => mockFilterHealthyCodespaces(...args),
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCreateTools } from "./create";

describe("create tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCreateTools(registry, userId);
  });

  it("should register 7 create tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(7);
    expect(registry.handlers.has("create_search_apps")).toBe(true);
    expect(registry.handlers.has("create_get_app")).toBe(true);
    expect(registry.handlers.has("create_classify_idea")).toBe(true);
    expect(registry.handlers.has("create_check_health")).toBe(true);
    expect(registry.handlers.has("create_list_top_apps")).toBe(true);
    expect(registry.handlers.has("create_list_recent_apps")).toBe(true);
    expect(registry.handlers.has("create_get_app_status")).toBe(true);
  });

  describe("create_search_apps", () => {
    it("should return matching apps", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([
        {
          slug: "games/tetris",
          title: "Tetris Clone",
          description: "A classic tetris game built in React",
          codespaceUrl: "https://testing.spike.land/live/games-tetris",
          viewCount: 42,
          generatedAt: new Date("2025-06-01"),
        },
      ]);

      const handler = registry.handlers.get("create_search_apps")!;
      const result = await handler({ query: "tetris" });

      const text = getText(result);
      expect(text).toContain("Found 1 app(s)");
      expect(text).toContain("Tetris Clone");
      expect(text).toContain("games/tetris");
      expect(text).toContain("42");
    });

    it("should return message when no apps found", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("create_search_apps")!;
      const result = await handler({ query: "nonexistent" });

      expect(getText(result)).toContain("No apps found matching \"nonexistent\"");
    });

    it("should use default limit of 10", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("create_search_apps")!;
      await handler({ query: "test" });

      expect(mockPrisma.createdApp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });

    it("should respect custom limit", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("create_search_apps")!;
      await handler({ query: "test", limit: 5 });

      expect(mockPrisma.createdApp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });

  describe("create_get_app", () => {
    it("should return app details with generator info", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue({
        slug: "health/water-tracker",
        title: "Water Tracker",
        description: "Track your daily water intake",
        status: "PUBLISHED",
        codespaceId: "cs-123",
        codespaceUrl: "https://testing.spike.land/live/health-water-tracker",
        viewCount: 15,
        generatedAt: new Date("2025-06-01"),
        promptUsed: "Make a water tracking app",
        outgoingLinks: ["health/fitness"],
        generatedBy: { id: "user-1", name: "Alice" },
      });

      const handler = registry.handlers.get("create_get_app")!;
      const result = await handler({ slug: "health/water-tracker" });

      const text = getText(result);
      expect(text).toContain("Water Tracker");
      expect(text).toContain("PUBLISHED");
      expect(text).toContain("cs-123");
      expect(text).toContain("Alice");
      expect(text).toContain("Make a water tracking app");
      expect(text).toContain("health/fitness");
    });

    it("should return NOT_FOUND for missing app", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("create_get_app")!;
      const result = await handler({ slug: "nope" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should handle app without generator", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue({
        slug: "games/pong",
        title: "Pong",
        description: "Classic pong",
        status: "PUBLISHED",
        codespaceId: "cs-456",
        codespaceUrl: "https://testing.spike.land/live/games-pong",
        viewCount: 5,
        generatedAt: new Date("2025-06-01"),
        promptUsed: "Make pong",
        outgoingLinks: [],
        generatedBy: null,
      });

      const handler = registry.handlers.get("create_get_app")!;
      const result = await handler({ slug: "games/pong" });

      const text = getText(result);
      expect(text).toContain("Pong");
      expect(text).not.toContain("Generated By:");
    });

    it("should fall back to generatedBy.id when name is null", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue({
        slug: "games/snake",
        title: "Snake",
        description: "Classic snake game",
        status: "PUBLISHED",
        codespaceId: "cs-789",
        codespaceUrl: "https://testing.spike.land/live/games-snake",
        viewCount: 3,
        generatedAt: new Date("2025-06-01"),
        promptUsed: "Make snake",
        outgoingLinks: [],
        generatedBy: { id: "user-anon", name: null },
      });

      const handler = registry.handlers.get("create_get_app")!;
      const result = await handler({ slug: "games/snake" });

      const text = getText(result);
      expect(text).toContain("Generated By:** user-anon");
    });
  });

  describe("create_classify_idea", () => {
    it("should classify a valid idea", async () => {
      mockClassifyInput.mockResolvedValue({
        status: "ok",
        slug: "health/water-tracker",
        category: "health",
        reason: null,
      });

      const handler = registry.handlers.get("create_classify_idea")!;
      const result = await handler({ text: "water tracking app" });

      const text = getText(result);
      expect(text).toContain("Classification Result");
      expect(text).toContain("Status:** ok");
      expect(text).toContain("health/water-tracker");
      expect(text).toContain("Category:** health");
      expect(mockClassifyInput).toHaveBeenCalledWith("water tracking app");
    });

    it("should return blocked status", async () => {
      mockClassifyInput.mockResolvedValue({
        status: "blocked",
        slug: "",
        category: "",
        reason: "Content violates policy.",
      });

      const handler = registry.handlers.get("create_classify_idea")!;
      const result = await handler({ text: "harmful content" });

      const text = getText(result);
      expect(text).toContain("Status:** blocked");
      expect(text).toContain("Content violates policy.");
    });

    it("should return unclear status", async () => {
      mockClassifyInput.mockResolvedValue({
        status: "unclear",
        slug: "",
        category: "",
        reason: "Try describing what the app should do.",
      });

      const handler = registry.handlers.get("create_classify_idea")!;
      const result = await handler({ text: "x" });

      const text = getText(result);
      expect(text).toContain("Status:** unclear");
      expect(text).toContain("Slug:** (none)");
    });
  });

  describe("create_check_health", () => {
    it("should return healthy status", async () => {
      mockIsCodespaceHealthy.mockResolvedValue(true);

      const handler = registry.handlers.get("create_check_health")!;
      const result = await handler({ codespace_id: "cs-123" });

      const text = getText(result);
      expect(text).toContain("Codespace Health Check");
      expect(text).toContain("cs-123");
      expect(text).toContain("Healthy:** true");
      expect(mockIsCodespaceHealthy).toHaveBeenCalledWith("cs-123");
    });

    it("should return unhealthy status", async () => {
      mockIsCodespaceHealthy.mockResolvedValue(false);

      const handler = registry.handlers.get("create_check_health")!;
      const result = await handler({ codespace_id: "cs-broken" });

      expect(getText(result)).toContain("Healthy:** false");
    });
  });

  describe("create_list_top_apps", () => {
    it("should list top apps filtered by health", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([
        {
          slug: "games/tetris",
          title: "Tetris",
          description: "Classic game",
          codespaceId: "cs-1",
          codespaceUrl: "https://testing.spike.land/live/games-tetris",
          viewCount: 100,
        },
        {
          slug: "games/pong",
          title: "Pong",
          description: "Classic pong",
          codespaceId: "cs-2",
          codespaceUrl: "https://testing.spike.land/live/games-pong",
          viewCount: 50,
        },
      ]);
      mockFilterHealthyCodespaces.mockResolvedValue([
        {
          slug: "games/tetris",
          title: "Tetris",
          description: "Classic game",
          codespaceId: "cs-1",
          codespaceUrl: "https://testing.spike.land/live/games-tetris",
          viewCount: 100,
        },
      ]);

      const handler = registry.handlers.get("create_list_top_apps")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Top 1 App(s) by Views");
      expect(text).toContain("Tetris");
      expect(text).toContain("100 views");
      expect(text).not.toContain("Pong");
    });

    it("should return message when no healthy apps", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([]);
      mockFilterHealthyCodespaces.mockResolvedValue([]);

      const handler = registry.handlers.get("create_list_top_apps")!;
      const result = await handler({});

      expect(getText(result)).toContain("No healthy published apps found");
    });

    it("should fetch double the limit for health filtering", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([]);
      mockFilterHealthyCodespaces.mockResolvedValue([]);

      const handler = registry.handlers.get("create_list_top_apps")!;
      await handler({ limit: 5 });

      expect(mockPrisma.createdApp.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe("create_list_recent_apps", () => {
    it("should list recent apps filtered by health", async () => {
      const now = new Date();
      mockPrisma.createdApp.findMany.mockResolvedValue([
        {
          slug: "dev-tools/json-formatter",
          title: "JSON Formatter",
          description: "Format JSON nicely",
          codespaceId: "cs-3",
          codespaceUrl: "https://testing.spike.land/live/dev-tools-json",
          viewCount: 10,
          generatedAt: now,
        },
      ]);
      mockFilterHealthyCodespaces.mockResolvedValue([
        {
          slug: "dev-tools/json-formatter",
          title: "JSON Formatter",
          description: "Format JSON nicely",
          codespaceId: "cs-3",
          codespaceUrl: "https://testing.spike.land/live/dev-tools-json",
          viewCount: 10,
          generatedAt: now,
        },
      ]);

      const handler = registry.handlers.get("create_list_recent_apps")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Most Recent App(s)");
      expect(text).toContain("JSON Formatter");
    });

    it("should return message when no healthy recent apps", async () => {
      mockPrisma.createdApp.findMany.mockResolvedValue([]);
      mockFilterHealthyCodespaces.mockResolvedValue([]);

      const handler = registry.handlers.get("create_list_recent_apps")!;
      const result = await handler({});

      expect(getText(result)).toContain("No healthy recent apps found");
    });
  });

  describe("create_get_app_status", () => {
    it("should return PUBLISHED status", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue({
        slug: "games/tetris",
        title: "Tetris",
        status: "PUBLISHED",
        codespaceUrl: "https://testing.spike.land/live/games-tetris",
      });

      const handler = registry.handlers.get("create_get_app_status")!;
      const result = await handler({ slug: "games/tetris" });

      const text = getText(result);
      expect(text).toContain("App Status");
      expect(text).toContain("Status:** PUBLISHED");
      expect(text).toContain("Tetris");
    });

    it("should return GENERATING status", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue({
        slug: "games/new-game",
        title: "New Game",
        status: "GENERATING",
        codespaceUrl: "https://testing.spike.land/live/games-new-game",
      });

      const handler = registry.handlers.get("create_get_app_status")!;
      const result = await handler({ slug: "games/new-game" });

      expect(getText(result)).toContain("Status:** GENERATING");
    });

    it("should return FAILED status", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue({
        slug: "games/broken",
        title: "Broken",
        status: "FAILED",
        codespaceUrl: "https://testing.spike.land/live/games-broken",
      });

      const handler = registry.handlers.get("create_get_app_status")!;
      const result = await handler({ slug: "games/broken" });

      expect(getText(result)).toContain("Status:** FAILED");
    });

    it("should return NOT_FOUND for missing app", async () => {
      mockPrisma.createdApp.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("create_get_app_status")!;
      const result = await handler({ slug: "nope" });

      expect(getText(result)).toContain("NOT_FOUND");
    });
  });
});
