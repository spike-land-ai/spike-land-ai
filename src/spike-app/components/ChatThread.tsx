import { type KeyboardEvent, useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/shared/ui/button";
import { Send, Copy, Check, User, Bot, Loader2 } from "lucide-react";
import { cn } from "@/shared/utils/cn";
import { UI_ANIMATIONS, ScrollContainer } from "@spike-land-ai/shared";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ChatThreadProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading?: boolean;
}

function MessageItem({ msg }: { msg: Message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), UI_ANIMATIONS.COPY_FEEDBACK_MS);
  }, [msg.content]);

  return (
    <div
      className={cn(
        "group flex w-full flex-col gap-2 mb-4",
        msg.role === "user" ? "items-end" : "items-start"
      )}
    >
      <div className="flex items-center gap-2 px-1">
        {msg.role === "assistant" && <Bot className="size-3.5 text-primary" />}
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50">
          {msg.role}
        </span>
        {msg.role === "user" && <User className="size-3.5 text-muted-foreground" />}
      </div>
      <div
        className={cn(
          "relative max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm transition-all",
          msg.role === "user"
            ? "bg-primary text-primary-foreground rounded-tr-none"
            : "bg-card border border-border text-foreground rounded-tl-none hover:border-primary/30"
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        
        {msg.role === "assistant" && (
          <button
            onClick={handleCopy}
            className="absolute -right-8 top-0 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
            title="Copy message"
          >
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          </button>
        )}

        {msg.timestamp && (
          <p
            className={cn(
              "mt-2 text-[10px] font-medium",
              msg.role === "user" ? "text-primary-foreground/60" : "text-muted-foreground/60"
            )}
          >
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatThread({ messages, onSendMessage, isLoading }: ChatThreadProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    inputRef.current?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="flex h-full flex-col bg-muted/30">
      <ScrollContainer 
        ref={scrollRef} 
        role="log"
        aria-label="Chat history"
        className="p-4 md:p-6"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
            <div className="p-4 rounded-full bg-primary/5">
              <Bot className="size-8 text-primary/40" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">No messages yet</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Start a conversation with the AI assistant to build your application.
              </p>
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <MessageItem key={msg.id} msg={msg} />
        ))}
        {isLoading && (
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center gap-2 rounded-2xl bg-card border border-border px-4 py-3 shadow-sm">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span className="text-xs font-medium text-muted-foreground animate-pulse">Assistant is thinking...</span>
            </div>
          </div>
        )}
      </ScrollContainer>
      
      <div className="border-t border-border bg-card p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.02)]">
        <div className="mx-auto max-w-4xl relative flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all min-h-[46px]"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 size-[46px] rounded-xl shadow-lg shadow-primary/20"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-2">
          Press <strong>Enter</strong> to send, <strong>Shift+Enter</strong> for new line
        </p>
      </div>
    </div>
  );
}

export type { ChatThreadProps, Message };
