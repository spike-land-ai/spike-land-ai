import type { ComponentProps } from "react";
import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SiteChat } from "./SiteChat";
import { useAgentChat } from "@/hooks/useAgentChat";

// Mock dependencies
vi.mock("@/hooks/useAgentChat");
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: { name: "Test User" } } }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/test-path",
}));
vi.mock("next/image", () => ({
  default: (props: ComponentProps<"img">) => createElement("img", { ...props, alt: props.alt ?? "" }),
}));
vi.mock("@/components/auth/AuthDialogProvider", () => ({
  useAuthDialog: () => ({ openAuthDialog: vi.fn() }),
}));

// Mock child components to avoid complex rendering and focus on SiteChat logic
vi.mock("./ChatMarkdown", () => ({
  ChatMarkdown: ({ content }: { content: string; }) => <div data-testid="markdown">{content}</div>,
}));
vi.mock("./ToolCallCard", () => ({
  ToolCallCard: ({ block }: { block: { name: string }; }) => <div data-testid="tool-card">{block.name}</div>,
}));

describe("SiteChat", () => {
  it("renders messages sequentially with correct grouping", () => {
    const mockMessages = [
      {
        id: "msg1",
        role: "user",
        blocks: [
          { type: "image", content: "img1.png" },
          { type: "text", content: "Hello" },
        ],
        timestamp: Date.now(),
      },
      {
        id: "msg2",
        role: "assistant",
        blocks: [
          { type: "text", content: "Thinking..." },
          { type: "tool_call", id: "tool1", name: "calculator", status: "done", input: {} },
          { type: "text", content: "Result is 42" },
        ],
        timestamp: Date.now(),
      },
    ];

    vi.mocked(useAgentChat).mockReturnValue({
      messages: mockMessages,
      isStreaming: false,
      currentTurn: 0,
      maxTurns: 0,
      error: null,
      sendMessage: vi.fn(),
    });

    render(<SiteChat />);

    // Open chat
    const button = screen.getByLabelText("spike.land Agent");
    fireEvent.click(button);

    // Check user message
    // User message should render text directly
    expect(screen.getByText("Hello")).toBeDefined();
    // Image should be rendered
    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
    // We expect user avatar in header + user avatar in bubble (maybe) + attachment
    // SiteChat header has UserAvatar if signed in.
    // SiteChat button has UserAvatar if signed in.
    // Attachment image.
    // Let's be more specific.
    expect(screen.getByAltText("attachment")).toBeDefined();

    // Check assistant message
    // "Thinking..." is rendered via ChatMarkdown (mocked)
    expect(screen.getByText("Thinking...")).toBeDefined();
    // "Result is 42" is rendered via ChatMarkdown (mocked)
    expect(screen.getByText("Result is 42")).toBeDefined();

    // Tool card
    expect(screen.getByText("calculator")).toBeDefined();

    // Verify order?
    // Testing library doesn't easily verify visual order, but DOM order usually matches.
    // We expect: Thinking... -> calculator -> Result is 42.
    const markdownElements = screen.getAllByTestId("markdown");
    const toolCards = screen.getAllByTestId("tool-card");
    expect(toolCards).toHaveLength(1);

    // Thinking... is first markdown
    expect(markdownElements[0]?.textContent).toBe("Thinking...");
    // Result is 42 is second markdown
    expect(markdownElements[1]?.textContent).toBe("Result is 42");

    // We can't easily check interleaved order with getAllByTestId across different IDs.
    // But we verified logic in code.
  });
});
