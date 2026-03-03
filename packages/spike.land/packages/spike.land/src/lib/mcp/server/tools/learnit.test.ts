import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  learnItContent: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock relation service
const mockGetRelatedTopics = vi.fn();
const mockGetPrerequisites = vi.fn();
const mockGetChildTopics = vi.fn();
const mockGetParentTopic = vi.fn();

vi.mock("@/lib/learnit/relation-service", () => ({
  getRelatedTopics: (...args: unknown[]) => mockGetRelatedTopics(...args),
  getPrerequisites: (...args: unknown[]) => mockGetPrerequisites(...args),
  getChildTopics: (...args: unknown[]) => mockGetChildTopics(...args),
  getParentTopic: (...args: unknown[]) => mockGetParentTopic(...args),
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerLearnItTools } from "./learnit";

describe("learnit tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerLearnItTools(registry, userId);
  });

  it("should register 6 learnit tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
    expect(registry.handlers.has("learnit_get_topic")).toBe(true);
    expect(registry.handlers.has("learnit_search_topics")).toBe(true);
    expect(registry.handlers.has("learnit_get_relations")).toBe(true);
    expect(registry.handlers.has("learnit_list_popular")).toBe(true);
    expect(registry.handlers.has("learnit_list_recent")).toBe(true);
    expect(registry.handlers.has("learnit_get_topic_graph")).toBe(true);
  });

  describe("learnit_get_topic", () => {
    it("should return topic with truncated content", async () => {
      const longContent = "A".repeat(5000);
      mockPrisma.learnItContent.findUnique.mockResolvedValue({
        id: "topic-1",
        slug: "javascript/closures",
        title: "JavaScript Closures",
        description: "Understanding closures in JS",
        content: longContent,
        parentSlug: "javascript",
        wikiLinks: ["javascript/scope", "javascript/functions"],
        viewCount: 99,
        status: "PUBLISHED",
        generatedAt: new Date("2025-06-01"),
      });
      mockPrisma.learnItContent.update.mockResolvedValue({});

      const handler = registry.handlers.get("learnit_get_topic")!;
      const result = await handler({ slug: "javascript/closures" });

      const text = getText(result);
      expect(text).toContain("JavaScript Closures");
      expect(text).toContain("javascript/closures");
      expect(text).toContain("PUBLISHED");
      expect(text).toContain("99");
      expect(text).toContain("javascript");
      expect(text).toContain("javascript/scope");
      expect(text).toContain("...(truncated)");
      expect(text.length).toBeLessThan(longContent.length);
    });

    it("should return full content when under limit", async () => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue({
        id: "topic-2",
        slug: "python/basics",
        title: "Python Basics",
        description: "Getting started with Python",
        content: "Python is a high-level programming language.",
        parentSlug: null,
        wikiLinks: [],
        viewCount: 10,
        status: "PUBLISHED",
        generatedAt: new Date("2025-06-01"),
      });
      mockPrisma.learnItContent.update.mockResolvedValue({});

      const handler = registry.handlers.get("learnit_get_topic")!;
      const result = await handler({ slug: "python/basics" });

      const text = getText(result);
      expect(text).toContain("Python is a high-level programming language.");
      expect(text).not.toContain("truncated");
    });

    it("should return NOT_FOUND for missing topic", async () => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("learnit_get_topic")!;
      const result = await handler({ slug: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should fire-and-forget view count increment", async () => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue({
        id: "topic-3",
        slug: "rust/ownership",
        title: "Rust Ownership",
        description: "Understanding ownership",
        content: "Ownership is a key concept in Rust.",
        parentSlug: null,
        wikiLinks: [],
        viewCount: 5,
        status: "PUBLISHED",
        generatedAt: new Date("2025-06-01"),
      });
      mockPrisma.learnItContent.update.mockResolvedValue({});

      const handler = registry.handlers.get("learnit_get_topic")!;
      await handler({ slug: "rust/ownership" });

      // View count update should have been called
      expect(mockPrisma.learnItContent.update).toHaveBeenCalledWith({
        where: { slug: "rust/ownership" },
        data: { viewCount: { increment: 1 } },
      });
    });

    it("should swallow view count increment errors silently", async () => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue({
        id: "topic-4",
        slug: "go/goroutines",
        title: "Go Goroutines",
        description: "Concurrency in Go",
        content: "Goroutines are lightweight threads.",
        parentSlug: null,
        wikiLinks: [],
        viewCount: 3,
        status: "PUBLISHED",
        generatedAt: new Date("2025-06-01"),
      });
      // Make update reject — the catch(() => {}) at L81 should swallow it
      mockPrisma.learnItContent.update.mockRejectedValue(
        new Error("DB write failed"),
      );

      const handler = registry.handlers.get("learnit_get_topic")!;
      const result = await handler({ slug: "go/goroutines" });

      // Should still return the topic successfully despite the update failure
      const text = getText(result);
      expect(text).toContain("Go Goroutines");
      // Wait for async catch to fire
      await new Promise(r => setTimeout(r, 10));
    });
  });

  describe("learnit_search_topics", () => {
    it("should return matching topics", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([
        {
          slug: "javascript/closures",
          title: "JavaScript Closures",
          description: "Understanding closures in JS",
          viewCount: 50,
        },
        {
          slug: "javascript/scope",
          title: "JavaScript Scope",
          description: "Lexical scope and closures",
          viewCount: 30,
        },
      ]);

      const handler = registry.handlers.get("learnit_search_topics")!;
      const result = await handler({ query: "javascript" });

      const text = getText(result);
      expect(text).toContain("Found 2 topic(s)");
      expect(text).toContain("JavaScript Closures");
      expect(text).toContain("JavaScript Scope");
      expect(text).toContain("50 views");
    });

    it("should return message when no topics found", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_search_topics")!;
      const result = await handler({ query: "zzzzz" });

      expect(getText(result)).toContain("No topics found matching \"zzzzz\"");
    });

    it("should use default limit of 10", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_search_topics")!;
      await handler({ query: "test" });

      expect(mockPrisma.learnItContent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe("learnit_get_relations", () => {
    const topic = { id: "topic-1", title: "JavaScript Closures" };

    beforeEach(() => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue(topic);
    });

    it("should return all relations when no type filter", async () => {
      mockGetRelatedTopics.mockResolvedValue([
        {
          id: "t2",
          slug: "javascript/scope",
          title: "Scope",
          description: "...",
        },
      ]);
      mockGetPrerequisites.mockResolvedValue([
        {
          id: "t3",
          slug: "javascript/functions",
          title: "Functions",
          description: "...",
        },
      ]);
      mockGetChildTopics.mockResolvedValue([]);
      mockGetParentTopic.mockResolvedValue({
        id: "t4",
        slug: "javascript",
        title: "JavaScript",
        description: "...",
      });

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({ slug: "javascript/closures" });

      const text = getText(result);
      expect(text).toContain("Related (1):");
      expect(text).toContain("Scope");
      expect(text).toContain("Prerequisites (1):");
      expect(text).toContain("Functions");
      expect(text).toContain("Children (0):");
      expect(text).toContain("Parent:** JavaScript");
    });

    it("should filter by type=related", async () => {
      mockGetRelatedTopics.mockResolvedValue([
        {
          id: "t2",
          slug: "javascript/scope",
          title: "Scope",
          description: "...",
        },
      ]);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "related",
      });

      const text = getText(result);
      expect(text).toContain("Related (1):");
      expect(text).not.toContain("Prerequisites");
      expect(text).not.toContain("Children");
      expect(text).not.toContain("Parent:**");
    });

    it("should filter by type=parent", async () => {
      mockGetParentTopic.mockResolvedValue({
        id: "t4",
        slug: "javascript",
        title: "JavaScript",
        description: "...",
      });

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "parent",
      });

      const text = getText(result);
      expect(text).toContain("Parent:** JavaScript");
      expect(text).not.toContain("Related");
      expect(text).not.toContain("Prerequisites");
    });

    it("should filter by type=children with results", async () => {
      mockGetChildTopics.mockResolvedValue([
        {
          id: "c1",
          slug: "javascript/closures/patterns",
          title: "Closure Patterns",
          description: "...",
        },
        {
          id: "c2",
          slug: "javascript/closures/memory",
          title: "Memory & Closures",
          description: "...",
        },
      ]);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "children",
      });

      const text = getText(result);
      expect(text).toContain("Children (2):");
      expect(text).toContain("Closure Patterns");
      expect(text).toContain("Memory & Closures");
      expect(text).not.toContain("Related");
      expect(text).not.toContain("Prerequisites");
    });

    it("should show (none) for empty related list", async () => {
      mockGetRelatedTopics.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "related",
      });

      const text = getText(result);
      expect(text).toContain("Related (0):");
      expect(text).toContain("(none)");
    });

    it("should show (none) for empty prerequisites list", async () => {
      mockGetPrerequisites.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "prerequisites",
      });

      const text = getText(result);
      expect(text).toContain("Prerequisites (0):");
      expect(text).toContain("(none)");
    });

    it("should show (none) when parent is null", async () => {
      mockGetParentTopic.mockResolvedValue(null);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "parent",
      });

      const text = getText(result);
      expect(text).toContain("Parent:** (none)");
    });

    it("should return NOT_FOUND for missing topic", async () => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({ slug: "nope" });

      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("learnit_list_popular", () => {
    it("should list popular topics", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([
        {
          slug: "javascript/closures",
          title: "Closures",
          description: "Understanding closures",
          viewCount: 200,
        },
        {
          slug: "python/basics",
          title: "Python Basics",
          description: "Getting started",
          viewCount: 150,
        },
      ]);

      const handler = registry.handlers.get("learnit_list_popular")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Top 2 Topic(s) by Views");
      expect(text).toContain("Closures");
      expect(text).toContain("200 views");
      expect(text).toContain("Python Basics");
    });

    it("should return message when no topics", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_list_popular")!;
      const result = await handler({});

      expect(getText(result)).toContain("No published topics found");
    });
  });

  describe("learnit_list_recent", () => {
    it("should list recent topics", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([
        {
          slug: "rust/ownership",
          title: "Rust Ownership",
          description: "Understanding ownership",
          viewCount: 10,
          createdAt: new Date("2025-06-15"),
        },
      ]);

      const handler = registry.handlers.get("learnit_list_recent")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Most Recent Topic(s)");
      expect(text).toContain("Rust Ownership");
      expect(text).toContain("2025-06-15");
    });

    it("should return message when no topics", async () => {
      mockPrisma.learnItContent.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_list_recent")!;
      const result = await handler({});

      expect(getText(result)).toContain("No published topics found");
    });
  });

  describe("learnit_get_topic_graph", () => {
    const centerTopic = {
      id: "center-1",
      title: "JavaScript Closures",
      slug: "javascript/closures",
    };

    beforeEach(() => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue(centerTopic);
    });

    it("should return depth-1 graph", async () => {
      mockGetParentTopic.mockResolvedValue({
        id: "p1",
        slug: "javascript",
        title: "JavaScript",
        description: "...",
      });
      mockGetChildTopics.mockResolvedValue([]);
      mockGetRelatedTopics.mockResolvedValue([
        {
          id: "r1",
          slug: "javascript/scope",
          title: "Scope",
          description: "...",
        },
      ]);
      mockGetPrerequisites.mockResolvedValue([
        {
          id: "pr1",
          slug: "javascript/functions",
          title: "Functions",
          description: "...",
        },
      ]);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({ slug: "javascript/closures" });

      const text = getText(result);
      expect(text).toContain("Topic Graph:");
      expect(text).toContain("Parent:** JavaScript");
      expect(text).toContain("Children (0):");
      expect(text).toContain("Related (1):");
      expect(text).toContain("Scope");
      expect(text).toContain("Prerequisites (1):");
      expect(text).toContain("Functions");
      expect(text).not.toContain("Depth-2");
    });

    it("should return depth-2 graph with neighbor expansions", async () => {
      const parent = {
        id: "p1",
        slug: "javascript",
        title: "JavaScript",
        description: "...",
      };
      mockGetParentTopic.mockResolvedValue(parent);
      mockGetChildTopics.mockResolvedValue([
        {
          id: "c1",
          slug: "javascript/closures/patterns",
          title: "Patterns",
          description: "...",
        },
      ]);
      mockGetRelatedTopics.mockResolvedValue([
        {
          id: "r1",
          slug: "javascript/scope",
          title: "Scope",
          description: "...",
        },
      ]);
      mockGetPrerequisites.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({
        slug: "javascript/closures",
        depth: 2,
      });

      const text = getText(result);
      expect(text).toContain("Depth-2 Expansions");
      // Parent, first child, first related = 3 expansions
      expect(mockGetChildTopics).toHaveBeenCalled();
      expect(mockGetRelatedTopics).toHaveBeenCalled();
    });

    it("should return NOT_FOUND for missing center topic", async () => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({ slug: "nope" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should handle empty graph", async () => {
      mockGetParentTopic.mockResolvedValue(null);
      mockGetChildTopics.mockResolvedValue([]);
      mockGetRelatedTopics.mockResolvedValue([]);
      mockGetPrerequisites.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({ slug: "javascript/closures" });

      const text = getText(result);
      expect(text).toContain("Parent:** (none)");
      expect(text).toContain("Children (0):");
      expect(text).toContain("Related (0):");
      expect(text).toContain("Prerequisites (0):");
    });

    it("should expand depth-2 neighbors with children and related", async () => {
      const parent = {
        id: "p1",
        slug: "javascript",
        title: "JavaScript",
        description: "...",
      };
      const child1 = {
        id: "c1",
        slug: "javascript/closures/patterns",
        title: "Patterns",
        description: "...",
      };
      const related1 = {
        id: "r1",
        slug: "javascript/scope",
        title: "Scope",
        description: "...",
      };

      // First call (depth-1): center topic relations
      mockGetParentTopic.mockResolvedValueOnce(parent);
      mockGetChildTopics.mockResolvedValueOnce([child1]);
      mockGetRelatedTopics.mockResolvedValueOnce([related1]);
      mockGetPrerequisites.mockResolvedValueOnce([]);

      // Depth-2 expansions: parent, child1, related1 = 3 neighbors
      // For parent
      mockGetChildTopics.mockResolvedValueOnce([
        {
          id: "pc1",
          slug: "javascript/basics",
          title: "Basics",
          description: "...",
        },
      ]);
      mockGetRelatedTopics.mockResolvedValueOnce([]);
      // For child1
      mockGetChildTopics.mockResolvedValueOnce([]);
      mockGetRelatedTopics.mockResolvedValueOnce([
        {
          id: "cr1",
          slug: "javascript/closures/advanced",
          title: "Advanced",
          description: "...",
        },
      ]);
      // For related1
      mockGetChildTopics.mockResolvedValueOnce([]);
      mockGetRelatedTopics.mockResolvedValueOnce([]);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({ slug: "javascript/closures", depth: 2 });

      const text = getText(result);
      expect(text).toContain("Depth-2 Expansions (3)");
      expect(text).toContain("JavaScript");
      expect(text).toContain("Children: Basics");
      expect(text).toContain("Related: Advanced");
    });

    it("should not show depth-2 section when no neighbors exist", async () => {
      mockGetParentTopic.mockResolvedValue(null);
      mockGetChildTopics.mockResolvedValue([]);
      mockGetRelatedTopics.mockResolvedValue([]);
      mockGetPrerequisites.mockResolvedValue([]);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({ slug: "javascript/closures", depth: 2 });

      const text = getText(result);
      expect(text).not.toContain("Depth-2 Expansions");
    });

    it("should cap depth-2 expansions at 3 neighbors", async () => {
      const parent = {
        id: "p1",
        slug: "javascript",
        title: "JavaScript",
        description: "...",
      };
      const children = [
        { id: "c1", slug: "js/a", title: "A", description: "..." },
        { id: "c2", slug: "js/b", title: "B", description: "..." },
      ];
      const related = [
        { id: "r1", slug: "js/c", title: "C", description: "..." },
        { id: "r2", slug: "js/d", title: "D", description: "..." },
      ];

      mockGetParentTopic.mockResolvedValueOnce(parent);
      mockGetChildTopics.mockResolvedValueOnce(children);
      mockGetRelatedTopics.mockResolvedValueOnce(related);
      mockGetPrerequisites.mockResolvedValueOnce([]);

      // Only 3 neighbors: parent + children[0] + related[0] (capped at 3)
      mockGetChildTopics.mockResolvedValueOnce([]);
      mockGetRelatedTopics.mockResolvedValueOnce([]);
      mockGetChildTopics.mockResolvedValueOnce([]);
      mockGetRelatedTopics.mockResolvedValueOnce([]);
      mockGetChildTopics.mockResolvedValueOnce([]);
      mockGetRelatedTopics.mockResolvedValueOnce([]);

      const handler = registry.handlers.get("learnit_get_topic_graph")!;
      const result = await handler({ slug: "javascript/closures", depth: 2 });

      const text = getText(result);
      expect(text).toContain("Depth-2 Expansions (3)");
    });
  });

  describe("learnit_get_relations - filter by prerequisites", () => {
    beforeEach(() => {
      mockPrisma.learnItContent.findUnique.mockResolvedValue({
        id: "topic-1",
        title: "JavaScript Closures",
      });
    });

    it("should filter by type=prerequisites", async () => {
      mockGetPrerequisites.mockResolvedValue([
        {
          id: "t3",
          slug: "javascript/functions",
          title: "Functions",
          description: "...",
        },
      ]);

      const handler = registry.handlers.get("learnit_get_relations")!;
      const result = await handler({
        slug: "javascript/closures",
        type: "prerequisites",
      });

      const text = getText(result);
      expect(text).toContain("Prerequisites (1):");
      expect(text).toContain("Functions");
      expect(text).not.toContain("Related");
      expect(text).not.toContain("Children");
      expect(text).not.toContain("Parent:**");
    });
  });
});
