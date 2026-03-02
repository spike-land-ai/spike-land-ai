"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { tryCatch } from "@/lib/try-catch";
import { ArrowLeft, Bot, Loader2, Send, User, Wrench } from "lucide-react";
import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: "USER" | "AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
}

interface BazdmegChatClientProps {
  initialMessages: ChatMessage[];
  userName: string;
}

export function BazdmegChatClient({ initialMessages, userName }: BazdmegChatClientProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolActivity, setToolActivity] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [placeholder, setPlaceholder] = useState(
    "Ask about quality gates, CI, PRs, or give commands...",
  );
  useEffect(() => {
    import("@/lib/constants/placeholders").then((m) => {
      setPlaceholder(m.getRandomBazdmegPlaceholder());
    });
  }, []);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages, toolActivity]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    // Add user message optimistically
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);
    setToolActivity(null);

    // Placeholder for streaming agent response
    const agentMsgId = `agent-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: agentMsgId,
        role: "AGENT",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);

    const { data: response, error: fetchError } = await tryCatch(
      fetch("/api/bazdmeg/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    );

    if (fetchError || !response || !response.ok) {
      const errorText = response ? await response.text() : "Network error";
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, content: `Error: ${errorText}` } : m)),
      );
      setIsStreaming(false);
      return;
    }

    // Read SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, content: "Error: No response stream" } : m)),
      );
      setIsStreaming(false);
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as {
              type: string;
              content?: string;
              stage?: string;
              tool?: string;
            };

            if (event.type === "chunk" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: m.content + event.content } : m,
                ),
              );
              setToolActivity(null);
            } else if (event.type === "stage" && event.stage === "executing_tool") {
              setToolActivity(event.tool || "tool");
            } else if (event.type === "error" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId
                    ? {
                        ...m,
                        content: m.content + `\n\nError: ${event.content}`,
                      }
                    : m,
                ),
              );
            } else if (event.type === "complete") {
              setToolActivity(null);
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    } finally {
      reader.releaseLock();
      setIsStreaming(false);
      setToolActivity(null);
    }
  }, [input, isStreaming]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 border-b border-white/10 bg-zinc-900/50 backdrop-blur-sm">
        <Link
          href="/apps/spike-land-admin"
          className="text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Bot className="h-4 w-4 text-amber-500" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">BAZDMEG Orchestrator</h1>
            <p className="text-xs text-zinc-500">{isStreaming ? "Thinking..." : "Ready"}</p>
          </div>
        </div>
        <div className="ml-auto text-xs text-zinc-600">{userName}</div>
      </header>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20">
              <Bot className="h-12 w-12 text-amber-500/50 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2">BAZDMEG Orchestrator</h2>
              <p className="text-zinc-500 text-sm max-w-md mx-auto">
                Chat-driven development management. Ask about quality gates, CI status, PR
                readiness, or create tickets.
              </p>
              <div className="flex flex-wrap gap-2 justify-center mt-6">
                {["What's the status?", "Can we deploy?", "Show open PRs", "Platform health"].map(
                  (suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInput(suggestion);
                        textareaRef.current?.focus();
                      }}
                      className="px-3 py-1.5 text-xs text-zinc-400 border border-zinc-700 rounded-full hover:border-amber-500/50 hover:text-amber-500 transition-colors"
                    >
                      {suggestion}
                    </button>
                  ),
                )}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {/* Tool activity indicator */}
          {toolActivity && (
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Wrench className="h-3 w-3 animate-spin" />
              <span>Calling {toolActivity}...</span>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-white/10 bg-zinc-900/50 backdrop-blur-sm p-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <Textarea
            ref={textareaRef}
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[48px] max-h-[120px] resize-none bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 focus:border-amber-500/50"
            disabled={isStreaming}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            size="icon"
            aria-label={isStreaming ? "Sending message" : "Send message"}
            className="h-[48px] w-[48px] bg-amber-500 hover:bg-amber-600 text-black"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600 text-center mt-2">
          Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

// Only allow https URLs on spike.land domains for iframe embedding
function isSafeIframeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "spike.land" || parsed.hostname.endsWith(".spike.land"))
    );
  } catch {
    return false;
  }
}

const MessageBubble = memo(function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "USER";

  // Check for iframe-worthy URLs in agent messages
  const rawIframeUrl = !isUser
    ? message.content.match(/https?:\/\/testing\.spike\.land\/live\/[^\s)]+/)?.[0]
    : null;
  const iframeUrl = rawIframeUrl && isSafeIframeUrl(rawIframeUrl) ? rawIframeUrl : null;

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="h-7 w-7 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Bot className="h-3.5 w-3.5 text-amber-500" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "max-w-[85%] rounded-xl px-4 py-3",
          isUser ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-100",
        )}
      >
        <div className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content || <span className="text-zinc-500 italic">Thinking...</span>}
        </div>

        {/* Inline iframe for dashboard URLs */}
        {iframeUrl && (
          <div className="mt-3 rounded-lg overflow-hidden border border-zinc-700">
            <iframe
              src={iframeUrl}
              title="Dashboard"
              className="w-full h-[400px] bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        )}

        <p className={cn("text-[10px] mt-1.5", isUser ? "text-black/50" : "text-zinc-600")}>
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="h-7 w-7 rounded-full bg-amber-500 flex items-center justify-center">
            <User className="h-3.5 w-3.5 text-black" />
          </div>
        </div>
      )}
    </div>
  );
});
