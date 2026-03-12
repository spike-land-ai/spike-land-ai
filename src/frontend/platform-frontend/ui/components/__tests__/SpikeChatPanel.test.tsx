import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpikeChatPanel } from "../SpikeChatPanel";
import type { ChatMessage } from "../../hooks/useSpikeChat";

// Mock useSpikeChat hook
const mockUseSpikeChat = vi.fn();
vi.mock("../../hooks/useSpikeChat", () => ({
  useSpikeChat: (...args: unknown[]) => mockUseSpikeChat(...args),
}));

// Mock lucide-react icons
vi.mock("lucide-react", () => ({
  Send: () => <svg data-testid="icon-send" />,
  Wifi: () => <svg data-testid="icon-wifi" />,
  WifiOff: () => <svg data-testid="icon-wifi-off" />,
  Loader2: () => <svg data-testid="icon-loader" />,
}));

const mockSendMessage = vi.fn();
const mockStartTyping = vi.fn();
const mockStopTyping = vi.fn();

const defaultHookReturn = {
  messages: [] as ChatMessage[],
  isConnected: true,
  isLoading: false,
  typingUsers: [] as string[],
  sendMessage: mockSendMessage,
  startTyping: mockStartTyping,
  stopTyping: mockStopTyping,
};

const sampleMessages: ChatMessage[] = [
  {
    id: "msg-1",
    channelId: "app-demo",
    userId: "user-abc",
    content: "Hello from user",
    contentType: "text",
    threadId: null,
    createdAt: 1_700_000_000_000,
  },
  {
    id: "msg-2",
    channelId: "app-demo",
    userId: "agent-bot",
    content: "Hello from bot",
    contentType: "text",
    threadId: null,
    createdAt: 1_700_000_060_000,
  },
];

describe("SpikeChatPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSpikeChat.mockReturnValue(defaultHookReturn);
  });

  it("renders without crashing", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByRole("log", { name: "Chat messages" })).toBeInTheDocument();
  });

  it("passes channelId to useSpikeChat", () => {
    render(<SpikeChatPanel channelId="app-my-channel" />);
    expect(mockUseSpikeChat).toHaveBeenCalledWith(
      expect.objectContaining({ channelId: "app-my-channel" }),
    );
  });

  it("strips 'app-' prefix from channelId in header", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("# demo")).toBeInTheDocument();
  });

  it("renders channel name without prefix when id has no 'app-' prefix", () => {
    render(<SpikeChatPanel channelId="my-room" />);
    expect(screen.getByText("# my-room")).toBeInTheDocument();
  });

  it("shows Connected status when isConnected is true", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Reconnecting status when isConnected is false", () => {
    mockUseSpikeChat.mockReturnValue({ ...defaultHookReturn, isConnected: false });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("Reconnecting...")).toBeInTheDocument();
  });

  it("shows loading spinner when isLoading is true", () => {
    mockUseSpikeChat.mockReturnValue({ ...defaultHookReturn, isLoading: true });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });

  it("shows empty state message when no messages and not loading", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("No messages yet. Start the conversation!")).toBeInTheDocument();
  });

  it("renders messages when present", () => {
    mockUseSpikeChat.mockReturnValue({ ...defaultHookReturn, messages: sampleMessages });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("Hello from user")).toBeInTheDocument();
    expect(screen.getByText("Hello from bot")).toBeInTheDocument();
  });

  it("renders bot label for agent- prefixed userId", () => {
    mockUseSpikeChat.mockReturnValue({ ...defaultHookReturn, messages: sampleMessages });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("Bot")).toBeInTheDocument();
  });

  it("renders first segment of userId for non-bot users", () => {
    mockUseSpikeChat.mockReturnValue({ ...defaultHookReturn, messages: sampleMessages });
    render(<SpikeChatPanel channelId="app-demo" />);
    // userId "user-abc" → first segment "user"
    expect(screen.getByText("user")).toBeInTheDocument();
  });

  it("renders 'update' badge for app_updated content type", () => {
    const updateMessage: ChatMessage = {
      ...sampleMessages[0],
      id: "msg-update",
      contentType: "app_updated",
    };
    mockUseSpikeChat.mockReturnValue({
      ...defaultHookReturn,
      messages: [updateMessage],
    });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText("update")).toBeInTheDocument();
  });

  it("shows typing indicator when typingUsers is non-empty (single)", () => {
    mockUseSpikeChat.mockReturnValue({
      ...defaultHookReturn,
      typingUsers: ["alice"],
    });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText(/alice.*is typing/)).toBeInTheDocument();
  });

  it("shows typing indicator with plural form for multiple users", () => {
    mockUseSpikeChat.mockReturnValue({
      ...defaultHookReturn,
      typingUsers: ["alice", "bob"],
    });
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByText(/alice, bob.*are typing/)).toBeInTheDocument();
  });

  it("renders the message input textarea", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByRole("textbox", { name: "Chat message input" })).toBeInTheDocument();
  });

  it("renders the send button", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
  });

  it("send button is disabled when input is empty", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("send button is disabled when not connected", () => {
    mockUseSpikeChat.mockReturnValue({ ...defaultHookReturn, isConnected: false });
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("send button is enabled when input has text and connected", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Hello" } });
    expect(screen.getByRole("button", { name: "Send message" })).not.toBeDisabled();
  });

  it("calls sendMessage and clears input on button click", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Test message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Test message");
    });
    expect(textarea).toHaveValue("");
  });

  it("calls sendMessage when Enter key is pressed", async () => {
    mockSendMessage.mockResolvedValue(undefined);
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Enter send" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Enter send");
    });
  });

  it("does not call sendMessage on Shift+Enter", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Multiline" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("calls startTyping when typing non-empty text", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "typing..." } });
    expect(mockStartTyping).toHaveBeenCalled();
  });

  it("calls stopTyping when input becomes empty", () => {
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "typing" } });
    fireEvent.change(textarea, { target: { value: "" } });
    expect(mockStopTyping).toHaveBeenCalled();
  });

  it("restores input on send failure", async () => {
    mockSendMessage.mockRejectedValue(new Error("Network error"));
    render(<SpikeChatPanel channelId="app-demo" />);
    const textarea = screen.getByRole("textbox", { name: "Chat message input" });
    fireEvent.change(textarea, { target: { value: "Failed message" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      expect(textarea).toHaveValue("Failed message");
    });
  });

  it("applies custom className to root element", () => {
    const { container } = render(<SpikeChatPanel channelId="app-demo" className="custom-class" />);
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("passes onAppUpdated callback to useSpikeChat", () => {
    const onAppUpdated = vi.fn();
    render(<SpikeChatPanel channelId="app-demo" onAppUpdated={onAppUpdated} />);
    expect(mockUseSpikeChat).toHaveBeenCalledWith(expect.objectContaining({ onAppUpdated }));
  });
});
