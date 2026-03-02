"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { tryCatch } from "@/lib/try-catch";
import { Bot, Loader2, Send, User } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export function ChatPanel({
  planId,
  initialMessages,
  isDisabled,
}: {
  planId: string | null;
  initialMessages: ChatMessage[];
  isDisabled: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync when plan changes
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  // Clean up stream on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming || !planId) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const { data: response, error: fetchError } = await tryCatch(
      fetch("/api/bazdmeg/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, planId }),
        signal: controller.signal,
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

    const reader = response.body?.getReader();
    if (!reader) {
      setMessages((prev) =>
        prev.map((m) => (m.id === agentMsgId ? { ...m, content: "Error: No stream" } : m)),
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
            };

            if (event.type === "chunk" && event.content) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === agentMsgId ? { ...m, content: m.content + event.content } : m,
                ),
              );
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
            }
          } catch {
            // Skip malformed events
          }
        }
      }
    } finally {
      reader.releaseLock();
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  }, [input, isStreaming, planId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !isDisabled) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!planId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Bot className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
          <p className="text-xs text-zinc-600">Select a ticket to start planning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-amber-500" />
          <h3 className="text-xs font-medium text-zinc-400">Plan with Opus</h3>
          {isStreaming && (
            <span className="text-[10px] text-amber-400 animate-pulse">Thinking...</span>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1">
        <div className="p-3 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-8 w-8 text-amber-500/30 mx-auto mb-2" />
              <p className="text-xs text-zinc-600">
                Ask Opus to help create an implementation plan
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center mt-3">
                {[
                  "Create a plan for this ticket",
                  "What files need to change?",
                  "Suggest edge cases",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="px-2 py-1 text-[10px] text-zinc-500 border border-zinc-700 rounded-full hover:border-amber-500/50 hover:text-amber-400 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-white/10 p-2">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            placeholder={isDisabled ? "Chat disabled while Jules is working" : "Plan with Opus..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStreaming || isDisabled}
            className="min-h-[40px] max-h-[80px] resize-none bg-zinc-800 border-zinc-700 text-white text-xs placeholder:text-zinc-600 focus:border-amber-500/50"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming || isDisabled}
            size="icon"
            aria-label={isStreaming ? "Sending message" : "Send message"}
            className="h-[40px] w-[40px] bg-amber-500 hover:bg-amber-600 text-black shrink-0"
          >
            {isStreaming ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

const ChatBubble = memo(function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "USER";

  return (
    <div className={cn("flex gap-2", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Bot className="h-2.5 w-2.5 text-amber-500" />
          </div>
        </div>
      )}
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2",
          isUser ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-100",
        )}
      >
        <div className="text-xs whitespace-pre-wrap leading-relaxed">
          {message.content || <span className="text-zinc-500 italic">Thinking...</span>}
        </div>
      </div>
      {isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center">
            <User className="h-2.5 w-2.5 text-black" />
          </div>
        </div>
      )}
    </div>
  );
});
