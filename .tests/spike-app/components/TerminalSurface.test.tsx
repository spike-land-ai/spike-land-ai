import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerminalSurface } from "@/ui/components/TerminalSurface";

describe("TerminalSurface", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "test-id" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("executes shell-style commands through MCP", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        result: {
          content: [{ type: "text", text: "navigated" }],
        },
      }),
    });

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

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [, request] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(request.body)).toMatchObject({
      params: {
        name: "web_navigate",
        arguments: { url: "https://example.com" },
      },
    });

    expect(await screen.findByText("$ open https://example.com")).toBeInTheDocument();
    expect(screen.getByText("navigated")).toBeInTheDocument();
  });
});
