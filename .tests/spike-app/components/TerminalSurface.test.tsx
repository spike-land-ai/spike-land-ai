import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalSurface } from "@/ui/components/TerminalSurface";
import { resetMcpSession } from "@/core-logic/mcp-client";

describe("TerminalSurface", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: () => "test-id" });
    // Reset MCP session state so each test starts fresh
    resetMcpSession();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    resetMcpSession();
  });

  it("executes shell-style commands through MCP", async () => {
    // The MCP client performs a 3-step handshake before any tool call:
    //   1. POST /mcp with method "initialize" → returns Mcp-Session-Id header
    //   2. POST /mcp with method "notifications/initialized"
    //   3. POST /mcp with method "tools/call" (the actual tool invocation)
    const sessionIdHeader = new Headers({ "Mcp-Session-Id": "session-123" });

    fetchMock
      // Step 1: initialize
      .mockResolvedValueOnce({
        ok: true,
        headers: sessionIdHeader,
        text: async () =>
          JSON.stringify({ jsonrpc: "2.0", id: "test-id", result: { capabilities: {} } }),
      })
      // Step 2: notifications/initialized
      .mockResolvedValueOnce({ ok: true, text: async () => "" })
      // Step 3: tools/call
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        text: async () =>
          JSON.stringify({
            jsonrpc: "2.0",
            id: "test-id",
            result: { content: [{ type: "text", text: "navigated" }] },
          }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <TerminalSurface
        appSlug="qa-studio"
        availableTools={["web_navigate", "web_read", "web_click"]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("open https://spike.land"), {
      target: { value: "open https://example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Execute command" }));

    // Wait for all 3 fetch calls (initialize + notified + tool call)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));

    // The third call is the actual tool invocation
    const [, toolRequest] = fetchMock.mock.calls[2] as [string, { body: string }];
    expect(JSON.parse(toolRequest.body)).toMatchObject({
      params: {
        name: "web_navigate",
        arguments: { url: "https://example.com" },
      },
    });

    expect(await screen.findByText("$ open https://example.com")).toBeInTheDocument();
    expect(screen.getByText("navigated")).toBeInTheDocument();
  });
});
