import type { ICodeSession } from "@spike-land-ai/code";
import { applySessionDelta, computeSessionHash } from "@spike-land-ai/code";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Code } from "../../src/spike-land-backend/chatRoom";
import { WebSocketHandler } from "../../src/spike-land-backend/websocketHandler";
import type { WsAttachment } from "../../src/spike-land-backend/websocketHandler";

vi.mock("@spike-land-ai/code", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@spike-land-ai/code")>();
  return {
    ...actual,
    applySessionDelta: vi.fn(actual.applySessionDelta),
  };
});

function createMockWebSocket(overrides: Partial<WebSocket> = {}): WebSocket {
  return {
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    binaryType: "blob" as BinaryType,
    bufferedAmount: 0,
    extensions: "",
    onclose: null,
    onerror: null,
    onmessage: null,
    onopen: null,
    protocol: "",
    url: "ws://localhost",
    CLOSED: 3,
    CLOSING: 2,
    CONNECTING: 0,
    OPEN: 1,
    serializeAttachment: vi.fn(),
    deserializeAttachment: vi.fn().mockReturnValue({
      name: null,
      subscribedTopics: [],
      blockedMessages: [],
      swarmAgent: null,
    } as WsAttachment),
    ...overrides,
  } as unknown as WebSocket;
}

