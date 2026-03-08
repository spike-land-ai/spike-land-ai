import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";

afterEach(() => {
  cleanup();
});
import { PixelTerminal } from "@/components/sections/PixelTerminal";
import { useTools } from "@/hooks/useTools";
import { callTool, parseToolResult } from "@/api/client";

// Mock dependencies
vi.mock("@/hooks/useTools", () => ({
  useTools: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  callTool: vi.fn(),
  parseToolResult: vi.fn(),
}));

// Mock DynamicToolForm to avoid rendering complex nested components
vi.mock("@/components/ui/DynamicToolForm", () => ({
  DynamicToolForm: ({ onSubmit, toolName }: any) => (
    <div data-testid={`mock-form-${toolName}`}>
      <button onClick={() => onSubmit({ prompt: "test prompt" })}>Submit {toolName}</button>
    </div>
  ),
}));

describe("PixelTerminal", () => {
  const mockTools = [
    { name: "test_gen", description: "Generate test image", tier: "FREE" },
    { name: "test_edit", description: "Edit test image", tier: "PRO" },
  ];

  const mockCategories = ["Generation", "Editing"];
  const mockGrouped = new Map([
    ["Generation", [mockTools[0]]],
    ["Editing", [mockTools[1]]],
  ]);
  const mockByName = new Map([
    ["test_gen", mockTools[0]],
    ["test_edit", mockTools[1]],
  ]);

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock HTML element methods not implemented in jsdom
    window.HTMLElement.prototype.scrollIntoView = vi.fn();

    vi.mocked(useTools).mockReturnValue({
      tools: mockTools,
      categories: mockCategories,
      grouped: mockGrouped,
      byName: mockByName,
      loading: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it("renders the welcome message initially", () => {
    render(<PixelTerminal />);
    expect(screen.getByText(/for commands, or enter a tool name to get started/)).toBeInTheDocument();
  });

  it("handles the 'help' command", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "help{Enter}");

    expect(screen.getByText("Available commands:")).toBeInTheDocument();
    expect(screen.getByText("Show this help message")).toBeInTheDocument();
  });

  it("handles the 'clear' command", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");

    // First, run a command to add output
    await user.type(input, "help{Enter}");
    expect(screen.getByText("Available commands:")).toBeInTheDocument();

    // Now clear
    await user.type(input, "clear{Enter}");

    // Help output should be gone, only welcome remains
    expect(screen.queryByText("Available commands:")).not.toBeInTheDocument();
    expect(screen.getByText(/for commands, or enter a tool name to get started/)).toBeInTheDocument();
  });

  it("handles the 'history' command", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "help{Enter}");
    await user.type(input, "clear{Enter}");
    await user.type(input, "history{Enter}");

    // We expect the history to contain 'clear' and 'help'
    expect(screen.getByText(/1.*clear/)).toBeInTheDocument();
    expect(screen.getByText(/2.*help/)).toBeInTheDocument();
  });

  it("handles the 'credits' command successfully", async () => {
    const user = userEvent.setup();
    const mockBalRes = { content: [{ type: "text", text: '{"remaining": 100}' }] };

    vi.mocked(callTool).mockResolvedValue(mockBalRes as any);
    vi.mocked(parseToolResult).mockReturnValue({ remaining: 100 });

    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");

    // Defer resolution to test loading state
    let resolveCredits: any;
    const creditsPromise = new Promise((resolve) => {
      resolveCredits = resolve;
    });
    vi.mocked(callTool).mockReturnValue(creditsPromise as any);

    await user.type(input, "credits{Enter}");

    expect(screen.getByText("Fetching credits...")).toBeInTheDocument();

    // Resolve the promise to finish the execution
    resolveCredits(mockBalRes);

    await waitFor(() => {
      expect(callTool).toHaveBeenCalledWith("img_credits", {});
      expect(screen.getByText('"remaining"')).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
    });
  });

  it("handles the 'credits' command error", async () => {
    const user = userEvent.setup();

    vi.mocked(callTool).mockRejectedValue(new Error("API Error"));

    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "credits{Enter}");

    await waitFor(() => {
      expect(screen.getByText(/API Error/)).toBeInTheDocument();
    });
  });

  it("handles the 'tools' command", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "tools{Enter}");

    expect(screen.getByText(/\[Generation\]/)).toBeInTheDocument();
    expect(screen.getByText(/\[Editing\]/)).toBeInTheDocument();
    expect(screen.getByText(/test_gen/)).toBeInTheDocument();
    expect(screen.getByText(/test_edit/)).toBeInTheDocument();
  });

  it("handles the 'tools <category>' command", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "tools gen{Enter}"); // Case-insensitive partial match

    expect(screen.getByText(/\[Generation\]/)).toBeInTheDocument();
    expect(screen.queryByText(/\[Editing\]/)).not.toBeInTheDocument();
  });

  it("handles unknown commands", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "unknown_cmd{Enter}");

    expect(screen.getByText(/Unknown command: "unknown_cmd"/)).toBeInTheDocument();
  });

  it("handles exact tool name execution", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");
    await user.type(input, "test_gen{Enter}");

    // Should render the mock form
    expect(screen.getByTestId("mock-form-test_gen")).toBeInTheDocument();

    // Simulate successful submission
    const mockResult = { success: true };
    vi.mocked(callTool).mockResolvedValue({} as any);
    vi.mocked(parseToolResult).mockReturnValue(mockResult);

    await user.click(screen.getByText("Submit test_gen"));

    await waitFor(() => {
      expect(callTool).toHaveBeenCalledWith("test_gen", { prompt: "test prompt" });
      expect(screen.getByText('"success"')).toBeInTheDocument();
      // Form disappears after completion
      expect(screen.queryByTestId("mock-form-test_gen")).not.toBeInTheDocument();
    });
  });

  it("supports history navigation with ArrowUp/ArrowDown", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");

    await user.type(input, "cmd1{Enter}");
    await user.type(input, "cmd2{Enter}");

    // Press ArrowUp once -> cmd2
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("cmd2");

    // Press ArrowUp again -> cmd1
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input).toHaveValue("cmd1");

    // Press ArrowDown -> cmd2
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("cmd2");

    // Press ArrowDown -> empty
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input).toHaveValue("");
  });

  it("supports Tab autocomplete for tool names", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const input = screen.getByPlaceholderText("type a command or tool name…");

    // Add another tool to test partial match
    vi.mocked(useTools).mockReturnValue({
      tools: [
        ...mockTools,
        { name: "test_generate_large", description: "", tier: "PRO" },
      ],
      categories: mockCategories,
      grouped: mockGrouped,
      byName: mockByName,
      loading: false,
    } as any);

    // Single match: 'test_edit'
    await user.type(input, "test_e");
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("test_edit");

    await user.clear(input);

    // Multiple matches: 'test_gen' and 'test_generate_large' -> common prefix is 'test_gen'
    await user.type(input, "test_g");
    fireEvent.keyDown(input, { key: "Tab" });
    expect(input).toHaveValue("test_gen");

    // Also outputs matching names
    expect(screen.getByText(/test_gen.*test_generate_large/)).toBeInTheDocument();
  });

  it("focuses input when clicking the terminal container", async () => {
    const user = userEvent.setup();
    render(<PixelTerminal />);

    const container = screen.getByRole("application");
    const input = screen.getByPlaceholderText("type a command or tool name…");

    // Blur input first
    input.blur();
    expect(document.activeElement).not.toBe(input);

    await user.click(container);

    expect(document.activeElement).toBe(input);
  });
});
