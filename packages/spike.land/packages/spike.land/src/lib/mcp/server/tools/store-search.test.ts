import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRegistry, getText } from "../__test-utils__";
import { registerStoreSearchTools } from "./store-search";

describe("store-search tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerStoreSearchTools(registry, userId);
  });

  it("should register 6 store-search tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
    expect(registry.handlers.has("store_list_apps_with_tools")).toBe(true);
    expect(registry.handlers.has("store_search")).toBe(true);
    expect(registry.handlers.has("store_browse_category")).toBe(true);
    expect(registry.handlers.has("store_featured_apps")).toBe(true);
    expect(registry.handlers.has("store_new_apps")).toBe(true);
    expect(registry.handlers.has("store_app_detail")).toBe(true);
  });

  describe("store_search", () => {
    it("should find apps by name", async () => {
      const handler = registry.handlers.get("store_search")!;
      const result = await handler({ query: "codespace", limit: 10 });

      const text = getText(result);
      expect(text).toContain("Search Results");
      expect(text).toContain("codespace");
    });

    it("should find apps by tag", async () => {
      const handler = registry.handlers.get("store_search")!;
      const result = await handler({ query: "code-editor", limit: 10 });

      const text = getText(result);
      expect(text).toContain("Search Results");
    });

    it("should return empty when no match", async () => {
      const handler = registry.handlers.get("store_search")!;
      const result = await handler({
        query: "zzz-nonexistent-query-zzz",
        limit: 10,
      });

      const text = getText(result);
      expect(text).toContain("No apps found");
    });

    it("should respect limit parameter", async () => {
      const handler = registry.handlers.get("store_search")!;
      const result = await handler({ query: "a", limit: 2 });

      const text = getText(result);
      const bullets = text.match(/^- \*\*/gm);
      if (bullets) {
        expect(bullets.length).toBeLessThanOrEqual(2);
      }
    });
  });

  describe("store_browse_category", () => {
    it("should return apps for developer category", async () => {
      const handler = registry.handlers.get("store_browse_category")!;
      const result = await handler({ category: "developer" });

      const text = getText(result);
      expect(text).toContain("developer");
      expect(text).toContain("**");
    });

    it("should return empty for unknown category", async () => {
      const handler = registry.handlers.get("store_browse_category")!;
      const result = await handler({ category: "nonexistent-category-xyz" });

      const text = getText(result);
      expect(text).toContain("No apps found");
    });
  });

  describe("store_featured_apps", () => {
    it("should return featured apps", async () => {
      const handler = registry.handlers.get("store_featured_apps")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Featured Apps");
      expect(text).toContain("**");
    });
  });

  describe("store_new_apps", () => {
    it("should return new apps", async () => {
      const handler = registry.handlers.get("store_new_apps")!;
      const result = await handler({});

      const text = getText(result);
      // Either shows new apps or says none available
      expect(text.includes("New Apps") || text.includes("No new apps")).toBe(
        true,
      );
    });
  });

  describe("store_list_apps_with_tools", () => {
    it("should return all apps with tool names as JSON", async () => {
      const handler = registry.handlers.get("store_list_apps_with_tools")!;
      const result = await handler({});

      const text = getText(result);
      const parsed = JSON.parse(text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);

      // Each entry should have the expected shape
      const first = parsed[0];
      expect(first).toHaveProperty("slug");
      expect(first).toHaveProperty("name");
      expect(first).toHaveProperty("icon");
      expect(first).toHaveProperty("category");
      expect(first).toHaveProperty("tagline");
      expect(first).toHaveProperty("toolNames");
      expect(Array.isArray(first.toolNames)).toBe(true);
    });

    it("should include chess-arena tools", async () => {
      const handler = registry.handlers.get("store_list_apps_with_tools")!;
      const result = await handler({});

      const text = getText(result);
      const parsed = JSON.parse(text);
      const chessApp = parsed.find((a: Record<string, unknown>) => a.slug === "chess-arena");
      expect(chessApp).toBeDefined();
      expect(chessApp.toolNames).toContain("chess_create_game");
    });
  });

  describe("store_app_detail", () => {
    it("should return full card for codespace", async () => {
      const handler = registry.handlers.get("store_app_detail")!;
      const result = await handler({ slug: "codespace" });

      const text = getText(result);
      expect(text).toContain("CodeSpace");
      expect(text).toContain("Category");
      expect(text).toContain("Tags");
      expect(text).toContain("Pricing");
      expect(text).toContain("Tools");
      expect(text).toContain("Featured");
    });

    it("should return not-found for nonexistent slug", async () => {
      const handler = registry.handlers.get("store_app_detail")!;
      const result = await handler({ slug: "nonexistent-xyz" });

      const text = getText(result);
      expect(text).toContain("not found");
    });
  });
});
