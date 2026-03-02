import { beforeEach, describe, expect, it, vi } from "vitest";
import { emitStage, generateAppDetails } from "./agent-chat-service";
import prisma from "@/lib/prisma";
import { query } from "@anthropic-ai/claude-agent-sdk";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  default: {
    app: { update: vi.fn() },
    appMessage: { create: vi.fn() },
    appCodeVersion: { create: vi.fn() },
  },
}));

vi.mock("@/lib/errors/structured-logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

vi.mock("@/lib/claude-agent/agent-env", () => ({
  agentEnv: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/upstash/client", () => ({
  enqueueMessage: vi.fn(),
  setAgentWorking: vi.fn(),
  getCodeHash: vi.fn(),
  setCodeHash: vi.fn(),
  isMcpAgentActive: vi.fn(),
}));

describe("agent-chat-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("emitStage", () => {
    it("enqueues formatted stage status", () => {
      const enqueue = vi.fn();
      const controller = { enqueue } as unknown as ReadableStreamDefaultController;
      emitStage(controller, "processing", "test-tool");

      expect(enqueue).toHaveBeenCalled();
      const callArg = enqueue.mock.calls[0]![0];
      const decoded = new TextDecoder().decode(callArg);
      expect(decoded).toContain('"stage":"processing"');
      expect(decoded).toContain('"tool":"test-tool"');
    });
  });

  describe("generateAppDetails", () => {
    it("updates app with generated name and description", async () => {
      // Mock the async generator for query result
      async function* mockResult() {
        yield {
          type: "assistant",
          message: {
            content: [
              {
                type: "text",
                text: '{"name": "Test App", "description": "A test app"}',
              },
            ],
          },
        };
      }

      vi.mocked(query).mockResolvedValue(
        mockResult() as unknown as Awaited<ReturnType<typeof query>>,
      );
      vi.mocked(prisma.app.update).mockResolvedValue(
        {} as unknown as Awaited<ReturnType<typeof prisma.app.update>>,
      );

      await generateAppDetails("app-1", "agent response", "user prompt");

      expect(query).toHaveBeenCalled();
      expect(prisma.app.update).toHaveBeenCalledWith({
        where: { id: "app-1" },
        data: { name: "Test App", description: "A test app" },
      });
    });

    it("handles invalid json gracefully", async () => {
      async function* mockResult() {
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "invalid json" }],
          },
        };
      }

      vi.mocked(query).mockResolvedValue(
        mockResult() as unknown as Awaited<ReturnType<typeof query>>,
      );
      await generateAppDetails("app-1", "agent response", "user prompt");

      expect(prisma.app.update).not.toHaveBeenCalled();
    });
  });
});
