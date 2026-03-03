import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock WorkspaceCreditManager
const mockGetBalance = vi.fn();
vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: {
    getBalance: (...args: unknown[]) => mockGetBalance(...args),
  },
}));

// Mock category persistence
vi.mock("../category-persistence", () => ({
  saveEnabledCategories: vi.fn().mockResolvedValue(undefined),
}));

// Mock prisma for search_tools marketplace query
const mockPrisma = {
  registeredTool: {
    findMany: vi.fn().mockResolvedValue([]),
  },
};
vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

import { getText } from "../__test-utils__";
import type {
  CategoryInfo,
  SearchResult,
  ToolRegistry,
} from "../tool-registry";
import { registerGatewayMetaTools } from "./gateway-meta";

function createMockRegistry(): ToolRegistry & {
  handlers: Map<string, (...args: unknown[]) => unknown>;
  _searchResults: SearchResult[];
  _semanticResults: SearchResult[];
  _enabledTools: string[];
  _categories: CategoryInfo[];
  _hasCategory: boolean;
  _toolCount: number;
  _enabledCount: number;
} {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const mock = {
    register: vi.fn(
      (def: { name: string; handler: (...args: unknown[]) => unknown; }) => {
        handlers.set(def.name, def.handler);
      },
    ),
    handlers,
    _searchResults: [] as SearchResult[],
    _semanticResults: [] as SearchResult[],
    _enabledTools: [] as string[],
    _categories: [] as CategoryInfo[],
    _hasCategory: false,
    _toolCount: 10,
    _enabledCount: 5,
    searchTools: vi.fn(function(this: typeof mock) {
      return this._searchResults;
    }),
    searchToolsSemantic: vi.fn(function(this: typeof mock) {
      return this._semanticResults;
    }),
    enableTools: vi.fn(function(this: typeof mock) {
      return this._enabledTools;
    }),
    enableCategory: vi.fn(function(this: typeof mock) {
      return this._enabledTools;
    }),
    listCategories: vi.fn(function(this: typeof mock) {
      return this._categories;
    }),
    hasCategory: vi.fn(function(this: typeof mock) {
      return this._hasCategory;
    }),
    getToolCount: vi.fn(function(this: typeof mock) {
      return this._toolCount;
    }),
    getEnabledCount: vi.fn(function(this: typeof mock) {
      return this._enabledCount;
    }),
    getEnabledCategories: vi.fn().mockReturnValue([]),
  };
  return mock as unknown as ToolRegistry & typeof mock;
}

