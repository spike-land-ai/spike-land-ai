import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("browser MCP client", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "uuid-1"),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes once and reuses the session for tool calls", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", result: { serverInfo: {} }, id: "init" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Mcp-Session-Id": "session-1",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", result: { content: [] }, id: "call-1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", result: { content: [] }, id: "call-2" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { callMcpTool, resetMcpSession } = await import("@/core-logic/mcp-client");
    resetMcpSession();

    await callMcpTool("billing_list_plans", {});
    await callMcpTool("billing_list_plans", {});

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/mcp");
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      credentials: "include",
    });
    const thirdHeaders = fetchMock.mock.calls[2]?.[1]?.headers as Headers;
    expect(thirdHeaders.get("Mcp-Session-Id")).toBe("session-1");
  });

  it("reinitializes and retries when the server says the session is not initialized", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", result: { serverInfo: {} }, id: "init-1" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Mcp-Session-Id": "session-1",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32000, message: "Bad Request: Server not initialized" },
            id: "call-1",
          }),
          {
            status: 400,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jsonrpc: "2.0", result: { serverInfo: {} }, id: "init-2" }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Mcp-Session-Id": "session-2",
          },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 202 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ jsonrpc: "2.0", result: { content: [{ type: "text", text: "ok" }] }, id: "call-2" }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const { callMcpTool, resetMcpSession } = await import("@/core-logic/mcp-client");
    resetMcpSession();

    const result = (await callMcpTool("billing_list_plans", {})) as {
      content: Array<{ text?: string }>;
    };

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.content[0]?.text).toBe("ok");
    const retryHeaders = fetchMock.mock.calls[5]?.[1]?.headers as Headers;
    expect(retryHeaders.get("Mcp-Session-Id")).toBe("session-2");
  });
});
