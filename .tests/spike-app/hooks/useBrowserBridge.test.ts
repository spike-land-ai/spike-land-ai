import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBrowserBridge } from "@/ui/hooks/useBrowserBridge";
import type { ConversationItem } from "@/ui/hooks/useChat";

function makeToolCallItem(
  overrides: Partial<Extract<ConversationItem, { kind: "tool_call" }>> = {},
): Extract<ConversationItem, { kind: "tool_call" }> {
  return {
    id: "item-1",
    kind: "tool_call",
    toolCallId: "tool-1",
    name: "browser_screenshot",
    args: {},
    status: "pending",
    transport: "browser",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("useBrowserBridge", () => {
  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockRouter.navigate.mockClear();
  });

  it("navigates internally using router for paths starting with /", () => {
    const onResult = vi.fn();
    const items = [
      makeToolCallItem({
        toolCallId: "req-1",
        name: "browser_navigate",
        args: { url: "/tools" },
      }),
    ];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    expect(mockRouter.navigate).toHaveBeenCalledWith({ to: "/tools" });
  });

  it("navigates to section name by prepending /", () => {
    const onResult = vi.fn();
    const items = [
      makeToolCallItem({
        toolCallId: "req-2",
        name: "browser_navigate",
        args: { url: "store" },
      }),
    ];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    expect(mockRouter.navigate).toHaveBeenCalledWith({ to: "/store" });
  });

  it("opens external URLs in new tab", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    const onResult = vi.fn();
    const items = [
      makeToolCallItem({
        toolCallId: "req-3",
        name: "browser_navigate",
        args: { url: "https://example.com" },
      }),
    ];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    expect(openSpy).toHaveBeenCalledWith("https://example.com", "_blank");
    expect(mockRouter.navigate).not.toHaveBeenCalled();
  });

  it("executes browser_click on matching element", async () => {
    const div = document.createElement("div");
    div.id = "test-btn";
    document.body.appendChild(div);

    const onResult = vi.fn();
    const items = [
      makeToolCallItem({
        toolCallId: "req-4",
        name: "browser_click",
        args: { selector: "#test-btn" },
      }),
    ];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalled();
    });

    expect(onResult).toHaveBeenCalledWith("req-4", expect.objectContaining({ success: true }));

    document.body.removeChild(div);
  });

  it("returns error for browser_click on missing element", async () => {
    const onResult = vi.fn();
    const items = [
      makeToolCallItem({
        toolCallId: "req-5",
        name: "browser_click",
        args: { selector: "#nonexistent" },
      }),
    ];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalled();
    });

    expect(onResult).toHaveBeenCalledWith(
      "req-5",
      expect.objectContaining({ success: false, error: expect.stringContaining("target not found") }),
    );
  });

  it("executes browser_read_text on body by default", async () => {
    const onResult = vi.fn();
    const items = [makeToolCallItem({ toolCallId: "req-7", name: "browser_read_text" })];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalled();
    });

    expect(onResult).toHaveBeenCalledWith(
      "req-7",
      expect.objectContaining({ success: true, text: expect.any(String) }),
    );
  });

  it("does not process the same command twice (deduplication)", async () => {
    const onResult = vi.fn();
    const items = [makeToolCallItem({ toolCallId: "req-8", name: "browser_screenshot" })];

    const { rerender } = renderHook(
      ({ currentItems }) =>
        useBrowserBridge({ items: currentItems, onResult, router: mockRouter as never }),
      { initialProps: { currentItems: items } },
    );

    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalledTimes(1);
    });

    rerender({ currentItems: [...items] });

    await new Promise((r) => setTimeout(r, 50));
    expect(onResult).toHaveBeenCalledTimes(1);
  });

  it("returns error for unknown browser tool", async () => {
    const onResult = vi.fn();
    const items = [makeToolCallItem({ toolCallId: "req-10", name: "browser_unknown" })];

    renderHook(() => useBrowserBridge({ items, onResult, router: mockRouter as never }));

    await vi.waitFor(() => {
      expect(onResult).toHaveBeenCalled();
    });

    expect(onResult).toHaveBeenCalledWith(
      "req-10",
      expect.objectContaining({
        success: false,
        error: expect.stringContaining("Unknown browser tool"),
      }),
    );
  });
});
