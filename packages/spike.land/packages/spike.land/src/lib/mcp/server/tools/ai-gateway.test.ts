import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---

const mockClaudeCreate = vi.hoisted(() => vi.fn());
const mockGeminiGenerate = vi.hoisted(() => vi.fn());
const mockIsClaudeConfigured = vi.hoisted(() => vi.fn());
const mockIsGeminiConfigured = vi.hoisted(() => vi.fn());
const mockResetClaude = vi.hoisted(() => vi.fn());
const mockResetGemini = vi.hoisted(() => vi.fn());
const mockGetDefault = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => ({
  aIProvider: {
    findMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  toolInvocation: {
    create: vi.fn().mockResolvedValue({}),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/ai/claude-client", () => ({
  getClaudeClient: vi.fn().mockResolvedValue({
    messages: { create: mockClaudeCreate },
  }),
  isClaudeConfigured: mockIsClaudeConfigured,
  resetClaudeClient: mockResetClaude,
}));

vi.mock("@/lib/ai/gemini-client", () => ({
  getGeminiClient: vi.fn().mockResolvedValue({
    models: { generateContent: mockGeminiGenerate },
  }),
  isGeminiConfigured: mockIsGeminiConfigured,
  resetGeminiClient: mockResetGemini,
}));

vi.mock("@/lib/ai/ai-config-resolver", () => ({
  resolveAIProviderConfig: vi.fn(),
  getDefaultAIProvider: mockGetDefault,
}));

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerAiGatewayTools } from "./ai-gateway";