describe("WebSocketHandler", () => {
  let wsHandler: WebSocketHandler;
  let mockCode: Partial<Code>;
  let mockState: { getWebSockets: ReturnType<typeof vi.fn> };
  let allSockets: WebSocket[];

  const mockSession: ICodeSession = {
    code: "mock code",
    html: "mock html",
    css: "mock css",
    transpiled: "mock transpiled",
    codeSpace: "mock-code-space",
    messages: [],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    allSockets = [];

    mockState = {
      getWebSockets: vi.fn(() => allSockets),
    };

    mockCode = {
      getSession: vi.fn().mockReturnValue(mockSession),
      updateAndBroadcastSession: vi.fn(),
    };

    wsHandler = new WebSocketHandler(
      mockCode as Code,
      mockState as unknown as DurableObjectState,
    );
  });

  describe("handleMessage", () => {
    it("should handle ping messages", () => {
      const ws = createMockWebSocket();
      wsHandler.handleMessage(ws, JSON.stringify({ type: "ping" }));
      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: "pong" }));
    });

    it("should handle pong messages silently", () => {
      const ws = createMockWebSocket();
      wsHandler.handleMessage(ws, JSON.stringify({ type: "pong" }));
      expect(ws.send).not.toHaveBeenCalled();
    });

    it("should ignore malformed JSON", () => {
      const ws = createMockWebSocket();
      wsHandler.handleMessage(ws, "not json");
      expect(ws.send).not.toHaveBeenCalled();
    });

    it("should ignore non-object messages", () => {
      const ws = createMockWebSocket();
      wsHandler.handleMessage(ws, JSON.stringify([1, 2, 3]));
      expect(ws.send).not.toHaveBeenCalled();
    });

    it("should ignore binary messages", () => {
      const ws = createMockWebSocket();
      wsHandler.handleMessage(ws, new ArrayBuffer(8));
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe("subscribe/unsubscribe", () => {
    it("should handle subscribe and persist to attachment", () => {
      const ws = createMockWebSocket();
      allSockets.push(ws);

      wsHandler.handleMessage(ws, JSON.stringify({
        type: "subscribe",
        topics: ["topic1", "topic2"],
      }));

      expect(ws.serializeAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          subscribedTopics: ["topic1", "topic2"],
        }),
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"subscribe"'),
      );
    });

    it("should handle unsubscribe and persist to attachment", () => {
      const ws = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: null,
          subscribedTopics: ["topic1", "topic2"],
          blockedMessages: [],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);
      allSockets.push(ws);

      wsHandler.handleMessage(ws, JSON.stringify({
        type: "unsubscribe",
        topics: ["topic1"],
      }));

      expect(ws.serializeAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          subscribedTopics: ["topic2"],
        }),
      );
    });
  });

  describe("publish", () => {
    it("should publish to subscribed sockets", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: null,
          subscribedTopics: ["test-topic"],
          blockedMessages: [],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);
      allSockets.push(ws1, ws2);

      // Subscribe ws2 to the topic via handleMessage to set up topics map
      wsHandler.handleMessage(ws2, JSON.stringify({
        type: "subscribe",
        topics: ["test-topic"],
      }));
      (ws2.send as ReturnType<typeof vi.fn>).mockClear();

      // Publish from ws1
      wsHandler.handleMessage(ws1, JSON.stringify({
        type: "publish",
        topic: "test-topic",
        data: "hello",
      }));

      // ws2 should receive the message
      expect(ws2.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"message"'),
      );
      // ws1 should get ack
      expect(ws1.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"publish"'),
      );
    });
  });

  describe("swarm protocol", () => {
    it("should handle swarm_register", () => {
      const ws = createMockWebSocket();
      allSockets.push(ws);

      wsHandler.handleMessage(ws, JSON.stringify({
        type: "swarm_register",
        agent_id: "agent-1",
        display_name: "Agent One",
        capabilities: ["code", "review"],
      }));

      expect(ws.serializeAttachment).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "agent-1",
          swarmAgent: expect.objectContaining({
            agentId: "agent-1",
            displayName: "Agent One",
            capabilities: ["code", "review"],
          }),
        }),
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"swarm_registered"'),
      );
    });

    it("should handle swarm_list_agents", () => {
      const ws = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: "agent-1",
          subscribedTopics: [],
          blockedMessages: [],
          swarmAgent: {
            agentId: "agent-1",
            displayName: "Agent One",
            capabilities: ["code"],
            registeredAt: Date.now(),
          },
        }),
      } as unknown as Partial<WebSocket>);
      allSockets.push(ws);

      const queryer = createMockWebSocket();
      wsHandler.handleMessage(queryer, JSON.stringify({
        type: "swarm_list_agents",
      }));

      expect(queryer.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"swarm_agents_list"'),
      );
    });
  });

  describe("patch messages", () => {
    it("should handle valid patch with matching hash", async () => {
      const validHash = computeSessionHash(mockSession);
      const ws = createMockWebSocket();

      vi.mocked(applySessionDelta).mockReturnValue({
        code: "patched code",
        html: "patched html",
        css: "patched css",
      } as ReturnType<typeof applySessionDelta>);

      mockCode.updateAndBroadcastSession = vi.fn().mockResolvedValue(undefined);

      wsHandler.handleMessage(ws, JSON.stringify({
        oldHash: validHash,
        patch: ["test patch"],
      }));

      // Wait for async processing
      await vi.waitFor(() => {
        expect(mockCode.updateAndBroadcastSession).toHaveBeenCalled();
      });
    });

    it("should reject patch with mismatched hash", () => {
      const ws = createMockWebSocket();
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      wsHandler.handleMessage(ws, JSON.stringify({
        oldHash: "wrong-hash",
        patch: ["test patch"],
      }));

      expect(consoleError).toHaveBeenCalledWith("Hash mismatch");
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining("Session hash mismatch"),
      );

      consoleError.mockRestore();
    });
  });

  describe("name identification and blocked messages", () => {
    it("should update name in attachment", () => {
      const ws = createMockWebSocket();
      allSockets.push(ws);

      wsHandler.handleMessage(ws, JSON.stringify({ name: "testUser" }));

      expect(ws.serializeAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ name: "testUser" }),
      );
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"action":"nameUpdate"'),
      );
    });

    it("should deliver blocked messages when name matches", () => {
      const blockedPayload = { type: "swarm_message", content: "queued" };
      const otherWs = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: "testUser",
          subscribedTopics: [],
          blockedMessages: [blockedPayload],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);

      const ws = createMockWebSocket();
      allSockets.push(ws, otherWs);

      wsHandler.handleMessage(ws, JSON.stringify({ name: "testUser" }));

      // Should deliver the blocked message to the new socket
      expect(ws.send).toHaveBeenCalledWith(
        expect.stringContaining('"swarm_message"'),
      );
      // Should clear blocked messages on the other socket
      expect(otherWs.serializeAttachment).toHaveBeenCalledWith(
        expect.objectContaining({ blockedMessages: [] }),
      );
    });
  });

  describe("user-to-user messages", () => {
    it("should route messages to target by name", () => {
      const targetWs = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: "otherUser",
          subscribedTopics: [],
          blockedMessages: [],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);
      const senderWs = createMockWebSocket();
      allSockets.push(senderWs, targetWs);

      wsHandler.handleMessage(senderWs, JSON.stringify({
        target: "otherUser",
        type: "video-offer",
        offer: "test offer",
      }));

      expect(targetWs.send).toHaveBeenCalled();
    });
  });

  describe("broadcast", () => {
    it("should broadcast message to all sockets", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      allSockets.push(ws1, ws2);

      wsHandler.broadcast("test broadcast");

      expect(ws1.send).toHaveBeenCalledWith("test broadcast");
      expect(ws2.send).toHaveBeenCalledWith("test broadcast");
    });

    it("should exclude specified socket from broadcast", () => {
      const ws1 = createMockWebSocket();
      const ws2 = createMockWebSocket();
      allSockets.push(ws1, ws2);

      wsHandler.broadcast("test broadcast", ws1);

      expect(ws1.send).not.toHaveBeenCalled();
      expect(ws2.send).toHaveBeenCalledWith("test broadcast");
    });

    it("should handle broadcast errors gracefully", () => {
      const ws1 = createMockWebSocket({
        send: vi.fn().mockImplementation(() => {
          throw new Error("Send failed");
        }),
      });
      allSockets.push(ws1);

      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

      wsHandler.broadcast("test message");

      expect(consoleError).toHaveBeenCalledWith("WebSocket send error:", expect.any(Error));
      consoleError.mockRestore();
    });
  });

  describe("handleClose", () => {
    it("should remove socket from topics", () => {
      const ws = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: null,
          subscribedTopics: ["topic1"],
          blockedMessages: [],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);
      allSockets.push(ws);

      // Subscribe first to populate topics map
      wsHandler.handleMessage(ws, JSON.stringify({
        type: "subscribe",
        topics: ["topic1"],
      }));

      wsHandler.handleClose(ws);

      // Verify topic cleanup by publishing — the closed socket shouldn't receive
      const otherWs = createMockWebSocket();
      allSockets.push(otherWs);
      wsHandler.handleMessage(otherWs, JSON.stringify({
        type: "publish",
        topic: "topic1",
        data: "test",
      }));

      // ws should not receive the published message after close
      // (send was called for the subscribe ack, but not for the publish)
      const sendCalls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const publishMessages = sendCalls.filter((call: unknown[]) =>
        typeof call[0] === "string" && call[0].includes('"type":"message"'),
      );
      expect(publishMessages).toHaveLength(0);
    });
  });

  describe("getActiveUsers", () => {
    it("should return users subscribed to codeSpace", () => {
      const ws1 = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: "alice",
          subscribedTopics: ["my-space"],
          blockedMessages: [],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);
      const ws2 = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: "bob",
          subscribedTopics: ["other-space"],
          blockedMessages: [],
          swarmAgent: null,
        }),
      } as unknown as Partial<WebSocket>);
      allSockets.push(ws1, ws2);

      const users = wsHandler.getActiveUsers("my-space");
      expect(users).toEqual(["alice"]);
    });
  });

  describe("getSwarmAgents", () => {
    it("should return registered swarm agents", () => {
      const ws = createMockWebSocket({
        deserializeAttachment: vi.fn().mockReturnValue({
          name: "agent-1",
          subscribedTopics: [],
          blockedMessages: [],
          swarmAgent: {
            agentId: "agent-1",
            displayName: "Agent One",
            capabilities: ["code"],
            registeredAt: 12345,
          },
        }),
      } as unknown as Partial<WebSocket>);
      allSockets.push(ws);

      const agents = wsHandler.getSwarmAgents();
      expect(agents).toEqual([{
        agentId: "agent-1",
        displayName: "Agent One",
        capabilities: ["code"],
        online: true,
      }]);
    });
  });
});
