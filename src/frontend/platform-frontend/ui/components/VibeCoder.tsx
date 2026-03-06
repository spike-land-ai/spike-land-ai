import {
  lazy,
  Suspense,
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import {
  Send,
  Code2,
  Eye,
  MessageSquare,
  PanelLeftClose,
  PanelRightClose,
  Sparkles,
  Trash2,
  X,
  GripVertical,
  Loader2,
  MonitorPlay,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { cn } from "../../styling/cn";
import { useChat } from "../hooks/useChat";
import { useBrowserBridge } from "../hooks/useBrowserBridge";
import { useDarkMode } from "../hooks/useDarkMode";
import { useAuth } from "../hooks/useAuth";
import { AiChatMessage } from "./AiChatMessage";
import { LivePreview } from "./LivePreview";
import { Button } from "../shared/ui/button";
import { useTranspiler } from "../hooks/useTranspiler";

// Lazy-load the Monaco-based code editor to keep initial bundle small
const CodeEditor = lazy(() =>
  import("../../editor/CodeEditor").then((m) => ({ default: m.CodeEditor })),
);

export interface VibeCoderProps {
  initialCode?: string;
  appId?: string;
}

type MobilePanel = "chat" | "code" | "preview";

const DEFAULT_CODE = `import React, { useState } from "react";

export default function App() {
  const [hovered, setHovered] = useState(false);
  const [clicks, setClicks] = useState(0);

  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setClicks(c => c + 1)}
        className="relative cursor-pointer select-none rounded-2xl p-px transition-all duration-300"
        style={{
          background: hovered
            ? "var(--primary-color)"
            : "var(--muted-fg)",
          boxShadow: hovered
            ? "0 0 40px 8px var(--primary-glow)"
            : "none",
        }}
      >
        <div className="rounded-2xl bg-card/90 backdrop-blur-xl px-10 py-8 text-center border border-border">
          <div
            className="text-5xl mb-3 transition-all duration-300 text-primary"
            style={{ filter: hovered ? "drop-shadow(0 0 12px var(--primary-color))" : "none" }}
          >
            ✦
          </div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">VibeCoder</h1>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Edit me. I react to you.</p>
          <div className="inline-block rounded-full bg-muted border border-border px-4 py-1 text-xs text-muted-foreground">
            {clicks === 0 ? "hover · click · vibe" : \`clicked \${clicks}×\`}
          </div>
        </div>
      </div>
    </div>
  );
}`;

// ---------------------------------------------------------------------------
// Resizable divider
// ---------------------------------------------------------------------------

interface DividerProps {
  onDrag: (deltaX: number) => void;
  isDarkMode: boolean;
}

function ResizeDivider({ onDrag, isDarkMode }: DividerProps) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    lastX.current = e.clientX;
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onDrag(delta);
    };
    const onMouseUp = () => {
      dragging.current = false;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onDrag]);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panels"
      onMouseDown={onMouseDown}
      className={cn(
        "hidden md:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center transition-colors group select-none",
        isDarkMode
          ? "bg-white/5 hover:bg-white/10 active:bg-primary/30"
          : "bg-border hover:bg-border/70 active:bg-primary/20",
      )}
    >
      <GripVertical
        className={cn(
          "w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity",
          isDarkMode ? "text-gray-500" : "text-muted-foreground",
        )}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat panel
// ---------------------------------------------------------------------------

interface ChatPanelProps {
  isDarkMode: boolean;
  className?: string;
  onStreamingChange?: (streaming: boolean) => void;
}