describe("ai-gateway tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAiGatewayTools(registry, userId);

    // Default admin for manage tests
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
  });

  it("should register 5 ai-gateway tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
  });

  // --- ai_list_providers ---

  describe("ai_list_providers", () => {
    it("should return provider status", async () => {
      mockIsClaudeConfigured.mockResolvedValue(true);
      mockIsGeminiConfigured.mockResolvedValue(false);
      mockGetDefault.mockResolvedValue({ name: "anthropic" });
      mockPrisma.aIProvider.findMany.mockResolvedValue([
        { name: "anthropic", isDefault: true },
      ]);

      const handler = registry.handlers.get("ai_list_providers")!;
      const result = await handler({});
      const text = getText(result);
      const data = JSON.parse(text);

      expect(data.providers).toHaveLength(2);
      expect(data.providers[0].name).toBe("anthropic");
      expect(data.providers[0].status).toBe("configured");
      expect(data.providers[0].isDefault).toBe(true);
      expect(data.providers[0].source).toBe("database");
      expect(data.providers[1].name).toBe("google");
      expect(data.providers[1].status).toBe("not_configured");
    });

    it("should show env source when not in DB", async () => {
      mockIsClaudeConfigured.mockResolvedValue(true);
      mockIsGeminiConfigured.mockResolvedValue(true);
      mockGetDefault.mockResolvedValue(null);
      mockPrisma.aIProvider.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("ai_list_providers")!;
      const result = await handler({});
      const data = JSON.parse(getText(result));

      expect(data.providers[0].source).toBe("env");
      expect(data.providers[1].source).toBe("env");
    });
  });

  // --- ai_list_models ---

  describe("ai_list_models", () => {
    it("should list all models by default", async () => {
      const handler = registry.handlers.get("ai_list_models")!;
      const result = await handler({});
      const data = JSON.parse(getText(result));

      expect(data.count).toBe(6);
      expect(
        data.models.some((m: { id: string; }) => m.id === "claude-opus-4-6"),
      ).toBe(true);
      expect(
        data.models.some((m: { id: string; }) => m.id === "gemini-3-flash-preview"),
      ).toBe(true);
    });

    it("should filter by provider", async () => {
      const handler = registry.handlers.get("ai_list_models")!;
      const result = await handler({ provider: "anthropic" });
      const data = JSON.parse(getText(result));

      expect(data.count).toBe(3);
      for (const m of data.models) {
        expect(m.provider).toBe("anthropic");
      }
    });

    it("should filter by capability", async () => {
      const handler = registry.handlers.get("ai_list_models")!;
      const result = await handler({ capability: "image-gen" });
      const data = JSON.parse(getText(result));

      expect(data.count).toBe(3);
      for (const m of data.models) {
        expect(m.capabilities).toContain("image-gen");
      }
    });

    it("should filter by both provider and capability", async () => {
      const handler = registry.handlers.get("ai_list_models")!;
      const result = await handler({
        provider: "google",
        capability: "chat",
      });
      const data = JSON.parse(getText(result));

      // gemini-3-flash-preview and gemini-3-pro-image-preview have chat
      // gemini-2.5-flash-image does NOT have chat
      expect(data.count).toBe(2);
    });
  });

  // --- ai_chat ---

  describe("ai_chat", () => {
    it("should route to Anthropic by default", async () => {
      mockClaudeCreate.mockResolvedValue({
        content: [{ type: "text", text: "Hello from Claude!" }],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({ message: "Hi" });
      const data = JSON.parse(getText(result));

      expect(data.provider).toBe("anthropic");
      expect(data.response).toBe("Hello from Claude!");
      expect(data.usage.input_tokens).toBe(10);
    });

    it("should auto-detect Google from model name", async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: "Hello from Gemini!",
        usageMetadata: {
          promptTokenCount: 5,
          candidatesTokenCount: 15,
        },
      });

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({
        message: "Hi",
        model: "gemini-flash",
      });
      const data = JSON.parse(getText(result));

      expect(data.provider).toBe("google");
      expect(data.response).toBe("Hello from Gemini!");
      expect(data.usage.input_tokens).toBe(5);
    });

    it("should respect explicit provider override", async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: "Gemini response",
        usageMetadata: {
          promptTokenCount: 3,
          candidatesTokenCount: 8,
        },
      });

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({
        message: "Test",
        provider: "google",
      });
      const data = JSON.parse(getText(result));

      expect(data.provider).toBe("google");
    });

    it("should pass system_prompt to Anthropic", async () => {
      mockClaudeCreate.mockResolvedValue({
        content: [{ type: "text", text: "Pirate response" }],
        usage: { input_tokens: 8, output_tokens: 12 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      await handler({
        message: "Hi",
        system_prompt: "You are a pirate",
      });

      expect(mockClaudeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ system: "You are a pirate" }),
      );
    });

    it("should pass system_prompt to Gemini", async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: "Sys response",
        usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 6 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      await handler({
        message: "Hi",
        provider: "google",
        system_prompt: "Be concise",
      });

      expect(mockGeminiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({
            systemInstruction: "Be concise",
          }),
        }),
      );
    });

    it("should handle Anthropic API errors", async () => {
      mockClaudeCreate.mockRejectedValue(new Error("rate limit exceeded"));

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({ message: "Fail" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("rate limit");
    });

    it("should resolve model by alias for Anthropic", async () => {
      mockClaudeCreate.mockResolvedValue({
        content: [{ type: "text", text: "Opus reply" }],
        usage: { input_tokens: 5, output_tokens: 10 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({ message: "Hi", model: "opus" });
      const data = JSON.parse(getText(result));

      expect(data.model).toBe("claude-opus-4-6");
      expect(mockClaudeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ model: "claude-opus-4-6" }),
      );
    });

    it("should pass temperature to Anthropic when provided", async () => {
      mockClaudeCreate.mockResolvedValue({
        content: [{ type: "text", text: "Temp response" }],
        usage: { input_tokens: 5, output_tokens: 10 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      await handler({ message: "Hi", temperature: 0.5 });

      expect(mockClaudeCreate).toHaveBeenCalledWith(
        expect.objectContaining({ temperature: 0.5 }),
      );
    });

    it("should pass temperature to Gemini when provided", async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: "Temp response",
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      await handler({ message: "Hi", provider: "google", temperature: 1.0 });

      expect(mockGeminiGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ temperature: 1.0 }),
        }),
      );
    });

    it("should handle null response text from Gemini", async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: null,
        usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 5 },
      });

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({ message: "Hi", provider: "google" });
      const data = JSON.parse(getText(result));
      expect(data.response).toBe("");
    });

    it("should handle missing usage metadata from Gemini", async () => {
      mockGeminiGenerate.mockResolvedValue({
        text: "No usage",
        usageMetadata: undefined,
      });

      const handler = registry.handlers.get("ai_chat")!;
      const result = await handler({
        message: "Hi",
        provider: "google",
      });
      const data = JSON.parse(getText(result));

      expect(data.usage.input_tokens).toBe(0);
      expect(data.usage.output_tokens).toBe(0);
    });
  });

  // --- ai_manage_provider ---

  describe("ai_manage_provider", () => {
    it("should upsert a provider", async () => {
      mockPrisma.aIProvider.upsert.mockResolvedValue({});

      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({
        action: "upsert",
        provider_id: "anthropic",
        token: "new-token",
      });

      expect(getText(result)).toContain("upserted successfully");
      expect(mockPrisma.aIProvider.upsert).toHaveBeenCalled();
      expect(mockResetClaude).toHaveBeenCalled();
      expect(mockResetGemini).toHaveBeenCalled();
    });

    it("should upsert a provider with config", async () => {
      mockPrisma.aIProvider.upsert.mockResolvedValue({});

      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({
        action: "upsert",
        provider_id: "anthropic",
        token: "new-token",
        config: { maxTokens: 4096 },
      });

      expect(getText(result)).toContain("upserted successfully");
      expect(mockPrisma.aIProvider.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            config: { maxTokens: 4096 },
          }),
          create: expect.objectContaining({
            config: { maxTokens: 4096 },
          }),
        }),
      );
    });

    it("should delete a provider", async () => {
      mockPrisma.aIProvider.delete.mockResolvedValue({});

      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({
        action: "delete",
        provider_id: "google",
      });

      expect(getText(result)).toContain("deleted");
      expect(mockPrisma.aIProvider.delete).toHaveBeenCalledWith({
        where: { name: "google" },
      });
    });

    it("should set default provider", async () => {
      mockPrisma.aIProvider.updateMany.mockResolvedValue({});
      mockPrisma.aIProvider.update.mockResolvedValue({});

      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({
        action: "set_default",
        provider_id: "google",
      });

      expect(getText(result)).toContain("set as default");
      expect(mockPrisma.aIProvider.updateMany).toHaveBeenCalledWith({
        where: { isDefault: true },
        data: { isDefault: false },
      });
      expect(mockPrisma.aIProvider.update).toHaveBeenCalledWith({
        where: { name: "google" },
        data: { isDefault: true },
      });
    });

    it("should require admin role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });

      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({
        action: "upsert",
        provider_id: "anthropic",
        token: "t",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Admin access required");
    });

    it("should require provider_id for upsert", async () => {
      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({ action: "upsert" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("provider_id is required");
    });

    it("should require provider_id for delete", async () => {
      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({ action: "delete" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("provider_id is required");
    });

    it("should upsert a provider without token", async () => {
      mockPrisma.aIProvider.upsert.mockResolvedValue({});

      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({
        action: "upsert",
        provider_id: "anthropic",
        config: { baseUrl: "https://custom.api.com" },
      });

      expect(getText(result)).toContain("upserted successfully");
      expect(mockPrisma.aIProvider.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tokenEncrypted: null,
          }),
        }),
      );
    });

    it("should require provider_id for set_default", async () => {
      const handler = registry.handlers.get("ai_manage_provider")!;
      const result = await handler({ action: "set_default" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("provider_id is required");
    });
  });

  // --- ai_get_usage ---

  describe("ai_get_usage", () => {
    it("should return usage statistics", async () => {
      mockPrisma.toolInvocation.findMany.mockResolvedValue([
        {
          tool: "ai_chat",
          input: {},
          durationMs: 500,
          isError: false,
          createdAt: new Date(),
        },
        {
          tool: "chat_send_message",
          input: {},
          durationMs: 300,
          isError: false,
          createdAt: new Date(),
        },
        {
          tool: "ai_chat",
          input: {},
          durationMs: 200,
          isError: true,
          createdAt: new Date(),
        },
      ]);

      const handler = registry.handlers.get("ai_get_usage")!;
      const result = await handler({ days: 7 });
      const data = JSON.parse(getText(result));

      expect(data.totalInvocations).toBe(3);
      expect(data.errorCount).toBe(1);
      expect(data.avgDurationMs).toBe(333);
      expect(data.byTool.ai_chat).toBe(2);
      expect(data.byTool.chat_send_message).toBe(1);
    });

    it("should handle null durationMs in invocations", async () => {
      mockPrisma.toolInvocation.findMany.mockResolvedValue([
        {
          tool: "ai_chat",
          input: {},
          durationMs: null,
          isError: false,
          createdAt: new Date(),
        },
      ]);

      const handler = registry.handlers.get("ai_get_usage")!;
      const result = await handler({ days: 7 });
      const data = JSON.parse(getText(result));

      expect(data.totalInvocations).toBe(1);
      expect(data.avgDurationMs).toBe(0);
    });

    it("should filter by provider when specified", async () => {
      mockPrisma.toolInvocation.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("ai_get_usage")!;
      await handler({ days: 7, provider: "anthropic" });

      expect(mockPrisma.toolInvocation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            input: {
              path: ["provider"],
              equals: "anthropic",
            },
          }),
        }),
      );
    });

    it("should handle empty invocations", async () => {
      mockPrisma.toolInvocation.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("ai_get_usage")!;
      const result = await handler({});
      const data = JSON.parse(getText(result));

      expect(data.totalInvocations).toBe(0);
      expect(data.errorCount).toBe(0);
      expect(data.avgDurationMs).toBe(0);
    });
  });
});
