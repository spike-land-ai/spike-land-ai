import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { VibeCoder } from "@/ui/components/VibeCoder";
import React from "react";

// Import hooks for mocking
import { useChat } from "@/ui/hooks/useChat";
import { useAuth } from "@/ui/hooks/useAuth";
import { useTranspiler } from "@/ui/hooks/useTranspiler";
import { useDarkMode } from "@/ui/hooks/useDarkMode";

// Mock hooks
vi.mock("@/ui/hooks/useChat", () => ({
  useChat: vi.fn(() => ({
    messages: [],
    sendMessage: vi.fn(),
    isStreaming: false,
    error: null,
    clearError: vi.fn(),
    clearMessages: vi.fn(),
    submitBrowserResult: vi.fn(),
  })),
}));

vi.mock("@/ui/hooks/useBrowserBridge", () => ({
  useBrowserBridge: vi.fn(),
}));

vi.mock("@/ui/hooks/useDarkMode", () => ({
  useDarkMode: vi.fn(() => ({ isDarkMode: false })),
}));

vi.mock("@/ui/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    login: vi.fn(),
  })),
}));

vi.mock("@/ui/hooks/useTranspiler", () => ({
  useTranspiler: vi.fn(() => ({
    html: "<div>Preview Content</div>",
    error: null,
    isTranspiling: false,
  })),
}));

vi.mock("@tanstack/react-router", () => ({
  useRouter: vi.fn(() => ({})),
}));

