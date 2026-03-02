"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChatStream } from "@/lib/bazdmeg/use-chat-stream";

interface BazdmegChatProps {
  onChatOpened?: () => void;
}

export function BazdmegChat({ onChatOpened }: BazdmegChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [placeholder, setPlaceholder] = useState("Ask about spike.land...");

  useEffect(() => {
    import("@/lib/constants/placeholders").then((m) => {
      setPlaceholder(m.getRandomPlaceholder());
    });
  }, []);

  // Get or create sessionId
  const [sessionId] = useState(() => {
    if (typeof window === "undefined") return "ssr";
    const stored = sessionStorage.getItem("bazdmeg-session-id");
    if (stored) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem("bazdmeg-session-id", id);
    return id;
  });

  const { messages, isStreaming, error, sendMessage } = useChatStream(sessionId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    onChatOpened?.();
    setTimeout(() => textareaRef.current?.focus(), 100);
  }, [onChatOpened]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput("");
    await sendMessage(trimmed);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500 text-zinc-950 shadow-lg transition-all hover:bg-amber-400 hover:scale-110"
        aria-label="Ask spike.land"
      >
        <MessageCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-300" />
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-white/10 bg-zinc-900/90 shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-amber-500" />
          <span className="font-semibold text-white">Ask spike.land</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-lg p-1 text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Close chat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex max-h-[400px] min-h-[200px] flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center text-sm text-zinc-500">
            <p className="mb-2">Ask anything about spike.land.</p>
            <p className="text-xs text-zinc-600">
              e.g. &quot;What can I build on spike.land?&quot;
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                msg.role === "user" ? "bg-amber-500/20 text-amber-100" : "bg-white/5 text-zinc-300"
              }`}
            >
              {msg.content || (
                <span className="inline-flex items-center gap-1 text-zinc-500">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                    style={{ animationDelay: "0.2s" }}
                  />
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"
                    style={{ animationDelay: "0.4s" }}
                  />
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 p-3">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[40px] max-h-[100px] resize-none border-white/10 bg-white/5 text-sm text-white placeholder:text-zinc-500"
            rows={1}
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            aria-label="Send message"
            className="h-10 w-10 shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
