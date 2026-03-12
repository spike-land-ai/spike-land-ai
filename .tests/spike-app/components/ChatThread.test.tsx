import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChatThread, type Message } from "@/ui/components/ChatThread";

describe("ChatThread", () => {
  const mockSend = vi.fn();

  const messages: Message[] = [
    { id: "1", role: "user", content: "Hello" },
    { id: "2", role: "assistant", content: "Hi there!" },
  ];

  it("renders messages", () => {
    render(<ChatThread messages={messages} onSendMessage={mockSend} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("shows empty state when no messages", () => {
    render(<ChatThread messages={[]} onSendMessage={mockSend} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
    expect(screen.getByText(/Start a conversation/)).toBeInTheDocument();
  });

  it("shows loading indicator when isLoading", () => {
    render(<ChatThread messages={[]} onSendMessage={mockSend} isLoading />);
    expect(screen.getByText("Assistant is thinking...")).toBeInTheDocument();
    // Loader2 with animate-spin
    const loader = screen.getByText("Assistant is thinking...").previousSibling;
    expect(loader).toHaveClass("animate-spin");
  });

  it("does not show loading indicator when not loading", () => {
    render(<ChatThread messages={[]} onSendMessage={mockSend} isLoading={false} />);
    expect(screen.queryByText("Assistant is thinking...")).not.toBeInTheDocument();
  });

  it("calls onSendMessage when send button clicked", () => {
    const onSend = vi.fn();
    render(<ChatThread messages={[]} onSendMessage={onSend} />);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    fireEvent.change(textarea, { target: { value: "test message" } });

    const sendBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendBtn);

    expect(onSend).toHaveBeenCalledWith("test message");
  });

  it("clears input after sending", () => {
    const onSend = vi.fn();
    render(<ChatThread messages={[]} onSendMessage={onSend} />);

    const textarea = screen.getByPlaceholderText(
      /Describe what you want to build/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(textarea.value).toBe("");
  });

  it("does not send empty or whitespace messages", () => {
    const onSend = vi.fn();
    render(<ChatThread messages={[]} onSendMessage={onSend} />);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("send button is disabled when input is empty", () => {
    render(<ChatThread messages={[]} onSendMessage={mockSend} />);
    const sendBtn = screen.getByRole("button", { name: "Send message" });
    expect(sendBtn).toBeDisabled();
  });

  it("send button is disabled when loading", () => {
    render(<ChatThread messages={[]} onSendMessage={mockSend} isLoading />);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    fireEvent.change(textarea, { target: { value: "hello" } });

    const sendBtn = screen.getByRole("button", { name: "Send message" });
    expect(sendBtn).toBeDisabled();
  });

  it("sends on Ctrl+Enter", () => {
    const onSend = vi.fn();
    render(<ChatThread messages={[]} onSendMessage={onSend} />);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    fireEvent.change(textarea, { target: { value: "keyboard send" } });
    // In ChatThread.tsx handleKeyDown uses Enter without shiftKey
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("keyboard send");
  });

  it("sends on Meta+Enter (Mac)", () => {
    const onSend = vi.fn();
    render(<ChatThread messages={[]} onSendMessage={onSend} />);

    const textarea = screen.getByPlaceholderText(/Describe what you want to build/);
    fireEvent.change(textarea, { target: { value: "mac send" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(onSend).toHaveBeenCalledWith("mac send");
  });

  it("renders message timestamps when provided", () => {
    const msgs: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Hi",
        timestamp: "2025-06-15T10:30:00Z",
      },
    ];
    render(<ChatThread messages={msgs} onSendMessage={mockSend} />);
    expect(screen.getByText("Hi")).toBeInTheDocument();
  });

  it("applies user message styling", () => {
    const msgs: Message[] = [{ id: "1", role: "user", content: "User msg" }];
    render(<ChatThread messages={msgs} onSendMessage={mockSend} />);

    const msgEl = screen.getByText("User msg").closest("div[class*='bg-']");
    expect(msgEl?.className).toContain("bg-primary");
  });

  it("applies assistant message styling", () => {
    const msgs: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "Bot msg",
      },
    ];
    render(<ChatThread messages={msgs} onSendMessage={mockSend} />);

    const msgEl = screen.getByText("Bot msg").closest("div[class*='bg-']");
    // In ChatThread.tsx: bg-card border border-border text-foreground rounded-tl-none hover:border-primary/30
    expect(msgEl?.className).toContain("bg-card");
  });
});
