import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatThread, type Message } from "../ChatThread";

// Mock @spike-land-ai/shared
vi.mock("@spike-land-ai/shared", () => ({
  UI_ANIMATIONS: {
    COPY_FEEDBACK_MS: 2000,
  },
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Send: () => <svg data-testid="icon-send" />,
  Copy: () => <svg data-testid="icon-copy" />,
  Check: () => <svg data-testid="icon-check" />,
  User: () => <svg data-testid="icon-user" />,
  Bot: () => <svg data-testid="icon-bot" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

// Mock Button component
vi.mock("../../shared/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button onClick={onClick} disabled={disabled} {...rest}>
      {children}
    </button>
  ),
}));

// Mock cn utility
vi.mock("../../../styling/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

const baseMessages: Message[] = [
  { id: "1", role: "user", content: "Hello there" },
  { id: "2", role: "assistant", content: "Hi! How can I help?" },
];

describe("ChatThread", () => {
  const onSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      writable: true,
    });
  });

  it("renders the chat history log region", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    expect(screen.getByRole("log", { name: "Chat history" })).toBeInTheDocument();
  });

  it("renders empty state when there are no messages", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("renders all messages", () => {
    render(<ChatThread messages={baseMessages} onSendMessage={onSendMessage} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("renders role label for each message", () => {
    render(<ChatThread messages={baseMessages} onSendMessage={onSendMessage} />);
    // Each message displays its role as uppercase label
    const userLabels = screen.getAllByText("user");
    const assistantLabels = screen.getAllByText("assistant");
    expect(userLabels.length).toBeGreaterThan(0);
    expect(assistantLabels.length).toBeGreaterThan(0);
  });

  it("renders copy button for assistant messages", () => {
    render(<ChatThread messages={baseMessages} onSendMessage={onSendMessage} />);
    expect(screen.getByRole("button", { name: "Copy message" })).toBeInTheDocument();
  });

  it("does not render copy button for user messages", () => {
    const userOnly: Message[] = [{ id: "1", role: "user", content: "Only user msg" }];
    render(<ChatThread messages={userOnly} onSendMessage={onSendMessage} />);
    expect(screen.queryByRole("button", { name: "Copy message" })).not.toBeInTheDocument();
  });

  it("renders timestamp when provided", () => {
    const withTimestamp: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "Timed message",
        timestamp: "2025-06-15T14:30:00Z",
      },
    ];
    render(<ChatThread messages={withTimestamp} onSendMessage={onSendMessage} />);
    const expected = new Date("2025-06-15T14:30:00Z").toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it("does not render timestamp when not provided", () => {
    render(<ChatThread messages={baseMessages} onSendMessage={onSendMessage} />);
    // No time-like text visible for messages without timestamp
    expect(document.querySelector("p.mt-2.text-\\[10px\\]")).not.toBeInTheDocument();
  });

  it("renders loading indicator when isLoading is true", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} isLoading />);
    expect(screen.getByText("Assistant is thinking...")).toBeInTheDocument();
  });

  it("does not render loading indicator when isLoading is false", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} isLoading={false} />);
    expect(screen.queryByText("Assistant is thinking...")).not.toBeInTheDocument();
  });

  it("renders the message input textarea", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    expect(screen.getByRole("textbox", { name: "Chat message input" })).toBeInTheDocument();
  });

  it("renders the send button", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
  });

  it("send button is enabled when input has text", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Hello" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).not.toBeDisabled();
  });

  it("send button is disabled when isLoading is true", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} isLoading />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Hello" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    expect(sendButton).toBeDisabled();
  });

  it("calls onSendMessage and clears input when send button is clicked", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Test message" } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);
    expect(onSendMessage).toHaveBeenCalledWith("Test message");
    expect(textarea).toHaveValue("");
  });

  it("calls onSendMessage when Enter key is pressed", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Enter message" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    expect(onSendMessage).toHaveBeenCalledWith("Enter message");
  });

  it("does not call onSendMessage when Shift+Enter is pressed", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Multiline" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("trims whitespace-only input and does not send", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "   " } });
    const sendButton = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendButton);
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it("renders keyboard shortcut hint text", () => {
    render(<ChatThread messages={[]} onSendMessage={onSendMessage} />);
    expect(screen.getByText(/Press/)).toBeInTheDocument();
    expect(screen.getByText("Enter")).toBeInTheDocument();
    expect(screen.getByText("Shift+Enter")).toBeInTheDocument();
  });

  it("copy button invokes clipboard.writeText on click", () => {
    render(<ChatThread messages={baseMessages} onSendMessage={onSendMessage} />);
    const copyButton = screen.getByRole("button", { name: "Copy message" });
    fireEvent.click(copyButton);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Hi! How can I help?");
  });

  it("renders sr-only live region on assistant message for accessibility", () => {
    render(<ChatThread messages={baseMessages} onSendMessage={onSendMessage} />);
    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeInTheDocument();
  });
});
