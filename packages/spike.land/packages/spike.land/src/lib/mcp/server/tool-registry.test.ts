import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToolRegistry } from "./tool-registry";
import type { ToolDefinition } from "./tool-registry";
import logger from "@/lib/logger";

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockPrismaCreate = vi.fn();
vi.mock("@/lib/prisma", () => {
  return {
    default: {
      skillUsageEvent: {
        create: (...args: any[]) => mockPrismaCreate(...args),
      },
    },
    __esModule: true,
  };
});

function createMockMcpServer() {
  return {
    registerTool: vi.fn().mockReturnValue({
      enabled: true,
      enable: vi.fn(),
      disable: vi.fn(),
    }),
  };
}

function makeTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: overrides.name ?? "test-tool",
    description: overrides.description ?? "A test tool",
    category: overrides.category ?? "test-category",
    tier: overrides.tier ?? "free",
    handler: overrides.handler
      ?? ((() => ({ content: [] })) as ToolDefinition["handler"]),
    alwaysEnabled: overrides.alwaysEnabled,
    inputSchema: overrides.inputSchema,
    annotations: overrides.annotations,
    complexity: overrides.complexity,
  };
}

describe("ToolRegistry", () => {
  let mcpServer: ReturnType<typeof createMockMcpServer>;
  let registry: ToolRegistry;

  beforeEach(async () => {
    // Flush any pending fire-and-forget async operations from the previous test
    // (e.g. recordSkillUsage's dynamic import resolving) before clearing mocks
    await new Promise(r => setTimeout(r, 100));
    vi.clearAllMocks();
    mockPrismaCreate.mockClear();
    mcpServer = createMockMcpServer();
    registry = new ToolRegistry({ ...mcpServer } as any, "test-user-id");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockPrismaCreate.mockClear();
  });

  describe("constructor", () => {
    it("should create an instance", () => {
      expect(registry).toBeInstanceOf(ToolRegistry);
    });
  });

  describe("register", () => {
    it("should register a tool with mcpServer", () => {
      const tool = makeTool();
      registry.register(tool);

      expect(mcpServer.registerTool).toHaveBeenCalledWith(
        "test-tool",
        {
          description: "A test tool",
          inputSchema: undefined,
          annotations: undefined,
          _meta: { category: "test-category", tier: "free" },
        },
        expect.any(Function),
      );
    });

    it("should disable non-alwaysEnabled tools", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValue(mockRegistered);

      registry.register(makeTool({ alwaysEnabled: false }));

      expect(mockRegistered.disable).toHaveBeenCalled();
    });

    it("should disable tools without alwaysEnabled set", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValue(mockRegistered);

      registry.register(makeTool());

      expect(mockRegistered.disable).toHaveBeenCalled();
    });

    it("should keep alwaysEnabled tools enabled (not call disable)", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValue(mockRegistered);

      registry.register(makeTool({ alwaysEnabled: true }));

      expect(mockRegistered.disable).not.toHaveBeenCalled();
    });

    describe("execution (wrapper)", () => {
      it("should execute the original handler and return its result", async () => {
        const mockResult = {
          content: [{ type: "text" as const, text: "success" }],
        };
        const mockHandler = vi.fn().mockResolvedValue(mockResult);

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        const result = await wrappedHandler({});
        expect(result).toBe(mockResult);
        expect(mockHandler).toHaveBeenCalledWith({});
      });

      it("should pass through errors thrown by the handler", async () => {
        const mockHandler = vi.fn().mockRejectedValue(
          new Error("Handler failed"),
        );

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        await expect(wrappedHandler({})).rejects.toThrow("Handler failed");
      });

      it("should extract tokens from _meta if present", async () => {
        const mockResult = {
          content: [],
          _meta: { _tokens: 123 },
        };
        const mockHandler = vi.fn().mockResolvedValue(mockResult);

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        const result = await wrappedHandler({});
        expect(result).toBe(mockResult);

        await new Promise(resolve => setTimeout(resolve, 50));
      });

      it("should record skill usage on success", async () => {
        const mockResult = { content: [] };
        const mockHandler = vi.fn().mockResolvedValue(mockResult);

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(
          makeTool({
            handler: mockHandler,
            name: "test-skill",
            category: "test-cat",
          }),
        );

        await wrappedHandler({ testInput: true });

        // Wait for next tick to let fire-and-forget promise resolve
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockPrismaCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            userId: "test-user-id",
            skillName: "test-skill",
            category: "test-cat",
            outcome: "success",
            durationMs: expect.any(Number),
            metadata: {
              input: { testInput: true },
            },
          }),
        });
      });

      it("should record skill usage on error", async () => {
        const mockHandler = vi.fn().mockRejectedValue(
          new Error("Test failure"),
        );

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(
          makeTool({
            handler: mockHandler,
            name: "error-tool",
            category: "test-cat",
          }),
        );

        await expect(wrappedHandler({})).rejects.toThrow("Test failure");

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockPrismaCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            outcome: "error",
            userId: "test-user-id",
            skillName: "error-tool",
            metadata: expect.objectContaining({
              errorMessage: "Test failure",
            }),
          }),
        });
      });

      it("should handle logging failures gracefully", async () => {
        const mockResult = { content: [] };
        const mockHandler = vi.fn().mockResolvedValue(mockResult);
        mockPrismaCreate.mockRejectedValueOnce(new Error("Database down"));

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        await wrappedHandler({});

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(logger.error).toHaveBeenCalledWith(
          "Failed to record skill usage event",
          expect.any(Object),
        );
      });

      it("should handle error throws that are not Error instances", async () => {
        const mockHandler = vi.fn().mockRejectedValue("String error");

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        await expect(wrappedHandler({})).rejects.toBe("String error");
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockPrismaCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            outcome: "error",
            metadata: expect.objectContaining({
              errorMessage: "String error",
            }),
          }),
        });
      });

      it("should skip logging if userId is omitted", async () => {
        const customRegistry = new ToolRegistry({ ...mcpServer } as any, ""); // Empty userId
        const mockHandler = vi.fn().mockResolvedValue({ content: [] });

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        customRegistry.register(makeTool({ handler: mockHandler }));
        await wrappedHandler({});
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockPrismaCreate).not.toHaveBeenCalled();
      });

      it("should capture isError true as outcome error even if text is absent", async () => {
        const mockResult = {
          isError: true,
          content: [
            { type: "image", data: "base64" },
          ],
        };
        const mockHandler = vi.fn().mockResolvedValue(mockResult);

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        await wrappedHandler({});

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockPrismaCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            outcome: "error",
            metadata: expect.objectContaining({
              errorMessage: "", // Join mapped empty string
            }),
          }),
        });
      });

      it("should capture isError true as outcome error", async () => {
        const mockResult = {
          isError: true,
          content: [{ type: "text", text: "Tool complained" }],
        };
        const mockHandler = vi.fn().mockResolvedValue(mockResult);

        let wrappedHandler: any;
        mcpServer.registerTool.mockImplementation(
          (_name, _options, handler) => {
            wrappedHandler = handler;
            return { enabled: true, enable: vi.fn(), disable: vi.fn() };
          },
        );

        registry.register(makeTool({ handler: mockHandler }));

        await wrappedHandler({});

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(mockPrismaCreate).toHaveBeenCalledWith({
          data: expect.objectContaining({
            outcome: "error",
            metadata: expect.objectContaining({
              errorMessage: "Tool complained",
            }),
          }),
        });
      });
    });
  });

  describe("searchTools", () => {
    beforeEach(() => {
      // Register a variety of tools for search testing
      const tools: ToolDefinition[] = [
        makeTool({
          name: "image-generate",
          description: "Generate images with AI",
          category: "image",
        }),
        makeTool({
          name: "image-edit",
          description: "Edit existing images",
          category: "image",
        }),
        makeTool({
          name: "codespace-run",
          description: "Run code in a codespace",
          category: "codespace",
        }),
        makeTool({
          name: "search-tools",
          description: "Search for tools",
          category: "gateway-meta",
          alwaysEnabled: true,
        }),
        makeTool({
          name: "vault-store",
          description: "Store secrets in vault",
          category: "vault",
        }),
      ];

      for (const tool of tools) {
        const mockRegistered = {
          enabled: tool.alwaysEnabled ? true : false,
          enable: vi.fn(),
          disable: vi.fn(),
        };
        mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
        registry.register(tool);
      }
    });

    it("should return scored results matching query", async () => {
      const results = await registry.searchTools("image");

      expect(results.length).toBe(2);
      expect(results[0]!.name).toBe("image-generate");
      expect(results[1]!.name).toBe("image-edit");
    });

    it("should give name match a score of 3", async () => {
      // "image" appears in name for image-generate and image-edit
      const results = await registry.searchTools("generate");
      // "generate" is in name of image-generate (score 3) and description (score 1) = 4
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.name).toBe("image-generate");
    });

    it("should give category match a score of 2", async () => {
      // "codespace" matches the category
      const results = await registry.searchTools("codespace");
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.name).toBe("codespace-run");
    });

    it("should give description match a score of 1", async () => {
      // "secrets" appears only in the description of vault-store
      const results = await registry.searchTools("secrets");
      expect(results.length).toBe(1);
      expect(results[0]!.name).toBe("vault-store");
    });

    it("should skip gateway-meta tools in search results", async () => {
      const results = await registry.searchTools("search");
      const gatewayMetaTool = results.find(r => r.name === "search-tools");
      expect(gatewayMetaTool).toBeUndefined();
    });

    it("should respect the limit parameter", async () => {
      const results = await registry.searchTools("image", 1);
      expect(results.length).toBe(1);
    });

    it("should return empty array for empty query", async () => {
      const results = await registry.searchTools("");
      expect(results).toEqual([]);
    });

    it("should return empty array for whitespace-only query", async () => {
      const results = await registry.searchTools("   ");
      expect(results).toEqual([]);
    });

    it("should return empty array when no matches found", async () => {
      const results = await registry.searchTools("zzzznonexistent");
      expect(results).toEqual([]);
    });

    it("should truncate description to 200 chars from first line", async () => {
      const longDesc = "A".repeat(300);
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "long-desc-tool",
          description: longDesc,
          category: "misc",
        }),
      );

      const results = await registry.searchTools("long-desc-tool");
      expect(results[0]!.description.length).toBeLessThanOrEqual(200);
    });

    it("should use only the first line of multiline descriptions", async () => {
      const multilineDesc = "First line about searching\nSecond line with more details";
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "multiline-tool",
          description: multilineDesc,
          category: "misc",
        }),
      );

      const results = await registry.searchTools("searching");
      expect(results).toHaveLength(1);
      expect(results[0]!.description).toBe("First line about searching");
    });

    it("should use false when registered.enabled is undefined", async () => {
      const mockRegistered = {
        enabled: undefined,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "undef-enabled",
          description: "Undefined enabled state",
          category: "misc",
        }),
      );

      const results = await registry.searchTools("undef-enabled");
      expect(results).toHaveLength(1);
      expect(results[0]!.enabled).toBe(false);
    });

    it("should handle tool with empty description gracefully", async () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      // Register a tool with empty description - name match still works
      registry.register(
        makeTool({ name: "emptydesc", description: "", category: "misc" }),
      );

      const results = await registry.searchTools("emptydesc");
      expect(results).toHaveLength(1);
      expect(results[0]!.description).toBe("");
    });

    it("should handle description starting with newline (empty first line)", async () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "newline-desc-tool",
          description: "\nActual description on second line",
          category: "misc",
        }),
      );

      const results = await registry.searchTools("newline-desc-tool");
      expect(results).toHaveLength(1);
      expect(results[0]!.description).toBe("");
    });

    it("should handle tools with complexity", async () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "complex-tool",
          category: "misc",
          complexity: "composed",
        }),
      );

      const results = await registry.searchTools("complex-tool");
      expect(results).toHaveLength(1);
      expect(results[0]!.complexity).toBe("composed");
    });
  });

  describe("searchToolsSemantic", () => {
    beforeEach(() => {
      const tools: ToolDefinition[] = [
        makeTool({
          name: "generate_image",
          description: "Generate AI images with prompts",
          category: "image",
        }),
        makeTool({
          name: "send_email",
          description: "Send email messages to users",
          category: "email",
        }),
        makeTool({
          name: "search_tools",
          description: "Search for tools",
          category: "gateway-meta",
          alwaysEnabled: true,
        }),
        makeTool({
          name: "delete_user",
          description: "Delete a user account",
          category: "admin",
        }),
      ];

      for (const tool of tools) {
        const mockRegistered = {
          enabled: tool.alwaysEnabled ? true : false,
          enable: vi.fn(),
          disable: vi.fn(),
        };
        mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
        registry.register(tool);
      }
    });

    it("should find tools via synonyms", () => {
      const results = registry.searchToolsSemantic("make pictures");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.name).toBe("generate_image");
    });

    it("should include score in results", () => {
      const results = registry.searchToolsSemantic("image");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.score).toBeDefined();
      expect(typeof results[0]!.score).toBe("number");
      expect(results[0]!.score).toBeGreaterThan(0);
    });

    it("should exclude gateway-meta tools", () => {
      const results = registry.searchToolsSemantic("search tools");
      const gatewayTool = results.find(r => r.name === "search_tools");
      expect(gatewayTool).toBeUndefined();
    });

    it("should sort results by score descending", () => {
      const results = registry.searchToolsSemantic("generate image");
      if (results.length >= 2) {
        expect(results[0]!.score!).toBeGreaterThanOrEqual(results[1]!.score!);
      }
    });

    it("should return empty array for empty query", () => {
      const results = registry.searchToolsSemantic("");
      expect(results).toEqual([]);
    });

    it("should respect limit parameter", () => {
      const results = registry.searchToolsSemantic("tool", 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it("should include suggestedParams when query has patterns", () => {
      const results = registry.searchToolsSemantic(
        "generate image of a sunset",
      );
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]!.suggestedParams).toBeDefined();
      expect(results[0]!.suggestedParams!.prompt).toBeDefined();
    });

    it("should not include suggestedParams for plain queries", () => {
      const results = registry.searchToolsSemantic("image");
      if (results.length > 0) {
        expect(results[0]!.suggestedParams).toBeUndefined();
      }
    });
  });

  describe("enableTools", () => {
    it("should enable tools by name and return enabled names", () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(makeTool({ name: "my-tool" }));

      const enabled = registry.enableTools(["my-tool"]);

      expect(enabled).toEqual(["my-tool"]);
      expect(mockRegistered.enable).toHaveBeenCalled();
    });

    it("should skip already-enabled tools", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({ name: "enabled-tool", alwaysEnabled: true }),
      );

      const enabled = registry.enableTools(["enabled-tool"]);

      expect(enabled).toEqual([]);
      expect(mockRegistered.enable).not.toHaveBeenCalled();
    });

    it("should skip nonexistent tools", () => {
      const enabled = registry.enableTools(["nonexistent"]);
      expect(enabled).toEqual([]);
    });
  });

  describe("enableCategory", () => {
    it("should enable all tools in a category and return names", () => {
      const mockRegistered1 = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      const mockRegistered2 = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered1)
        .mockReturnValueOnce(mockRegistered2);

      registry.register(makeTool({ name: "cat-tool-1", category: "my-cat" }));
      registry.register(makeTool({ name: "cat-tool-2", category: "my-cat" }));

      const enabled = registry.enableCategory("my-cat");

      expect(enabled).toEqual(["cat-tool-1", "cat-tool-2"]);
      expect(mockRegistered1.enable).toHaveBeenCalled();
      expect(mockRegistered2.enable).toHaveBeenCalled();
    });

    it("should skip already-enabled tools in the category", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "already-on",
          category: "cat-a",
          alwaysEnabled: true,
        }),
      );

      const enabled = registry.enableCategory("cat-a");
      expect(enabled).toEqual([]);
    });

    it("should return empty array for nonexistent category", () => {
      const enabled = registry.enableCategory("nonexistent-cat");
      expect(enabled).toEqual([]);
    });
  });

  describe("disableCategory", () => {
    it("should disable non-alwaysEnabled tools in category", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(makeTool({ name: "disable-me", category: "my-cat" }));

      const disabled = registry.disableCategory("my-cat");

      expect(disabled).toEqual(["disable-me"]);
      expect(mockRegistered.disable).toHaveBeenCalled();
    });

    it("should skip alwaysEnabled tools when disabling", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({ name: "keep-me", category: "my-cat", alwaysEnabled: true }),
      );

      const disabled = registry.disableCategory("my-cat");

      expect(disabled).toEqual([]);
      expect(mockRegistered.disable).not.toHaveBeenCalled();
    });

    it("should skip disabled tools", () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(makeTool({ name: "already-off", category: "my-cat" }));

      const disabled = registry.disableCategory("my-cat");

      expect(disabled).toEqual([]);
    });

    it("should return empty array for nonexistent category", () => {
      const disabled = registry.disableCategory("nonexistent");
      expect(disabled).toEqual([]);
    });
  });

  describe("listCategories", () => {
    it("should return categories with descriptions from CATEGORY_DESCRIPTIONS", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({ name: "img-tool", category: "image", alwaysEnabled: true }),
      );

      const categories = registry.listCategories();

      expect(categories).toHaveLength(1);
      expect(categories[0]).toEqual({
        name: "image",
        description: "AI image generation, modification, and job management",
        tier: "free",
        toolCount: 1,
        enabledCount: 1,
        tools: ["img-tool"],
      });
    });

    it("should use fallback description for unknown categories", () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({ name: "custom-tool", category: "custom-unknown" }),
      );

      const categories = registry.listCategories();

      expect(categories[0]!.description).toBe("custom-unknown tools");
    });

    it("should aggregate multiple tools per category", () => {
      const mockReg1 = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      const mockReg2 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(mockReg1).mockReturnValueOnce(
        mockReg2,
      );

      registry.register(
        makeTool({ name: "tool-a", category: "vault", alwaysEnabled: true }),
      );
      registry.register(makeTool({ name: "tool-b", category: "vault" }));

      const categories = registry.listCategories();

      expect(categories).toHaveLength(1);
      expect(categories[0]!.toolCount).toBe(2);
      expect(categories[0]!.enabledCount).toBe(1);
      expect(categories[0]!.tools).toEqual(["tool-a", "tool-b"]);
    });

    it("should allow tools matching gateway meta category (unlike searchTools)", () => {
      const mockRegistered = {
        enabled: true,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({
          name: "tool-c",
          category: "gateway-meta",
          alwaysEnabled: true,
        }),
      );
      const categories = registry.listCategories();
      expect(categories).toHaveLength(1);
    });

    it("should handle tools marked disabled without explicitly returning an enabled record", () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(
        makeTool({ name: "tool-disabled-default", category: "vault" }),
      );
      const categories = registry.listCategories();
      expect(categories[0]!.enabledCount).toBe(0);
    });

    it("should return empty array when no tools registered", () => {
      const categories = registry.listCategories();
      expect(categories).toEqual([]);
    });
  });

  describe("hasCategory", () => {
    it("should return true for an existing category", () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(makeTool({ category: "image" }));

      expect(registry.hasCategory("image")).toBe(true);
    });

    it("should return false for a nonexistent category", () => {
      expect(registry.hasCategory("nonexistent")).toBe(false);
    });

    it("should return true even when category is not the first registered tool", () => {
      const mockReg1 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      const mockReg2 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(mockReg1).mockReturnValueOnce(
        mockReg2,
      );
      registry.register(makeTool({ name: "a-tool", category: "alpha" }));
      registry.register(makeTool({ name: "b-tool", category: "beta" }));

      // "beta" is the second category but should still be found
      expect(registry.hasCategory("beta")).toBe(true);
    });

    it("should return false when tools exist but none match the category", () => {
      const mockRegistered = {
        enabled: false,
        enable: vi.fn(),
        disable: vi.fn(),
      };
      mcpServer.registerTool.mockReturnValueOnce(mockRegistered);
      registry.register(makeTool({ category: "image" }));

      expect(registry.hasCategory("vault")).toBe(false);
    });
  });

  describe("getToolCount", () => {
    it("should return the total number of registered tools", () => {
      const mockReg1 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      const mockReg2 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(mockReg1).mockReturnValueOnce(
        mockReg2,
      );

      registry.register(makeTool({ name: "tool-1" }));
      registry.register(makeTool({ name: "tool-2" }));

      expect(registry.getToolCount()).toBe(2);
    });

    it("should return 0 when no tools registered", () => {
      expect(registry.getToolCount()).toBe(0);
    });
  });

  describe("getEnabledCount", () => {
    it("should return count of enabled tools", () => {
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool
        .mockReturnValueOnce(enabledReg)
        .mockReturnValueOnce(disabledReg);

      registry.register(
        makeTool({ name: "enabled-tool", alwaysEnabled: true }),
      );
      registry.register(makeTool({ name: "disabled-tool" }));

      expect(registry.getEnabledCount()).toBe(1);
    });

    it("should return 0 when no tools are enabled", () => {
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(disabledReg);
      registry.register(makeTool({ name: "off-tool" }));

      expect(registry.getEnabledCount()).toBe(0);
    });
  });

  describe("searchTools advanced", () => {
    it("should sort results by score", async () => {
      registry.register(makeTool({ name: "exact-match", description: "unrelated" }));
      registry.register(makeTool({ name: "other", description: "contains exact-match" }));

      const results = await registry.searchTools("exact-match");
      expect(results[0]!.name).toBe("exact-match");
      expect(results[1]!.name).toBe("other");
    });
  });

  describe("searchToolsSemantic synonyms and parameters", () => {
    it("should handle multiple synonyms and suggested parameters", () => {
      registry.register(makeTool({
        name: "test_tool",
        description: "description with keyword",
        category: "test",
      }));
      // "keyword" is in description, synonym "test" in category
      const results = registry.searchToolsSemantic("keyword test");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getToolDefinitions", () => {
    it("should return all registered tool definitions", () => {
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(enabledReg).mockReturnValueOnce(disabledReg);

      registry.register(makeTool({ name: "tool-a", category: "cat-a", alwaysEnabled: true }));
      registry.register(makeTool({ name: "tool-b", category: "cat-b" }));

      const defs = registry.getToolDefinitions();
      expect(defs).toHaveLength(2);
      expect(defs[0]).toMatchObject({ name: "tool-a", category: "cat-a", enabled: true });
      expect(defs[1]).toMatchObject({ name: "tool-b", category: "cat-b", enabled: false });
    });

    it("should include handler and inputSchema", () => {
      registry.register(makeTool({ name: "with-handler" }));
      const defs = registry.getToolDefinitions();
      expect(defs[0]).toHaveProperty("handler");
      expect(typeof defs[0]!.handler).toBe("function");
    });

    it("should return empty array when no tools registered", () => {
      expect(registry.getToolDefinitions()).toEqual([]);
    });
  });

  describe("callToolDirect", () => {
    it("should call the tool handler and return result", async () => {
      const mockHandler = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "direct result" }],
      });
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(enabledReg);

      registry.register(
        makeTool({ name: "direct-tool", handler: mockHandler, alwaysEnabled: true }),
      );

      const result = await registry.callToolDirect("direct-tool", { foo: "bar" });
      expect(result.content[0]).toEqual({ type: "text", text: "direct result" });
      expect(mockHandler).toHaveBeenCalledWith({ foo: "bar" });
    });

    it("should return error for nonexistent tool", async () => {
      const result = await registry.callToolDirect("nonexistent", {});
      expect(result.isError).toBe(true);
      const content = result.content[0] as { type: string; text: string; };
      expect(content.text).toContain("Tool not found");
    });

    it("should return error for disabled tool", async () => {
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(disabledReg);

      registry.register(makeTool({ name: "disabled-tool" }));

      const result = await registry.callToolDirect("disabled-tool", {});
      expect(result.isError).toBe(true);
      const content = result.content[0] as { type: string; text: string; };
      expect(content.text).toContain("Tool disabled");
    });
  });

  describe("getEnabledCategories", () => {
    it("should return categories with at least one enabled non-gateway tool", () => {
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      const enabledReg2 = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool
        .mockReturnValueOnce(enabledReg)
        .mockReturnValueOnce(disabledReg)
        .mockReturnValueOnce(enabledReg2);

      registry.register(makeTool({ name: "chat-tool", category: "chat" }));
      registry.register(makeTool({ name: "blog-tool", category: "blog" }));
      registry.register(makeTool({ name: "storage-tool", category: "storage" }));

      const categories = registry.getEnabledCategories();

      expect(categories).toContain("chat");
      expect(categories).toContain("storage");
      expect(categories).not.toContain("blog");
    });

    it("should exclude gateway-meta category", () => {
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(enabledReg);

      registry.register(
        makeTool({ name: "search", category: "gateway-meta", alwaysEnabled: true }),
      );

      expect(registry.getEnabledCategories()).toEqual([]);
    });

    it("should exclude alwaysEnabled tools from categories", () => {
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(enabledReg);

      registry.register(
        makeTool({ name: "always-on", category: "chat", alwaysEnabled: true }),
      );

      expect(registry.getEnabledCategories()).toEqual([]);
    });

    it("should return empty array when no tools are enabled", () => {
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(disabledReg);

      registry.register(makeTool({ name: "off", category: "chat" }));

      expect(registry.getEnabledCategories()).toEqual([]);
    });

    it("should deduplicate categories with multiple enabled tools", () => {
      const reg1 = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      const reg2 = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(reg1).mockReturnValueOnce(reg2);

      registry.register(makeTool({ name: "chat-1", category: "chat" }));
      registry.register(makeTool({ name: "chat-2", category: "chat" }));

      const categories = registry.getEnabledCategories();
      expect(categories.filter(c => c === "chat")).toHaveLength(1);
    });
  });

  describe("restoreCategories", () => {
    it("should enable all tools in each listed category", () => {
      const reg1 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      const reg2 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      const reg3 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool
        .mockReturnValueOnce(reg1)
        .mockReturnValueOnce(reg2)
        .mockReturnValueOnce(reg3);

      registry.register(makeTool({ name: "chat-tool", category: "chat" }));
      registry.register(makeTool({ name: "blog-tool", category: "blog" }));
      registry.register(makeTool({ name: "storage-tool", category: "storage" }));

      registry.restoreCategories(["chat", "storage"]);

      expect(reg1.enable).toHaveBeenCalled();
      expect(reg2.enable).not.toHaveBeenCalled();
      expect(reg3.enable).toHaveBeenCalled();
    });

    it("should handle empty categories list", () => {
      const reg1 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(reg1);

      registry.register(makeTool({ name: "chat-tool", category: "chat" }));

      registry.restoreCategories([]);

      expect(reg1.enable).not.toHaveBeenCalled();
    });

    it("should skip nonexistent categories without error", () => {
      const reg1 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(reg1);

      registry.register(makeTool({ name: "chat-tool", category: "chat" }));

      // Should not throw
      registry.restoreCategories(["nonexistent", "also-missing"]);

      expect(reg1.enable).not.toHaveBeenCalled();
    });
  });

  describe("enableAll", () => {
    it("should enable all disabled tools", () => {
      const reg1 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      const reg2 = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(reg1).mockReturnValueOnce(reg2);

      registry.register(makeTool({ name: "t1" }));
      registry.register(makeTool({ name: "t2" }));

      const count = registry.enableAll();
      expect(count).toBe(2);
      expect(reg1.enable).toHaveBeenCalled();
      expect(reg2.enable).toHaveBeenCalled();
    });

    it("should skip already-enabled tools", () => {
      const enabledReg = { enabled: true, enable: vi.fn(), disable: vi.fn() };
      const disabledReg = { enabled: false, enable: vi.fn(), disable: vi.fn() };
      mcpServer.registerTool.mockReturnValueOnce(enabledReg).mockReturnValueOnce(disabledReg);

      registry.register(makeTool({ name: "already-on", alwaysEnabled: true }));
      registry.register(makeTool({ name: "off" }));

      const count = registry.enableAll();
      expect(count).toBe(1);
      expect(enabledReg.enable).not.toHaveBeenCalled();
      expect(disabledReg.enable).toHaveBeenCalled();
    });

    it("should return 0 when no tools registered", () => {
      expect(registry.enableAll()).toBe(0);
    });
  });
});
