import { useState, useRef, useEffect, type KeyboardEvent } from "react";
import { X, Send, Trash2, Sparkles } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useDarkMode } from "../hooks/useDarkMode";
import { useAuth } from "../hooks/useAuth";
import { cn } from "../../styling/cn";
import { useChat } from "../hooks/useChat";
import { useBrowserBridge } from "../hooks/useBrowserBridge";
import { AiChatMessage } from "./AiChatMessage";

interface AiChatWidgetProps {
  open: boolean;
  onToggle: () => void;
}

export function AiChatWidget({ open, onToggle }: AiChatWidgetProps) {
  const { isDarkMode } = useDarkMode();
  const { isAuthenticated, login } = useAuth();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [authWarning, setAuthWarning] = useState(false);
  const { messages, sendMessage, isStreaming, error, clearError, clearMessages, submitBrowserResult } = useChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useBrowserBridge({ messages, onResult: submitBrowserResult, router });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSend = () => {
    if (!input.trim() || isStreaming) return;
    if (!isAuthenticated) {
      setAuthWarning(true);
      setTimeout(() => setAuthWarning(false), 4000);
      return;
    }
    sendMessage(input);
    setInput("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onToggle}
        aria-hidden="true"
      />

      {/* Overlay chat panel */}
      <div
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] flex flex-col shadow-2xl",
          isDarkMode
            ? "bg-black/95 backdrop-blur-2xl border-l border-white/10"
            : "bg-card border-l border-border",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            "flex items-center justify-between px-5 py-4 border-b shrink-0",
            isDarkMode
              ? "bg-gradient-to-r from-primary-foreground/60 via-black/40 to-primary-foreground/40 border-white/8"
              : "bg-muted/50 border-border",
          )}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  isDarkMode ? "bg-primary animate-pulse shadow-[0_0_8px_var(--primary-glow)]" : "bg-success",
                )}
              />
              {isDarkMode && (
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-primary animate-ping opacity-30" />
              )}
            </div>
            <div className="flex flex-col">
              <span
                className={cn(
                  "text-xs font-black uppercase tracking-widest",
                  isDarkMode ? "text-primary-light/60" : "text-muted-foreground",
                )}
              >
                {isDarkMode ? "Neural Partner" : "AI Assistant"}
              </span>
              <h3
                className={cn(
                  "text-sm font-bold tracking-tight",
                  isDarkMode ? "text-white" : "text-foreground",
                )}
              >
                spike.land{isDarkMode && <> <span className="text-primary-light">Intelligence</span></>}
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearMessages}
                className={cn(
                  "p-2 rounded-xl transition-all active:scale-90",
                  isDarkMode
                    ? "hover:bg-white/8 text-white/30 hover:text-red-400"
                    : "hover:bg-muted text-muted-foreground hover:text-destructive",
                )}
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onToggle}
              className={cn(
                "p-2 rounded-xl transition-all active:scale-90",
                isDarkMode
                  ? "hover:bg-white/8 text-white/30 hover:text-white"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className={cn("flex-1 overflow-y-auto p-5", isDarkMode && "nice-scrollbar")}
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
              <div
                className={cn(
                  "w-16 h-16 rounded-3xl flex items-center justify-center",
                  isDarkMode ? "bg-white/5" : "bg-muted",
                )}
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="space-y-2">
                <p
                  className={cn(
                    "text-sm font-bold tracking-tight",
                    isDarkMode ? "text-white" : "text-foreground",
                  )}
                >
                  How can I help you today?
                </p>
                <p
                  className={cn(
                    "text-xs font-medium leading-relaxed max-w-[200px]",
                    isDarkMode ? "text-gray-500" : "text-muted-foreground",
                  )}
                >
                  I can help you navigate spike.land, answer questions, and assist with your tasks.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-6">
            {messages.map((msg, idx) => (
              <AiChatMessage
                key={msg.id}
                message={msg}
                isStreaming={
                  isStreaming &&
                  msg.role === "assistant" &&
                  idx === messages.length - 1
                }
              />
            ))}
          </div>
        </div>

        {/* Auth warning */}
        {authWarning && (
          <div
            className={cn(
              "mx-5 mb-3 px-4 py-3 rounded-2xl text-[11px] font-bold flex justify-between items-center gap-3",
              isDarkMode
                ? "bg-primary/10 border border-primary/20 text-primary-light backdrop-blur-sm"
                : "bg-warning border border-warning/30 text-warning-foreground",
            )}
          >
            <span className="flex-1">Sign in to chat with the AI assistant.</span>
            <button
              onClick={() => login()}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors",
                isDarkMode
                  ? "bg-primary text-primary-foreground hover:bg-primary-light shadow-[0_0_12px_var(--primary-glow)]"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              Sign in
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className={cn(
              "mx-5 mb-3 px-4 py-3 rounded-2xl text-[11px] font-bold flex justify-between items-center",
              isDarkMode
                ? "bg-red-950/40 border border-red-500/20 text-red-400 backdrop-blur-sm"
                : "bg-destructive border border-destructive/20 text-destructive-foreground",
            )}
          >
            <span className="flex-1 mr-4">{error}</span>
            <button
              onClick={clearError}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isDarkMode ? "hover:bg-white/8" : "hover:bg-white/20",
              )}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Input area */}
        <div
          className={cn(
            "p-4 border-t",
            isDarkMode
              ? "border-white/8 bg-primary-foreground/20 backdrop-blur-xl"
              : "border-border bg-muted/30",
          )}
        >
          <div
            className={cn(
              "relative flex items-end gap-3 rounded-2xl p-2 transition-all",
              isDarkMode
                ? "bg-white/5 border border-white/10 focus-within:border-primary/50 focus-within:shadow-[0_0_20px_var(--primary-glow)] focus-within:ring-1 focus-within:ring-primary/20"
                : "bg-card border border-border",
            )}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isAuthenticated ? "Ask me anything..." : "Sign in to chat..."}
              rows={1}
              className={cn(
                "flex-1 bg-transparent border-none outline-none px-4 py-3 text-sm resize-none max-h-32 font-medium placeholder:opacity-40",
                isDarkMode ? "text-white placeholder:text-primary-light/40" : "text-foreground placeholder:text-muted-foreground",
              )}
              style={{ minHeight: "44px" }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isStreaming || !isAuthenticated}
              className={cn(
                "p-3 rounded-xl transition-all active:scale-90 disabled:opacity-20 disabled:grayscale",
                "bg-primary text-primary-foreground hover:bg-primary-light glow-primary disabled:shadow-none",
              )}
              aria-label="Send message"
            >
              {isStreaming ? (
                <div className="w-4 h-4 border-2 rounded-full animate-spin border-current/20 border-t-current" />
              ) : (
                <Send className="w-4 h-4 stroke-[3]" />
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
