import { describe, expect, it, vi, beforeEach } from "vitest";
import { SpacetimeServerTransport } from "./transport.js";
import { createMockClient } from "./__test-utils__/index.js";

describe("SpacetimeServerTransport", () => {
  let client: ReturnType<typeof createMockClient>;
  let transport: SpacetimeServerTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    client = createMockClient({ connected: true });
    transport = new SpacetimeServerTransport(client as any, "test-cat");
  });

  it("start() requests tools and subscribes to events", async () => {
    const onmessage = vi.fn();
    transport.onmessage = onmessage;

    await transport.start();
    
    // Advance timers for setTimeout in start()
    vi.advanceTimersByTime(20);
    
    expect(onmessage).toHaveBeenCalledWith(expect.objectContaining({
      method: "tools/list"
    }));
    expect(client.onEvent).toHaveBeenCalled();
  });

  it("send() intercepts tools/list response and registers them", async () => {
    await transport.start();
    
    await transport.send({
      jsonrpc: "2.0",
      id: "stdb-init-list",
      result: {
        tools: [{ name: "t1", description: "d1", inputSchema: {} }]
      }
    } as any);

    expect(client.registerTool).toHaveBeenCalledWith("t1", "d1", "{}", "test-cat");
  });

  it("send() completes task on tool result", async () => {
    const taskId = BigInt(1);
    // Pre-populate task in mock client
    client._mcpTasks.push({ id: taskId, toolName: "t1", status: "claimed", argumentsJson: "{}", requesterIdentity: "r", createdAt: BigInt(0) });
    
    // @ts-ignore - reaching into internals for testing
    transport.pendingTasks.set("msg-1", taskId);

    await transport.send({
      jsonrpc: "2.0",
      id: "msg-1",
      result: { ok: true }
    } as any);

    expect(client.completeMcpTask).toHaveBeenCalledWith(taskId, '{"ok":true}', undefined);
  });

  it("send() completes task on tool error", async () => {
    const taskId = BigInt(2);
    client._mcpTasks.push({ id: taskId, toolName: "t1", status: "claimed", argumentsJson: "{}", requesterIdentity: "r", createdAt: BigInt(0) });
    
    // @ts-ignore
    transport.pendingTasks.set("msg-2", taskId);

    await transport.send({
      jsonrpc: "2.0",
      id: "msg-2",
      error: { code: -32603, message: "fail" }
    } as any);

    expect(client.completeMcpTask).toHaveBeenCalledWith(taskId, undefined, '{"code":-32603,"message":"fail"}');
  });

  it("pollTasks claims and routes tasks", async () => {
    const onmessage = vi.fn();
    transport.onmessage = onmessage;

    // Register a tool so transport knows it can handle it
    // @ts-ignore
    transport.supportedTools.set("my_tool", {});

    const task = {
      id: BigInt(10),
      toolName: "my_tool",
      argumentsJson: '{"x":1}',
      status: "pending",
      requesterIdentity: "r",
      createdAt: BigInt(0)
    };
    client._mcpTasks.push(task);
    client.listMcpTasks.mockReturnValue([task]);

    // @ts-ignore - call private method
    await transport.pollTasks();

    expect(client.claimMcpTask).toHaveBeenCalledWith(BigInt(10));
    expect(onmessage).toHaveBeenCalledWith(expect.objectContaining({
      method: "tools/call",
      params: {
        name: "my_tool",
        arguments: { x: 1 }
      }
    }));
  });

  it("pollTasks handles claim failure", async () => {
    const onmessage = vi.fn();
    transport.onmessage = onmessage;
    
    // @ts-ignore
    transport.supportedTools.set("my_tool", {});
    const task = { id: BigInt(10), toolName: "my_tool", argumentsJson: "{}", requesterIdentity: "r", createdAt: BigInt(0) };
    client._mcpTasks.push(task);
    client.listMcpTasks.mockReturnValue([task]);
    
    vi.spyOn(client, "claimMcpTask").mockRejectedValue(new Error("Claim failed"));

    // @ts-ignore
    await transport.pollTasks();
    
    expect(client.claimMcpTask).toHaveBeenCalled();
    expect(onmessage).not.toHaveBeenCalled();
  });

  it("close() disconnects client", async () => {
    const onclose = vi.fn();
    transport.onclose = onclose;
    await transport.close();
    expect(client.disconnect).toHaveBeenCalled();
    expect(onclose).toHaveBeenCalled();
  });
});
