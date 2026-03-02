import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { PlatformClient } from "../platform-client.js";

// Mock WebSocket for the underlying connection
class MockWebSocket {
  static OPEN = 1;
  readyState = MockWebSocket.OPEN;
  addEventListener = vi.fn((event, cb) => {
    if (event === 'open') setTimeout(() => cb({}), 0);
  });
  send = vi.fn();
  close = vi.fn();
}

// @ts-ignore
global.WebSocket = MockWebSocket;

describe("PlatformClient", () => {
  let client: PlatformClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new PlatformClient({
      url: "ws://test",
    });
    client.connect();
    vi.advanceTimersByTime(10);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("provides access to all tables", () => {
    const tables = [
      "user", "agent", "agentMessage", "album", "albumImage", "app",
      "appMessage", "appVersion", "codeSession", "credits", "directMessage",
      "enhancementJob", "generationJob", "healthCheck", "image", "mcpTask",
      "oauthLink", "page", "pageBlock", "pipeline", "platformEvent",
      "registeredTool", "subject", "toolUsage", "userToolPreference"
    ];
    for (const t of tables) {
      expect((client as any)[t]).toBeDefined();
    }
  });

  it("calls all reducer methods correctly", async () => {
    const spy = vi.spyOn(client, "callReducer").mockResolvedValue(undefined);
    
    await client.registerUser("h", "d", "e");
    expect(spy).toHaveBeenCalledWith("register_user", "h", "d", "e");

    await client.updateProfile("d", "e");
    expect(spy).toHaveBeenCalledWith("update_profile", "d", "e");

    await client.sendDm("to", "msg");
    expect(spy).toHaveBeenCalledWith("send_dm", "to", "msg");

    await client.markDmRead(1);
    expect(spy).toHaveBeenCalledWith("mark_dm_read", 1);

    await client.registerAgent("d", ["c"]);
    expect(spy).toHaveBeenCalledWith("register_agent", "d", ["c"]);

    await client.unregisterAgent();
    expect(spy).toHaveBeenCalledWith("unregister_agent");

    await client.sendAgentMessage("to", "c");
    expect(spy).toHaveBeenCalledWith("send_agent_message", "to", "c");

    await client.markAgentMessageDelivered(1);
    expect(spy).toHaveBeenCalledWith("mark_agent_message_delivered", 1);

    await client.createApp("s", "n", "d", "k");
    expect(spy).toHaveBeenCalledWith("create_app", "s", "n", "d", "k");

    await client.updateApp(1, "n", "d");
    expect(spy).toHaveBeenCalledWith("update_app", 1, "n", "d");

    await client.deleteApp(1);
    expect(spy).toHaveBeenCalledWith("delete_app", 1);

    await client.restoreApp(1);
    expect(spy).toHaveBeenCalledWith("restore_app", 1);

    await client.updateAppStatus(1, "s");
    expect(spy).toHaveBeenCalledWith("update_app_status", 1, "s");

    await client.createPage("s", "t", "d");
    expect(spy).toHaveBeenCalledWith("create_page", "s", "t", "d");

    await client.updatePage(1, "t", "d");
    expect(spy).toHaveBeenCalledWith("update_page", 1, "t", "d");

    await client.deletePage(1);
    expect(spy).toHaveBeenCalledWith("delete_page", 1);

    await client.sendAppMessage(1, "r", "c");
    expect(spy).toHaveBeenCalledWith("send_app_message", 1, "r", "c");

    await client.registerTool("n", "d", "i", "c");
    expect(spy).toHaveBeenCalledWith("register_tool", "n", "d", "i", "c");

    await client.recordPlatformEvent("s", "e", "m");
    expect(spy).toHaveBeenCalledWith("record_platform_event", "s", "e", "m");

    await client.recordHealthCheck("s", "s", 1);
    expect(spy).toHaveBeenCalledWith("record_health_check", "s", "s", 1);
  });
});
