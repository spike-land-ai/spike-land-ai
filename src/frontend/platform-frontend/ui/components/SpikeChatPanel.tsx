import { useRef, useState, useEffect, useCallback } from "react";
import { useSpikeChat, type AppUpdatedEvent } from "../hooks/useSpikeChat";
import { Send, Wifi, WifiOff, Loader2 } from "lucide-react";

interface SpikeChatPanelProps {
  channelId: string;
  onAppUpdated?: (event: AppUpdatedEvent) => void;
  className?: string;
}

export function SpikeChatPanel({ channelId, onAppUpdated, className = "" }: SpikeChatPanelProps) {
  const { messages, isConnected, isLoading, typingUsers, sendMessage, startTyping, stopTyping } =
    useSpikeChat({ channelId, onAppUpdated });

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const initialScrollDoneRef = useRef(false);

  // Track if user is at bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
  }, []);

  // Auto-scroll only if user was at the bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Scroll to bottom on initial load — runs once when loading finishes and messages are available
  useEffect(() => {
    if (!isLoading && messages.length > 0 && !initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      messagesEndRef.current?.scrollIntoView();
    }
  }, [isLoading, messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isSending) return;
    setIsSending(true);
    setInput("");
    stopTyping();
    try {
      await sendMessage(text);
    } catch {
      setInput(text); // restore on error
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (e.target.value.trim()) startTyping();
    else stopTyping();
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  // Avatar background color derived from userId using CSS variable palette tokens
  const avatarBgColor = (uid: string): string => {
    const vars = [
      "var(--color-blue-500)",
      "var(--color-emerald-500)",
      "var(--color-amber-500)",
      "var(--color-purple-500)",
      "var(--color-pink-500)",
      "var(--color-cyan-500)",
      "var(--color-red-500)",
      "var(--color-indigo-500)",
    ];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = (hash * 31 + uid.charCodeAt(i)) | 0;
    return vars[Math.abs(hash) % vars.length] ?? vars[0]!;
  };

  const isBot = (uid: string) => uid.startsWith("agent-") || uid === "system";

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
        <span className="font-semibold text-sm text-foreground">
          # {channelId.replace(/^app-/, "")}
        </span>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          {isConnected ? (
            <>
              <Wifi className="w-3 h-3 text-[var(--success-color)]" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="w-3 h-3 text-destructive" />
              Reconnecting...
            </>
          )}
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
        role="log"
        aria-label="Chat messages"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Start the conversation!
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="flex gap-2.5 animate-in fade-in slide-in-from-bottom-1 duration-200"
            >
              <div
                className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: avatarBgColor(msg.userId) }}
              >
                {msg.userId.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`text-sm font-semibold ${isBot(msg.userId) ? "text-primary" : "text-foreground"}`}
                  >
                    {isBot(msg.userId) ? "Bot" : msg.userId.split("-")[0]}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(msg.createdAt)}
                  </span>
                  {msg.contentType === "app_updated" && (
                    <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                      update
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words mt-0.5">
                  {msg.content}
                </p>
              </div>
            </div>
          ))
        )}

        {typingUsers.length > 0 && (
          <div className="text-xs text-muted-foreground italic animate-pulse">
            {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 bg-card">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            aria-label="Chat message input"
            className="flex-1 resize-none rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm
                       placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary
                       max-h-32"
            disabled={isSending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending || !isConnected}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-primary-foreground
                       disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
            aria-label="Send message"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
