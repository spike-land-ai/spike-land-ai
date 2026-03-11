import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AgentLoopContext,
  runAgentLoop,
} from "../../../../src/cli/spike-cli/core-logic/chat/loop.js";
import { AssertionRuntime } from "../../../../src/cli/spike-cli/core-logic/chat/assertion-runtime.js";
import type { ChatClient, ContentBlock, Message } from "../../../../src/cli/spike-cli/ai/client.js";
import type {
  NamespacedTool,
  ServerManager,
} from "../../../../src/cli/spike-cli/core-logic/multiplexer/server-manager.js";

function createMockStream(content: ContentBlock[]) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  return {
    on(event: string, handler: (...args: unknown[]) => void) {
      handlers.set(event, handler);
      return this;
    },
    async finalMessage() {
      // Emit contentBlock events
      for (const block of content) {
        handlers.get("contentBlock")?.(block);
        if (block.type === "text") {
          handlers.get("text")?.(block.text);
        }
      }
      return { content };
    },
  };
}

describe("runAgentLoop", () => {
  let mockClient: ChatClient;
  let mockManager: ServerManager;
  let messages: Message[];

  const textBlock = (text: string): ContentBlock => ({
    type: "text" as const,
    text,
  });

  const toolUseBlock = (id: string, name: string, input: Record<string, unknown>): ContentBlock =>
    ({
      type: "tool_use" as const,
      id,
      name,
      input,
    }) as unknown as ContentBlock;

  beforeEach(() => {
    vi.clearAllMocks();
    messages = [];

    mockManager = {
      getAllTools: vi.fn().mockReturnValue([
        {
          namespacedName: "vitest__run_tests",
          originalName: "run_tests",
          serverName: "vitest",
          description: "Run tests",
          inputSchema: { type: "object" },
        },
      ] satisfies NamespacedTool[]),
      callTool: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "3 tests passed" }],
        isError: false,
      }),
    } as unknown as ServerManager;
  });

  function makeCtx(overrides?: Partial<AgentLoopContext>): AgentLoopContext {
    return {
      client: mockClient,
      manager: mockManager,
      messages,
      ...overrides,
    };
  }

  it("handles a single text-only response", async () => {
    const stream = createMockStream([textBlock("Hello!")]);
    mockClient = {
      createStream: vi.fn().mockReturnValue(stream),
      model: "claude-sonnet-4-6",
    } as unknown as ChatClient;

    const onTextDelta = vi.fn();
    await runAgentLoop("hi", makeCtx({ onTextDelta }));

    expect(messages).toHaveLength(2); // user + assistant
    expect(messages[0]).toEqual({ role: "user", content: "hi" });
    expect(onTextDelta).toHaveBeenCalledWith("Hello!");
  });

  it("handles tool_use → tool_result → text response", async () => {
    // First call returns tool_use, second returns text
    const stream1 = createMockStream([toolUseBlock("t1", "vitest__run_tests", { filter: "*.ts" })]);
    const stream2 = createMockStream([textBlock("All tests passed!")]);

    mockClient = {
      createStream: vi.fn().mockReturnValueOnce(stream1).mockReturnValueOnce(stream2),
      model: "claude-sonnet-4-6",
    } as unknown as ChatClient;

    const onToolCall = vi.fn();
    await runAgentLoop("run tests", makeCtx({ onToolCall }));

    // Should have: user, assistant (tool_use), user (tool_result), assistant (text)
    expect(messages).toHaveLength(4);
    expect(onToolCall).toHaveBeenCalledWith("vitest__run_tests");
    expect(mockManager.callTool).toHaveBeenCalledWith("vitest__run_tests", {
      filter: "*.ts",
    });
  });

  it("respects maxTurns limit", async () => {
    // Always return tool_use to force looping
    const makeToolStream = () => createMockStream([toolUseBlock("t1", "vitest__run_tests", {})]);

    mockClient = {
      createStream: vi.fn().mockImplementation(() => makeToolStream()),
      model: "claude-sonnet-4-6",
    } as unknown as ChatClient;

    const onTextDelta = vi.fn();
    await runAgentLoop("loop forever", makeCtx({ maxTurns: 3, onTextDelta }));

    // createStream called 3 times (maxTurns)
    expect(mockClient.createStream).toHaveBeenCalledTimes(3);
    expect(onTextDelta).toHaveBeenCalledWith("\n[Reached maximum turns]\n");
  });

  it("handles tool execution errors gracefully", async () => {
    (mockManager.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Server disconnected"),
    );

    const stream1 = createMockStream([toolUseBlock("t1", "vitest__run_tests", {})]);
    const stream2 = createMockStream([textBlock("I see the tool failed.")]);

    mockClient = {
      createStream: vi.fn().mockReturnValueOnce(stream1).mockReturnValueOnce(stream2),
      model: "claude-sonnet-4-6",
    } as unknown as ChatClient;

    await runAgentLoop("run tests", makeCtx());

    // Tool result should have isError
    const toolResultMsg = messages[2];
    expect(toolResultMsg.role).toBe("user");
    const content = toolResultMsg.content as Array<{ type: string; is_error?: boolean }>;
    expect(content[0].is_error).toBe(true);
  });

  it("resolveServerName returns 'unknown' when tool is not in getAllTools (line 105 ?? branch)", async () => {
    // Manager returns no matching tool — resolveServerName falls to ?? "unknown"
    (mockManager.getAllTools as ReturnType<typeof vi.fn>).mockReturnValue([]);

    const onToolCallStart = vi.fn();
    const stream1 = createMockStream([toolUseBlock("t1", "unknown__mystery_tool", {})]);
    const stream2 = createMockStream([textBlock("done")]);

    mockClient = {
      createStream: vi.fn().mockReturnValueOnce(stream1).mockReturnValueOnce(stream2),
      model: "claude-sonnet-4-6",
    } as unknown as ChatClient;

    await runAgentLoop("run", makeCtx({ onToolCallStart }));

    // onToolCallStart should have been called with serverName = "unknown"
    expect(onToolCallStart).toHaveBeenCalledWith("t1", "unknown__mystery_tool", "unknown", {});
  });

  it("strips assertion metadata from tool input and records evidence", async () => {
    const runtime = new AssertionRuntime();
    runtime.setCanonicalCore("- tool execution must remain anchored to source logic");
    const assertionId = runtime.getAssertions()[0]?.id;
    if (!assertionId) {
      throw new Error("Expected extracted assertion");
    }

    const stream1 = createMockStream([
      toolUseBlock("t1", "vitest__run_tests", {
        __assertion_ids: [assertionId],
        filter: "*.ts",
      }),
    ]);
    const stream2 = createMockStream([textBlock("All tests passed!")]);

    mockClient = {
      createStream: vi.fn().mockReturnValueOnce(stream1).mockReturnValueOnce(stream2),
      model: "claude-sonnet-4-6",
    } as unknown as ChatClient;

    const onRunComplete = vi.fn();
    await runAgentLoop(
      "run tests",
      makeCtx({
        assertionRuntime: runtime,
        onRunComplete,
      }),
    );

    expect(mockManager.callTool).toHaveBeenCalledWith("vitest__run_tests", {
      filter: "*.ts",
    });
    expect(runtime.getAssertions()[0]?.status).toBe("satisfied");
    expect(onRunComplete).toHaveBeenCalled();
  });
});