describe("gateway-meta tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerGatewayMetaTools(registry as unknown as ToolRegistry, userId);
  });

  it("should register 5 gateway-meta tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("search_tools")).toBe(true);
    expect(registry.handlers.has("list_categories")).toBe(true);
    expect(registry.handlers.has("enable_category")).toBe(true);
    expect(registry.handlers.has("get_balance")).toBe(true);
    expect(registry.handlers.has("get_status")).toBe(true);
  });

  describe("search_tools", () => {
    beforeEach(() => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);
    });

    it("should return matching tools", async () => {
      registry._searchResults = [
        {
          name: "generate_image",
          category: "image",
          description: "Generate AI images",
          tier: "free",
          enabled: false,
        },
      ];
      registry._enabledTools = ["generate_image"];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "image", limit: 10 });
      expect(getText(result)).toContain("generate_image");
      expect(getText(result)).toContain("now activated");
    });

    it("should return no results message", async () => {
      registry._searchResults = [];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "nonexistent", limit: 10 });
      expect(getText(result)).toContain("No tools found");
    });

    it("should not show (now activated) for already-enabled tools", async () => {
      registry._searchResults = [
        {
          name: "generate_image",
          category: "image",
          description: "Generate AI images",
          tier: "free",
          enabled: true,
        },
      ];
      // enableTools returns empty array (no newly enabled tools)
      registry._enabledTools = [];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "image", limit: 10 });
      expect(getText(result)).toContain("generate_image");
      expect(getText(result)).not.toContain("now activated");
      expect(getText(result)).not.toContain("(inactive)");
      // No newly enabled message
      expect(getText(result)).not.toContain(
        "tool(s) activated and ready to use",
      );
    });

    it("should show (inactive) for disabled tools not newly enabled", async () => {
      registry._searchResults = [
        {
          name: "old_tool",
          category: "legacy",
          description: "An old tool",
          tier: "free",
          enabled: false,
        },
      ];
      registry._enabledTools = [];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "old", limit: 10 });
      expect(getText(result)).toContain("(inactive)");
    });

    it("should include marketplace tools from DB in results", async () => {
      registry._searchResults = [];
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "tool-1",
          name: "community_tool",
          description: "A community tool",
          installCount: 10,
          user: { name: "Alice" },
        },
      ]);

      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "community", limit: 10 });
      expect(getText(result)).toContain("Marketplace");
      expect(getText(result)).toContain("community_tool");
      expect(getText(result)).toContain("Alice");
      expect(getText(result)).toContain("marketplace_install");
    });

    it("should show both platform and marketplace results", async () => {
      registry._searchResults = [
        {
          name: "platform_tool",
          category: "tools",
          description: "Platform tool",
          tier: "free",
          enabled: false,
        },
      ];
      registry._enabledTools = ["platform_tool"];
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "tool-2",
          name: "community_tool",
          description: "Community tool",
          installCount: 5,
          user: { name: "Bob" },
        },
      ]);

      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "tool", limit: 10 });
      expect(getText(result)).toContain("platform tool(s)");
      expect(getText(result)).toContain("platform_tool");
      expect(getText(result)).toContain("Marketplace");
      expect(getText(result)).toContain("community_tool");
    });

    it("should gracefully handle DB failure in marketplace search", async () => {
      registry._searchResults = [
        {
          name: "platform_tool",
          category: "tools",
          description: "Platform tool",
          tier: "free",
          enabled: true,
        },
      ];
      registry._enabledTools = [];
      mockPrisma.registeredTool.findMany.mockRejectedValue(
        new Error("DB down"),
      );

      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({ query: "tool", limit: 10 });
      // Should still show platform results even if DB fails
      expect(getText(result)).toContain("platform_tool");
      expect(getText(result)).not.toContain("Marketplace");
    });
  });

  describe("search_tools (semantic mode)", () => {
    beforeEach(() => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);
    });

    it("should use semantic search when semantic flag is true", async () => {
      registry._semanticResults = [
        {
          name: "generate_image",
          category: "image",
          description: "Generate AI images",
          tier: "free",
          enabled: false,
          score: 0.85,
          suggestedParams: { prompt: "a sunset" },
        },
      ];
      registry._enabledTools = ["generate_image"];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({
        query: "make pictures of a sunset",
        limit: 10,
        semantic: true,
      });
      expect(getText(result)).toContain("(semantic)");
      expect(getText(result)).toContain("generate_image");
      expect(getText(result)).toContain("Similarity: 0.85");
      expect(getText(result)).toContain("Suggested params");
    });

    it("should return no results message for semantic mode", async () => {
      registry._semanticResults = [];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({
        query: "xyznonexistent",
        limit: 10,
        semantic: true,
      });
      expect(getText(result)).toContain("No tools found");
      expect(getText(result)).toContain("(semantic)");
    });

    it("should show newly activated tools in semantic mode", async () => {
      registry._semanticResults = [
        {
          name: "generate_image",
          category: "image",
          description: "Generate AI images",
          tier: "free",
          enabled: false,
          score: 0.75,
        },
      ];
      registry._enabledTools = ["generate_image"];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({
        query: "make pictures",
        limit: 10,
        semantic: true,
      });
      expect(getText(result)).toContain("now activated");
      expect(getText(result)).toContain("1 tool(s) activated");
    });

    it("should fall through to keyword search when semantic is false", async () => {
      registry._searchResults = [
        {
          name: "generate_image",
          category: "image",
          description: "Generate AI images",
          tier: "free",
          enabled: false,
        },
      ];
      registry._enabledTools = ["generate_image"];
      const handler = registry.handlers.get("search_tools")!;
      const result = await handler({
        query: "image",
        limit: 10,
        semantic: false,
      });
      expect(getText(result)).not.toContain("(semantic)");
      expect(getText(result)).toContain("generate_image");
    });
  });

  describe("list_categories", () => {
    it("should list categories", async () => {
      registry._categories = [
        {
          name: "image",
          description: "Image tools",
          tier: "free",
          toolCount: 3,
          enabledCount: 0,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("image");
      expect(getText(result)).toContain("3 tools");
    });

    it("should list workspace-tier categories under Workspace Required heading", async () => {
      registry._categories = [
        {
          name: "image",
          description: "Image tools",
          tier: "free",
          toolCount: 3,
          enabledCount: 0,
          tools: [],
        },
        {
          name: "billing",
          description: "Billing tools",
          tier: "workspace",
          toolCount: 2,
          enabledCount: 0,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("Workspace Required");
      expect(getText(result)).toContain("billing");
    });

    it("should exclude gateway-meta category from the list", async () => {
      registry._categories = [
        {
          name: "gateway-meta",
          description: "Discovery tools",
          tier: "free",
          toolCount: 5,
          enabledCount: 5,
          tools: [],
        },
        {
          name: "image",
          description: "Image tools",
          tier: "free",
          toolCount: 3,
          enabledCount: 0,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("image");
      // gateway-meta is skipped in the free categories listing
      expect(getText(result)).not.toContain("- **gateway-meta**");
    });

    it("should show active count when enabledCount > 0", async () => {
      registry._categories = [
        {
          name: "image",
          description: "Image tools",
          tier: "free",
          toolCount: 5,
          enabledCount: 2,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("(2/5 active)");
    });

    it("should show active count for workspace-tier categories", async () => {
      registry._categories = [
        {
          name: "billing",
          description: "Billing tools",
          tier: "workspace",
          toolCount: 4,
          enabledCount: 3,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("(3/4 active)");
    });

    it("should handle empty categories list", async () => {
      registry._categories = [];
      registry._toolCount = 0;
      const handler = registry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("0 total tools");
      expect(getText(result)).toContain("search_tools");
    });
  });

  describe("enable_category", () => {
    it("should enable category tools", async () => {
      registry._enabledTools = ["generate_image", "modify_image"];
      const handler = registry.handlers.get("enable_category")!;
      const result = await handler({ category: "image" });
      expect(getText(result)).toContain("Activated 2 tool(s)");
    });

    it("should report already active", async () => {
      registry._enabledTools = [];
      registry._hasCategory = true;
      const handler = registry.handlers.get("enable_category")!;
      const result = await handler({ category: "image" });
      expect(getText(result)).toContain("already active");
    });

    it("should report category not found", async () => {
      registry._enabledTools = [];
      registry._hasCategory = false;
      registry._categories = [{
        name: "image",
        description: "",
        tier: "free",
        toolCount: 0,
        enabledCount: 0,
        tools: [],
      }];
      const handler = registry.handlers.get("enable_category")!;
      const result = await handler({ category: "nonexistent" });
      expect(getText(result)).toContain("not found");
    });
  });

  describe("get_balance", () => {
    it("should return balance", async () => {
      mockGetBalance.mockResolvedValue(100);
      const handler = registry.handlers.get("get_balance")!;
      const result = await handler({});
      expect(getText(result)).toContain("Token Balance:** 100");
    });

    it("should handle error", async () => {
      mockGetBalance.mockRejectedValue(new Error("DB down"));
      const handler = registry.handlers.get("get_balance")!;
      const result = await handler({});
      expect(getText(result)).toContain("Error getting balance");
      expect(getText(result)).toContain("DB down");
    });

    it("should handle non-Error thrown value in get_balance", async () => {
      mockGetBalance.mockRejectedValue("string failure");
      const handler = registry.handlers.get("get_balance")!;
      const result = await handler({});
      expect(getText(result)).toContain("Error getting balance");
      expect(getText(result)).toContain("Unknown error");
    });
  });

  describe("list_categories - missing listCategories guard", () => {
    it("should return error when registry.listCategories is not a function", async () => {
      const brokenRegistry = createMockRegistry();
      registerGatewayMetaTools(
        brokenRegistry as unknown as ToolRegistry,
        userId,
      );
      // Override listCategories to be undefined to trigger the guard
      (brokenRegistry as unknown as Record<string, unknown>).listCategories = undefined;
      const handler = brokenRegistry.handlers.get("list_categories")!;
      const result = await handler({});
      expect(getText(result)).toContain("Internal error");
      expect(getText(result)).toContain("registry missing listCategories");
    });
  });

  describe("enable_category - missing listCategories guard", () => {
    it("should return error when registry.listCategories is not a function and category is not found", async () => {
      const brokenRegistry = createMockRegistry();
      registerGatewayMetaTools(
        brokenRegistry as unknown as ToolRegistry,
        userId,
      );
      brokenRegistry._enabledTools = [];
      brokenRegistry._hasCategory = false;
      // Override listCategories to be undefined to trigger the guard
      (brokenRegistry as unknown as Record<string, unknown>).listCategories = undefined;
      const handler = brokenRegistry.handlers.get("enable_category")!;
      const result = await handler({ category: "nonexistent" });
      expect(getText(result)).toContain("Internal error");
      expect(getText(result)).toContain("registry missing listCategories");
    });
  });

  describe("get_status - missing listCategories guard", () => {
    it("should return error when registry.listCategories is not a function", async () => {
      const brokenRegistry = createMockRegistry();
      registerGatewayMetaTools(
        brokenRegistry as unknown as ToolRegistry,
        userId,
      );
      (brokenRegistry as unknown as Record<string, unknown>).listCategories = undefined;
      const handler = brokenRegistry.handlers.get("get_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Internal error");
      expect(getText(result)).toContain("registry missing listCategories");
    });
  });

  describe("get_status", () => {
    it("should return platform status", async () => {
      registry._categories = [
        {
          name: "image",
          description: "",
          tier: "free",
          toolCount: 3,
          enabledCount: 2,
          tools: [],
        },
        {
          name: "codespace",
          description: "",
          tier: "free",
          toolCount: 6,
          enabledCount: 0,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("get_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Platform Status");
      expect(getText(result)).toContain("Total Tools:** 10");
    });

    it("should show status with no active categories", async () => {
      registry._categories = [
        {
          name: "image",
          description: "",
          tier: "free",
          toolCount: 3,
          enabledCount: 0,
          tools: [],
        },
        {
          name: "codespace",
          description: "",
          tier: "free",
          toolCount: 6,
          enabledCount: 0,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("get_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Platform Status");
      expect(getText(result)).not.toContain("**Active:**");
      expect(getText(result)).toContain("**Available:**");
    });

    it("should show status with no inactive categories", async () => {
      registry._categories = [
        {
          name: "image",
          description: "",
          tier: "free",
          toolCount: 3,
          enabledCount: 3,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("get_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Platform Status");
      expect(getText(result)).toContain("**Active:**");
      expect(getText(result)).not.toContain("**Available:**");
    });

    it("should exclude gateway-meta from inactive categories", async () => {
      registry._categories = [
        {
          name: "gateway-meta",
          description: "",
          tier: "free",
          toolCount: 5,
          enabledCount: 0,
          tools: [],
        },
      ];
      const handler = registry.handlers.get("get_status")!;
      const result = await handler({});
      // gateway-meta with enabledCount=0 is excluded from inactive list
      expect(getText(result)).not.toContain("**Available:**");
    });
  });
});