function ChatPanel({ isDarkMode, className, onStreamingChange }: ChatPanelProps) {
  const { isAuthenticated, login } = useAuth();
  const router = useRouter();
  const { messages, sendMessage, isStreaming, error, clearError, clearMessages, submitBrowserResult } = useChat();

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [authWarning, setAuthWarning] = useState(false);

  useBrowserBridge({ messages, onResult: submitBrowserResult, router });

  // Notify parent when streaming state changes so other panels can react
  useEffect(() => {
    onStreamingChange?.(isStreaming);
  }, [isStreaming, onStreamingChange]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return;
    if (!isAuthenticated) {
      setAuthWarning(true);
      setTimeout(() => setAuthWarning(false), 4000);
      return;
    }
    sendMessage(input);
    setInput("");
  }, [input, isStreaming, isAuthenticated, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-hidden",
        isDarkMode ? "bg-background" : "bg-card",
        className,
      )}
    >
      {/* Panel header */}
      <div
        className={cn(
          "flex items-center justify-between px-4 py-3 border-b shrink-0",
          isDarkMode ? "border-white/5 bg-white/3" : "border-border bg-muted/40",
        )}
      >
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div
              className={cn(
                "w-2 h-2 rounded-full",
                isDarkMode ? "bg-success-foreground animate-pulse" : "bg-green-500",
              )}
            />
            {isDarkMode && (
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-success-foreground animate-ping opacity-30" />
            )}
          </div>
          <span
            className={cn(
              "text-xs font-bold tracking-tight",
              isDarkMode ? "text-white" : "text-foreground",
            )}
          >
            AI Agent
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className={cn(
              "p-1.5 rounded-lg transition-all",
              isDarkMode
                ? "hover:bg-white/5 text-gray-500 hover:text-red-400"
                : "hover:bg-muted text-muted-foreground hover:text-destructive",
            )}
            title="Clear conversation"
            aria-label="Clear conversation"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto p-4", isDarkMode && "nice-scrollbar")}
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 opacity-50 px-6">
            <div
              className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center",
                isDarkMode ? "bg-white/5" : "bg-muted",
              )}
            >
              <Sparkles
                className="w-7 h-7 text-primary"
              />
            </div>
            <div className="space-y-1.5">
              <p
                className={cn(
                  "text-sm font-bold",
                  isDarkMode ? "text-white" : "text-foreground",
                )}
              >
                Start coding with AI
              </p>
              <p
                className={cn(
                  "text-xs leading-relaxed max-w-[220px]",
                  isDarkMode ? "text-gray-500" : "text-muted-foreground",
                )}
              >
                Describe what you want to build and the AI will write and update the code for you.
              </p>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <AiChatMessage key={msg.id} message={msg} />
          ))}
        </div>
      </div>

      {/* Auth warning */}
      {authWarning && (
        <div
          className={cn(
            "mx-4 mb-3 px-3 py-2.5 rounded-xl text-xs font-semibold flex justify-between items-center gap-3 shrink-0",
            isDarkMode
              ? "bg-primary/10 border border-primary/20 text-primary"
              : "bg-amber-50 border border-amber-200 text-amber-800",
          )}
        >
          <span className="flex-1">Sign in to chat with the AI agent.</span>
          <button
            onClick={() => login()}
            className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors shrink-0",
              isDarkMode
                ? "bg-primary text-primary-foreground hover:bg-primary-light"
                : "bg-amber-500 text-white hover:bg-amber-600",
            )}
          >
            Sign in
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          className={cn(
            "mx-4 mb-3 px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shrink-0",
            isDarkMode
              ? "bg-red-500/10 border border-red-500/20 text-red-400"
              : "bg-red-50 border border-red-200 text-red-700",
          )}
        >
          <span className="flex-1">{error}</span>
          <button
            onClick={clearError}
            aria-label="Dismiss error"
            className={cn(
              "p-1 rounded-md transition-colors shrink-0",
              isDarkMode ? "hover:bg-white/5" : "hover:bg-red-100",
            )}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className={cn(
          "p-3 border-t shrink-0",
          isDarkMode ? "border-white/5 bg-white/3" : "border-border bg-muted/20",
        )}
      >
        <div
          className={cn(
            "flex items-end gap-2 rounded-xl p-2 transition-all",
            isDarkMode
              ? "bg-white/5 border border-white/10 focus-within:ring-1 ring-primary/30"
              : "bg-background border border-border focus-within:ring-2 focus-within:ring-ring/30",
          )}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isAuthenticated
                ? "Describe a change or ask a question..."
                : "Sign in to chat with AI..."
            }
            rows={1}
            className={cn(
              "flex-1 bg-transparent border-none outline-none px-2 py-2 text-sm resize-none max-h-40 font-medium",
              "placeholder:opacity-50",
              isDarkMode
                ? "text-white placeholder:text-gray-600"
                : "text-foreground placeholder:text-muted-foreground",
            )}
            style={{ minHeight: "40px" }}
          />
          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
              className={cn(
                "p-2.5 rounded-lg transition-all active:scale-90 disabled:opacity-25 disabled:cursor-not-allowed",
                "bg-primary text-primary-foreground",
              )}
            >
              {isStreaming ? (
                <div
                  className="w-4 h-4 border-2 rounded-full animate-spin border-primary-foreground/20 border-t-primary-foreground"
                />
              ) : (
                <Send className="w-4 h-4 stroke-[2.5]" />
              )}
            </button>
            {/* Keyboard shortcut hint — visible only when there is content to send */}
            {input.trim() && !isStreaming && (
              <span
                className={cn(
                  "text-[9px] font-bold uppercase tracking-wider leading-none px-1 py-0.5 rounded border select-none",
                  isDarkMode
                    ? "text-gray-600 border-white/10 bg-white/5"
                    : "text-muted-foreground border-border bg-muted",
                )}
                aria-hidden="true"
              >
                Enter
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Code panel
// ---------------------------------------------------------------------------

interface CodePanelProps {
  code: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
  isStreaming?: boolean;
  className?: string;
}

function CodePanel({ code, onChange, isDarkMode, isStreaming = false, className }: CodePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-hidden",
        "bg-background",
        className,
      )}
    >
      {/* Panel header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 border-b shrink-0",
          isDarkMode ? "border-white/5 bg-white/3" : "border-border bg-muted/40",
        )}
      >
        <Code2
          className="w-3.5 h-3.5 text-primary"
        />
        <span
          className={cn(
            "text-xs font-bold tracking-tight",
            isDarkMode ? "text-white" : "text-foreground",
          )}
        >
          Code Editor
        </span>
        {/* AI generating indicator */}
        {isStreaming && (
          <span
            className={cn(
              "flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              isDarkMode
                ? "bg-primary/15 text-primary border border-primary/20"
                : "bg-primary/10 text-primary border border-primary/20",
            )}
          >
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Generating
          </span>
        )}
        <span
          className={cn(
            "ml-auto text-[10px] font-medium uppercase tracking-widest",
            isDarkMode ? "text-gray-600" : "text-muted-foreground/60",
          )}
        >
          TSX
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="h-full flex items-center justify-center gap-3">
              <Loader2
                className="w-5 h-5 animate-spin text-primary"
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isDarkMode ? "text-gray-500" : "text-muted-foreground",
                )}
              >
                Loading editor...
              </span>
            </div>
          }
        >
          <CodeEditor value={code} onChange={onChange} />
        </Suspense>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

