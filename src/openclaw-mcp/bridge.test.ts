import { describe, expect, it, vi } from "vitest";
import type { GatewayTransport } from "./types.js";
import { createMcpBridge } from "./bridge.js";

function mockTransport(): GatewayTransport & {
  request: ReturnType<typeof vi.fn>;
} {
  return { request: vi.fn() };
}

describe("createMcpBridge", () => {
  it("listTools() includes built-in chat tool by default", () => {
    const transport = mockTransport();
    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    const tools = bridge.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("chat");
    expect(tools[0].description).toContain("OpenClaw");
  });

  it("loadGatewayTools() registers tools from tools.list RPC response", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      tools: [
        {
          name: "search",
          description: "Search",
          parameters: { type: "object", properties: { q: { type: "string" } } },
        },
        { name: "calc", description: "Calculate" },
      ],
      sessionKey: "agent:test:test",
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const tools = bridge.listTools();

    expect(tools).toHaveLength(3); // chat + search + calc
    expect(tools.map((t) => t.name)).toContain("search");
    expect(tools.map((t) => t.name)).toContain("calc");
  });

  it("loadGatewayTools() falls back to chat-only when tools.list throws", async () => {
    const transport = mockTransport();
    transport.request.mockRejectedValue(new Error("not available"));

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const tools = bridge.listTools();

    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("chat");
  });

  it("loadGatewayTools() is idempotent", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      tools: [{ name: "tool1" }],
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    await bridge.loadGatewayTools();

    expect(transport.request).toHaveBeenCalledTimes(1);
  });

  it('callTool("chat", ...) sends chat.send RPC and returns text', async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      message: { content: [{ type: "text", text: "Hello back!" }] },
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    const result = await bridge.callTool("chat", { message: "Hello" });

    expect(result).toEqual({
      content: [{ type: "text", text: "Hello back!" }],
    });
    expect(transport.request).toHaveBeenCalledWith(
      "chat.send",
      { sessionKey: "agent:main:main", message: "Hello" },
      { expectFinal: true },
    );
  });

  it('callTool("chat", {}) returns error when message is missing', async () => {
    const transport = mockTransport();
    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    const result = await bridge.callTool("chat", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("message is required");
  });

  it('callTool("chat", ...) passes expectFinal: true', async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      message: { content: [{ type: "text", text: "ok" }] },
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.callTool("chat", { message: "hi" });

    expect(transport.request).toHaveBeenCalledWith("chat.send", expect.any(Object), {
      expectFinal: true,
    });
  });

  it('callTool("chat", ...) uses custom session key', async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({
      message: { content: [{ type: "text", text: "ok" }] },
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.callTool("chat", {
      message: "hi",
      session: "agent:custom:session",
    });

    expect(transport.request).toHaveBeenCalledWith(
      "chat.send",
      { sessionKey: "agent:custom:session", message: "hi" },
      { expectFinal: true },
    );
  });

  it("chat RPC error returns wrapped error content", async () => {
    const transport = mockTransport();
    transport.request.mockRejectedValue(new Error("connection lost"));

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    const result = await bridge.callTool("chat", { message: "hi" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("connection lost");
  });

  it('empty chat response returns "(no response)"', async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValue({ message: { content: [] } });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    const result = await bridge.callTool("chat", { message: "hi" });

    expect(result.content[0].text).toBe("(no response)");
  });

  it("gateway tool calls tools.call with correct sessionKey/name/args", async () => {
    const transport = mockTransport();
    // First call: tools.list
    transport.request.mockResolvedValueOnce({
      tools: [{ name: "search", description: "Search" }],
      sessionKey: "agent:test:test",
    });
    // Second call: tools.call
    transport.request.mockResolvedValueOnce({
      content: [{ type: "text", text: "found 3 results" }],
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const result = await bridge.callTool("search", { q: "test" });

    expect(transport.request).toHaveBeenCalledWith("tools.call", {
      sessionKey: "agent:test:test",
      name: "search",
      args: { q: "test" },
    });
    expect(result.content[0].text).toBe("found 3 results");
  });

  it("unknown tool returns error result", async () => {
    const transport = mockTransport();
    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    const result = await bridge.callTool("nonexistent", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("Unknown tool: nonexistent");
  });

  it("image content returns [image: mime/type] text representation", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValueOnce({
      tools: [{ name: "screenshot" }],
      sessionKey: "agent:main:main",
    });
    transport.request.mockResolvedValueOnce({
      content: [{ type: "image", mimeType: "image/png" }],
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const result = await bridge.callTool("screenshot", {});

    expect(result.content[0].text).toBe("[image: image/png]");
  });

  it("handles image with base64 data", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValueOnce({ tools: [{ name: "img" }] });
    transport.request.mockResolvedValueOnce({
      content: [{ type: "image", data: "base64data", mimeType: "image/jpeg" }],
    });

    const bridge = createMcpBridge({ transport, serverInfo: { name: "t", version: "v" } });
    await bridge.loadGatewayTools();
    const result = await bridge.callTool("img", {});
    expect(result.content[0]).toEqual({
      type: "image",
      source: { type: "base64", data: "base64data", mediaType: "image/jpeg" },
    });
  });

  it("handles image with url", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValueOnce({ tools: [{ name: "img" }] });
    transport.request.mockResolvedValueOnce({
      content: [{ type: "image", url: "https://example.com/i.png" }],
    });

    const bridge = createMcpBridge({ transport, serverInfo: { name: "t", version: "v" } });
    await bridge.loadGatewayTools();
    const result = await bridge.callTool("img", {});
    expect(result.content[0]).toEqual({
      type: "image",
      source: { type: "url", url: "https://example.com/i.png" },
    });
  });

  it("tool RPC error returns wrapped error content", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValueOnce({
      tools: [{ name: "broken" }],
      sessionKey: "agent:main:main",
    });
    transport.request.mockRejectedValueOnce(new Error("tool crashed"));

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const result = await bridge.callTool("broken", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("tool crashed");
  });

  it("handles other content types via JSON.stringify", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValueOnce({ tools: [{ name: "other" }] });
    transport.request.mockResolvedValueOnce({
      content: [{ type: "unknown", data: { foo: "bar" } }],
    });

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const result = await bridge.callTool("other", {});
    expect(result.content[0].text).toContain("foo");
  });

  it("handles null/missing content in gateway tool result", async () => {
    const transport = mockTransport();
    transport.request.mockResolvedValueOnce({ tools: [{ name: "null" }] });
    transport.request.mockResolvedValueOnce({}); // missing content

    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
    });

    await bridge.loadGatewayTools();
    const result = await bridge.callTool("null", {});
    expect(result.content).toEqual([]);
  });

  it("exercises verbose logging", async () => {
    const transport = mockTransport();
    const writeSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const bridge = createMcpBridge({
      transport,
      serverInfo: { name: "test", version: "0.0.1" },
      verbose: true,
    });

    await bridge.callTool("chat", { message: "hi" });
    expect(writeSpy).toHaveBeenCalled();
    writeSpy.mockRestore();
  });

  it("serve() sets up handlers and connects transport", async () => {
    const bridge = createMcpBridge({
      transport: mockTransport(),
      serverInfo: { name: "test", version: "0.0.1" },
    });

    // Mock process.once to resolve immediately
    const onceSpy = vi.spyOn(process, "once").mockImplementation((event, cb) => {
      if (event === "SIGINT") (cb as any)();
      return process;
    });

    await bridge.serve();
    expect(onceSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
    onceSpy.mockRestore();
  });
});
