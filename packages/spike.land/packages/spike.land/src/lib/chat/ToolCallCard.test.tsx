import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ToolCallCard } from "@/components/chat/ToolCallCard";
import type { AgentContentBlock } from "@/hooks/useAgentChat";

type ToolCallBlock = Extract<AgentContentBlock, { type: "tool_call"; }>;

const baseBlock: ToolCallBlock = {
  type: "tool_call",
  id: "tc-1",
  name: "github__issue_search",
  serverName: "github",
  input: { query: "auth bug" },
  status: "running",
};

describe("ToolCallCard", () => {
  it("renders the tool name and server badge", () => {
    render(<ToolCallCard block={baseBlock} />);
    expect(screen.getByText("Issue Search")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
  });

  it("shows a spinner for running status", () => {
    const { container } = render(<ToolCallCard block={baseBlock} />);
    // The Loader2 icon has animate-spin class
    const spinner = container.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("shows a check icon for done status", () => {
    const doneBlock: ToolCallBlock = {
      ...baseBlock,
      status: "done",
      result: "Found 5 issues",
      isError: false,
    };
    const { container } = render(<ToolCallCard block={doneBlock} />);
    // CheckCircle2 renders with text-emerald-500 class
    const check = container.querySelector(".text-emerald-500");
    expect(check).toBeInTheDocument();
  });

  it("shows error styling for error status", () => {
    const errorBlock: ToolCallBlock = {
      ...baseBlock,
      status: "error",
      result: "API rate limited",
      isError: true,
    };
    const { container } = render(<ToolCallCard block={errorBlock} />);
    const errorIcon = container.querySelector(".text-red-500");
    expect(errorIcon).toBeInTheDocument();
  });

  it("expands to show input and result on click", async () => {
    const user = userEvent.setup();
    const doneBlock: ToolCallBlock = {
      ...baseBlock,
      status: "done",
      result: "Found 5 issues",
      isError: false,
    };

    render(<ToolCallCard block={doneBlock} />);

    // Click to expand
    const trigger = screen.getByRole("button");
    await user.click(trigger);

    // Input should be visible
    expect(screen.getByText("Input")).toBeInTheDocument();
    // JSON is rendered with syntax highlighting across multiple spans
    expect(screen.getByText(/query/)).toBeInTheDocument();
    expect(screen.getByText(/auth bug/)).toBeInTheDocument();

    // Result should be visible
    expect(screen.getByText("Result")).toBeInTheDocument();
    expect(screen.getByText("Found 5 issues")).toBeInTheDocument();
  });

  it("shows Error label when isError is true", async () => {
    const user = userEvent.setup();
    const errorBlock: ToolCallBlock = {
      ...baseBlock,
      status: "error",
      result: "Connection refused",
      isError: true,
    };

    render(<ToolCallCard block={errorBlock} />);
    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });
});