interface PreviewPanelProps {
  appId?: string;
  code: string;
  isDarkMode: boolean;
  className?: string;
}

function PreviewPanel({ appId, code, isDarkMode, className }: PreviewPanelProps) {
  const { html, error: transpileError, isTranspiling } = useTranspiler(code);

  return (
    <div
      className={cn(
        "flex flex-col h-full overflow-hidden",
        "bg-background",
        className,
      )}
    >
      {/* Panel header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-3 border-b shrink-0",
          isDarkMode ? "border-white/5 bg-white/3" : "border-border bg-muted/40",
        )}
      >
        <Eye
          className="w-3.5 h-3.5 text-success-foreground"
        />
        <span
          className={cn(
            "text-xs font-bold tracking-tight",
            isDarkMode ? "text-white" : "text-foreground",
          )}
        >
          Live Preview
        </span>
        {isTranspiling && (
          <span
            className={cn(
              "flex items-center gap-1.5 ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
              isDarkMode
                ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20"
                : "bg-yellow-500/10 text-yellow-600 border border-yellow-500/20",
            )}
          >
            <Loader2 className="w-2.5 h-2.5 animate-spin" />
            Updating
          </span>
        )}
        {appId && (
          <span
            className={cn(
              "ml-auto text-[10px] font-mono font-medium px-2 py-0.5 rounded border",
              isDarkMode
                ? "text-gray-500 border-white/5 bg-white/3"
                : "text-muted-foreground border-border bg-muted",
            )}
          >
            {appId}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {appId ? (
          <LivePreview appId={appId} isDarkMode={isDarkMode} />
        ) : transpileError ? (
          <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
            <div
              className={cn(
                "p-3 rounded-full",
                isDarkMode ? "bg-red-500/10 text-red-400" : "bg-destructive/10 text-destructive",
              )}
            >
              <Code2 className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 max-w-sm">
              <p className={cn("text-sm font-bold", isDarkMode ? "text-white" : "text-foreground")}>
                Transpilation Error
              </p>
              <p className={cn("text-xs font-mono leading-relaxed", isDarkMode ? "text-red-400" : "text-destructive")}>
                {transpileError}
              </p>
            </div>
          </div>
        ) : html ? (
          <iframe
            title="Live preview"
            srcDoc={html}
            sandbox="allow-scripts allow-same-origin"
            className="w-full h-full border-0"
          />
        ) : code.trim() ? (
          <div className="h-full flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className={cn("text-xs font-medium", isDarkMode ? "text-gray-500" : "text-muted-foreground")}>
              Transpiling...
            </span>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-5 px-8 text-center">
            <div className="relative">
              <div
                className={cn(
                  "w-20 h-20 rounded-3xl flex items-center justify-center",
                  isDarkMode
                    ? "bg-success-foreground/10 ring-1 ring-success-foreground/20"
                    : "bg-green-50 ring-1 ring-green-200",
                )}
              >
                <MonitorPlay className="w-10 h-10 text-success-foreground" />
              </div>
              {isDarkMode && (
                <div className="absolute inset-0 w-20 h-20 rounded-3xl bg-success-foreground/10 blur-xl -z-10" />
              )}
            </div>
            <div className="space-y-2">
              <p className={cn("text-sm font-bold", isDarkMode ? "text-white" : "text-foreground")}>
                Your app appears here
              </p>
              <p className={cn("text-xs leading-relaxed max-w-[200px]", isDarkMode ? "text-gray-500" : "text-muted-foreground")}>
                Describe what you want to build in the Chat panel and the AI will generate a live preview instantly.
              </p>
            </div>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold",
                isDarkMode
                  ? "bg-success-foreground/8 border border-success-foreground/15 text-success-foreground/70"
                  : "bg-green-50 border border-green-200 text-green-700",
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              Try: &ldquo;Build a todo list app&rdquo;
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab bar
// ---------------------------------------------------------------------------

interface MobileTabBarProps {
  active: MobilePanel;
  onChange: (panel: MobilePanel) => void;
  isDarkMode: boolean;
}

const MOBILE_TABS: { id: MobilePanel; label: string; Icon: typeof MessageSquare }[] = [
  { id: "chat", label: "Chat", Icon: MessageSquare },
  { id: "code", label: "Code", Icon: Code2 },
  { id: "preview", label: "Preview", Icon: Eye },
];

function MobileTabBar({ active, onChange, isDarkMode }: MobileTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="VibeCoder panels"
      className={cn(
        "flex md:hidden border-b shrink-0",
        isDarkMode ? "bg-background border-white/5" : "bg-card border-border",
      )}
    >
      {MOBILE_TABS.map(({ id, label, Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            aria-controls={`vibecoder-panel-${id}`}
            onClick={() => onChange(id)}
            // min-h-[52px] gives a comfortable 52 px hit target (WCAG 2.5.8 recommends 24 px minimum,
            // Apple HIG recommends 44 px). py-4 + gap-2 + larger icon naturally fills this.
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-1.5 py-4 min-h-[52px] text-xs font-bold transition-colors select-none",
              isActive
                ? "text-primary border-b-2 border-primary"
                : isDarkMode
                ? "text-gray-500 active:text-gray-300"
                : "text-muted-foreground active:text-foreground",
            )}
          >
            <Icon className="w-5 h-5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop panel visibility toggles
// ---------------------------------------------------------------------------

interface PanelToggleBarProps {
  chatVisible: boolean;
  previewVisible: boolean;
  onToggleChat: () => void;
  onTogglePreview: () => void;
  isDarkMode: boolean;
}

function PanelToggleBar({
  chatVisible,
  previewVisible,
  onToggleChat,
  onTogglePreview,
  isDarkMode,
}: PanelToggleBarProps) {
  const btnBase = cn(
    "p-1.5 rounded-lg transition-all",
    isDarkMode
      ? "text-gray-500 hover:text-white hover:bg-white/5"
      : "text-muted-foreground hover:text-foreground hover:bg-muted",
  );

  return (
    <div
      className={cn(
        "hidden md:flex items-center gap-1 px-3 py-2 border-b shrink-0",
        isDarkMode ? "bg-background border-white/5" : "bg-muted/30 border-border",
      )}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onTogglePreview}
        className={cn(btnBase, "gap-1.5 h-7 px-2.5 text-xs")}
        title={previewVisible ? "Hide preview panel" : "Show preview panel"}
      >
        {previewVisible ? (
          <PanelLeftClose className="w-3.5 h-3.5" />
        ) : (
          <Eye className="w-3.5 h-3.5" />
        )}
        Preview
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onToggleChat}
        className={cn(btnBase, "ml-auto gap-1.5 h-7 px-2.5 text-xs")}
        title={chatVisible ? "Hide chat panel" : "Show chat panel"}
      >
        Chat
        {chatVisible ? (
          <PanelRightClose className="w-3.5 h-3.5" />
        ) : (
          <MessageSquare className="w-3.5 h-3.5" />
        )}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VibeCoder — main layout component
// ---------------------------------------------------------------------------

const MIN_PANEL_WIDTH = 240; // px
const DEFAULT_CHAT_WIDTH = 320; // px
const DEFAULT_PREVIEW_WIDTH = 400; // px

export function VibeCoder({ initialCode = DEFAULT_CODE, appId }: VibeCoderProps) {
  const { isDarkMode } = useDarkMode();
  const [code, setCode] = useState(initialCode);
  const [activePanel, setActivePanel] = useState<MobilePanel>("chat");
  const [chatVisible, setChatVisible] = useState(true);
  const [previewVisible, setPreviewVisible] = useState(true);
  // Lifted from ChatPanel so CodePanel can show a generating indicator
  const [isStreaming, setIsStreaming] = useState(false);

  // Panel widths controlled by drag (desktop only)
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [previewWidth, setPreviewWidth] = useState(DEFAULT_PREVIEW_WIDTH);

  const containerRef = useRef<HTMLDivElement>(null);

  // Chat is on the right: dragging the divider LEFT (negative delta) grows chat
  const handleChatDrag = useCallback((deltaX: number) => {
    setChatWidth((w) => Math.max(MIN_PANEL_WIDTH, w - deltaX));
  }, []);

  const handlePreviewDrag = useCallback((deltaX: number) => {
    setPreviewWidth((w) => Math.max(MIN_PANEL_WIDTH, w - deltaX));
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full w-full overflow-hidden",
        isDarkMode ? "bg-background text-gray-100" : "bg-background text-foreground",
      )}
    >
      {/* Desktop panel toggle toolbar */}
      <PanelToggleBar
        chatVisible={chatVisible}
        previewVisible={previewVisible}
        onToggleChat={() => setChatVisible((v) => !v)}
        onTogglePreview={() => setPreviewVisible((v) => !v)}
        isDarkMode={isDarkMode}
      />

      {/* Mobile tab switcher */}
      <MobileTabBar active={activePanel} onChange={setActivePanel} isDarkMode={isDarkMode} />

      {/* Panel area — layout: Code | Preview | Chat (chat on right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---- CODE PANEL (left, flex-1) ---- */}
        <div
          id="vibecoder-panel-code"
          role="tabpanel"
          aria-label="Code editor panel"
          className={cn(
            "flex-1 overflow-hidden min-w-0",
            activePanel === "code" ? "flex flex-col" : "hidden md:flex md:flex-col",
          )}
        >
          <div
            key={`code-${activePanel === "code" ? "active" : "bg"}`}
            className={cn(
              "h-full flex flex-col",
              activePanel === "code" && "animate-in fade-in duration-200",
            )}
          >
            <CodePanel
              code={code}
              onChange={setCode}
              isDarkMode={isDarkMode}
              isStreaming={isStreaming}
              className="h-full"
            />
          </div>
        </div>

        {/* ---- PREVIEW PANEL (center-right) ---- */}
        {previewVisible && (
          <>
            <ResizeDivider onDrag={handlePreviewDrag} isDarkMode={isDarkMode} />
            <div
              id="vibecoder-panel-preview"
              role="tabpanel"
              aria-label="Live preview panel"
              style={{ width: previewWidth, minWidth: MIN_PANEL_WIDTH }}
              className={cn(
                "shrink-0 overflow-hidden border-l",
                activePanel === "preview" ? "flex flex-col flex-1 md:flex-none" : "hidden md:flex md:flex-col",
                isDarkMode ? "border-white/5" : "border-border",
              )}
            >
              <div
                key={`preview-${activePanel === "preview" ? "active" : "bg"}`}
                className={cn(
                  "h-full",
                  activePanel === "preview" && "animate-in fade-in duration-200",
                )}
              >
                <PreviewPanel
                  {...(appId != null ? { appId } : {})}
                  code={code}
                  isDarkMode={isDarkMode}
                  className="h-full"
                />
              </div>
            </div>
          </>
        )}

        {/* ---- CHAT PANEL (desktop: right sidebar) ---- */}
        {chatVisible && (
          <>
            <ResizeDivider onDrag={handleChatDrag} isDarkMode={isDarkMode} />
            <div
              id="vibecoder-panel-chat"
              role="tabpanel"
              aria-label="Chat panel"
              style={{ width: chatWidth, minWidth: MIN_PANEL_WIDTH }}
              className={cn(
                "shrink-0 overflow-hidden border-l",
                activePanel === "chat" ? "flex flex-col flex-1 md:flex-none" : "hidden md:flex md:flex-col",
                isDarkMode ? "border-white/5" : "border-border",
              )}
            >
              <div
                key={`chat-${activePanel === "chat" ? "active" : "bg"}`}
                className={cn(
                  "h-full",
                  activePanel === "chat" && "animate-in fade-in duration-200",
                )}
              >
                <ChatPanel isDarkMode={isDarkMode} className="h-full" onStreamingChange={setIsStreaming} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