// Mock lazy-loaded CodeEditor
vi.mock("@/editor/CodeEditor", () => ({
  CodeEditor: ({ value, onChange }: any) => (
    <textarea
      data-testid="mock-code-editor"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock icons - explicitly include all used icons to avoid "No export defined" errors
vi.mock("lucide-react", () => ({
  Send: () => <div data-testid="send-icon" />,
  Code2: () => <div data-testid="code-icon" />,
  Eye: () => <div data-testid="eye-icon" />,
  MessageSquare: () => <div data-testid="message-icon" />,
  PanelLeftClose: () => <div data-testid="panel-left-close-icon" />,
  PanelRightClose: () => <div data-testid="panel-right-close-icon" />,
  Sparkles: () => <div data-testid="sparkles-icon" />,
  Trash2: () => <div data-testid="trash-icon" />,
  X: () => <div data-testid="x-icon" />,
  GripVertical: () => <div data-testid="grip-icon" />,
  Loader2: () => <div data-testid="loader-icon" />,
  MonitorPlay: () => <div data-testid="monitor-play-icon" />,
  Check: () => <div data-testid="check-icon" />,
  Copy: () => <div data-testid="copy-icon" />,
}));

// Mock sub-components using their absolute alias path
vi.mock("@/ui/components/AiChatMessage", () => ({
  AiChatMessage: ({ message }: any) => (
    <div data-testid={`msg-${message.id}`}>{message.content}</div>
  ),
}));

vi.mock("@/ui/components/LivePreview", () => ({
  LivePreview: ({ appId }: any) => <div data-testid="live-preview">{appId}</div>,
}));

describe("VibeCoder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementations
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      isStreaming: false,
      error: null,
      clearError: vi.fn(),
      clearMessages: vi.fn(),
      submitBrowserResult: vi.fn(),
    } as any);

    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: true,
      login: vi.fn(),
    } as any);

    vi.mocked(useTranspiler).mockReturnValue({
      html: "<div>Preview Content</div>",
      error: null,
      isTranspiling: false,
    } as any);

    vi.mocked(useDarkMode).mockReturnValue({ isDarkMode: false } as any);
  });

  it("renders with default code", async () => {
    render(<VibeCoder />);
    await waitFor(() => {
      expect(screen.getByTestId("mock-code-editor")).toBeInTheDocument();
    });
    const editor = screen.getByTestId("mock-code-editor") as HTMLTextAreaElement;
    expect(editor.value).toContain("export default function App()");
  });

  it("switches mobile panels", async () => {
    render(<VibeCoder />);
    
    const codeTab = screen.getByRole("tab", { name: /Code/i });
    const previewTab = screen.getByRole("tab", { name: /Preview/i });
    const chatTab = screen.getByRole("tab", { name: /Chat/i });

    fireEvent.click(codeTab);
    expect(codeTab).toHaveAttribute("aria-selected", "true");
    
    fireEvent.click(previewTab);
    expect(previewTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(chatTab);
    expect(chatTab).toHaveAttribute("aria-selected", "true");
  });

  it("toggles desktop panels", () => {
    render(<VibeCoder />);
    
    const togglePreview = screen.getByTitle(/Hide preview panel/i);
    const toggleChat = screen.getByTitle(/Hide chat panel/i);

    expect(screen.getByLabelText("Live preview panel")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat panel")).toBeInTheDocument();

    fireEvent.click(togglePreview);
    expect(screen.queryByLabelText("Live preview panel")).not.toBeInTheDocument();

    fireEvent.click(toggleChat);
    expect(screen.queryByLabelText("Chat panel")).not.toBeInTheDocument();
  });

  it("updates code when editor changes", async () => {
    render(<VibeCoder />);
    await waitFor(() => screen.getByTestId("mock-code-editor"));
    
    const editor = screen.getByTestId("mock-code-editor");
    fireEvent.change(editor, { target: { value: "new code content" } });
    expect((editor as HTMLTextAreaElement).value).toBe("new code content");
  });

  it("sends a message through chat", async () => {
    const mockSendMessage = vi.fn();
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: mockSendMessage,
      isStreaming: false,
      isAuthenticated: true,
    } as any);

    render(<VibeCoder />);
    
    const textarea = screen.getByPlaceholderText(/Describe a change/i);
    const sendButton = screen.getByLabelText("Send message");

    fireEvent.change(textarea, { target: { value: "Make it blue" } });
    fireEvent.click(sendButton);

    expect(mockSendMessage).toHaveBeenCalledWith("Make it blue");
    expect(textarea).toHaveValue("");
  });

  it("applies code from AI assistant message", async () => {
    const mockUseChat = {
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: "Sure! Here's the updated code:\n```tsx\nexport default function App() { return <div>Blue App</div> }\n```",
        },
      ],
      sendMessage: vi.fn(),
      isStreaming: false,
      isAuthenticated: true,
    };
    vi.mocked(useChat).mockReturnValue(mockUseChat as any);

    render(<VibeCoder />);
    
    await waitFor(() => {
      const editor = screen.getByTestId("mock-code-editor") as HTMLTextAreaElement;
      expect(editor.value).toContain("Blue App");
    });
  });

  it("shows transpilation error in preview panel", async () => {
    vi.mocked(useTranspiler).mockReturnValue({
      html: null,
      error: "Syntax Error: Unexpected token",
      isTranspiling: false,
    } as any);

    render(<VibeCoder />);
    
    expect(screen.getByText("Transpilation Error")).toBeInTheDocument();
    expect(screen.getByText("Syntax Error: Unexpected token")).toBeInTheDocument();
  });

  it("shows generating indicator when AI is streaming", async () => {
    vi.mocked(useChat).mockReturnValue({
      messages: [],
      sendMessage: vi.fn(),
      isStreaming: true,
      isAuthenticated: true,
    } as any);

    render(<VibeCoder />);
    
    expect(screen.getByText("Generating")).toBeInTheDocument();
  });

  it("shows updating indicator when transpiling", async () => {
    vi.mocked(useTranspiler).mockReturnValue({
      html: "<div>Old</div>",
      error: null,
      isTranspiling: true,
    } as any);

    render(<VibeCoder />);
    
    expect(screen.getByText("Updating")).toBeInTheDocument();
  });

  it("clears messages when trash button is clicked", async () => {
    const mockClearMessages = vi.fn();
    vi.mocked(useChat).mockReturnValue({
      messages: [{ id: "1", role: "user", content: "hi" }],
      sendMessage: vi.fn(),
      clearMessages: mockClearMessages,
      isStreaming: false,
      isAuthenticated: true,
    } as any);

    render(<VibeCoder />);
    
    const clearButton = screen.getByLabelText("Clear conversation");
    fireEvent.click(clearButton);
    
    expect(mockClearMessages).toHaveBeenCalled();
  });

  it("shows auth warning when not authenticated and trying to send", async () => {
    const mockLogin = vi.fn();
    vi.mocked(useAuth).mockReturnValue({
      isAuthenticated: false,
      login: mockLogin,
    } as any);

    render(<VibeCoder />);
    
    const textarea = screen.getByPlaceholderText(/Sign in to chat/i);
    const sendButton = screen.getByLabelText("Send message");

    fireEvent.change(textarea, { target: { value: "Hello" } });
    fireEvent.click(sendButton);

    expect(screen.getByText("Sign in to chat with the AI agent.")).toBeInTheDocument();
    
    const signInButton = screen.getByRole("button", { name: /Sign in/i });
    fireEvent.click(signInButton);
    expect(mockLogin).toHaveBeenCalled();
  });
});
