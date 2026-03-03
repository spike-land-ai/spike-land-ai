import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    toolInvocation: { create: vi.fn() },
  },
}));

vi.mock("@/lib/ai/claude-client", () => ({
  getClaudeClient: vi.fn().mockResolvedValue({
    messages: {
      create: mockCreate,
    },
  }),
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerChatTools } from "./chat";

describe("chat tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerChatTools(registry, userId);
  });

  it("should register 1 chat tool", () => {
    expect(registry.register).toHaveBeenCalledTimes(1);
  });

  describe("chat_send_message", () => {
    it("should send a message and return AI response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Hello from Claude!" }],
        usage: { input_tokens: 10, output_tokens: 20 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({ message: "Hi there", model: "sonnet" });
      expect(getText(result)).toContain("AI Response");
      expect(getText(result)).toContain("Hello from Claude!");
      expect(getText(result)).toContain("sonnet");
      expect(getText(result)).toContain("10 in / 20 out");
    });

    it("should use default model (sonnet) when not specified", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Default model response" }],
        usage: { input_tokens: 5, output_tokens: 15 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({ message: "Test message" });
      expect(getText(result)).toContain("AI Response");
      expect(getText(result)).toContain("Default model response");
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: "claude-4-6-sonnet",
      }));
    });

    it("should use opus model when specified", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Opus response" }],
        usage: { input_tokens: 8, output_tokens: 25 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({ message: "Use opus", model: "opus" });
      expect(getText(result)).toContain("opus");
      expect(getText(result)).toContain("Opus response");
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: "claude-4-6-opus",
      }));
    });

    it("should use haiku model when specified", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Haiku response" }],
        usage: { input_tokens: 3, output_tokens: 10 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({ message: "Use haiku", model: "haiku" });
      expect(getText(result)).toContain("haiku");
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: "claude-4-5-haiku",
      }));
    });

    it("should include system prompt when provided", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "System-aware response" }],
        usage: { input_tokens: 12, output_tokens: 30 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      await handler({
        message: "Hello",
        model: "sonnet",
        system_prompt: "You are a pirate",
      });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        system: "You are a pirate",
      }));
    });

    it("should not include system field when system_prompt is not provided", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "No system" }],
        usage: { input_tokens: 4, output_tokens: 8 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      await handler({ message: "Hello", model: "sonnet" });
      const callArgs = mockCreate.mock.calls[0]![0] as Record<string, unknown>;
      expect(callArgs).not.toHaveProperty("system");
    });

    it("should join multiple text content blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: "text", text: "Part one." },
          { type: "text", text: "Part two." },
        ],
        usage: { input_tokens: 6, output_tokens: 12 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({ message: "Multi-block", model: "sonnet" });
      expect(getText(result)).toContain("Part one.\nPart two.");
    });

    it("should skip non-text content blocks", async () => {
      mockCreate.mockResolvedValue({
        content: [
          { type: "text", text: "Text block." },
          { type: "tool_use", id: "tool1", name: "some_tool", input: {} },
        ],
        usage: { input_tokens: 6, output_tokens: 12 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({
        message: "Mixed blocks",
        model: "sonnet",
      });
      expect(getText(result)).toContain("Text block.");
      expect(getText(result)).not.toContain("tool_use");
    });

    it("should fall back to sonnet model for invalid model name", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "Fallback response" }],
        usage: { input_tokens: 5, output_tokens: 10 },
      });
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({
        message: "Test fallback",
        model: "nonexistent",
      });
      expect(getText(result)).toContain("Fallback response");
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: "claude-4-6-sonnet",
      }));
    });

    it("should handle API errors gracefully via safeToolCall", async () => {
      mockCreate.mockRejectedValue(new Error("rate limit exceeded"));
      const handler = registry.handlers.get("chat_send_message")!;
      const result = await handler({ message: "Fail", model: "sonnet" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("rate limit");
    });
  });
});
